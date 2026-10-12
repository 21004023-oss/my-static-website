const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

try { require('dotenv').config(); } catch (e) { /* dotenv optional */ }

const app = express();
const port = process.env.PORT || 3000;
const dataFile = path.join(__dirname, 'data', 'services.json');
const adminUser = process.env.ADMIN_USERNAME || 'admin';
const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
const sessionSecret = process.env.SESSION_SECRET || 'change-this-secret-key';

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'change-this-secret-key') {
  console.warn('[WARN] SESSION_SECRET chua duoc doi. Hay dat SESSION_SECRET ngau nhien trong file .env');
}
if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
  console.warn('[WARN] Dang dung tai khoan admin mac dinh. Hay dat ADMIN_USERNAME / ADMIN_PASSWORD trong .env');
}

const accessCodes = new Map(); // email -> { code, expiresAt, attempts }

// --- Rate limit don gian (in-memory) ---
const loginAttempts = new Map();
const requestAttempts = new Map();
const MAX_LOGIN = 10;
const MAX_REQUEST_CODE = 5;
const MAX_VERIFY = 8;
const WINDOW_MS = 10 * 60 * 1000;

function hitLimit(map, key, max) {
  const now = Date.now();
  let rec = map.get(key);
  if (!rec || now > rec.resetAt) rec = { count: 0, resetAt: now + WINDOW_MS };
  rec.count += 1;
  map.set(key, rec);
  return rec.count > max;
}

app.use(express.json({ limit: '500kb' }));
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: process.env.COOKIE_SECURE === 'true', sameSite: 'lax', maxAge: 12 * 60 * 60 * 1000 }
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.removeHeader('X-Powered-By');
  next();
});

function ensureDataFile() {
  const dir = path.dirname(dataFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({
      youtube: {
        name: 'YouTube Premium',
        icon: '📺',
        plans: [
          { id: 'yt-1', name: 'YouTube Premium 1 Thang', desc: 'Bao hanh full thoi han', cost: 42000, price: 80000, stock: 18 }
        ]
      }
    }, null, 2));
  }
}

function readData() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

function saveData(data) {
  ensureDataFile();
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function isValidServices(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  for (const key of Object.keys(data)) {
    const appItem = data[key];
    if (!appItem || typeof appItem.name !== 'string') return false;
    if (!Array.isArray(appItem.plans)) return false;
    for (const p of appItem.plans) {
      if (!p || typeof p.name !== 'string') return false;
      for (const f of ['cost', 'price', 'stock']) {
        const v = Number(p[f]);
        if (!Number.isFinite(v) || v < 0) return false;
      }
    }
  }
  return true;
}

// Ban public: KHONG bao gio tra gia von
function toPublicData(data) {
  const out = {};
  for (const key of Object.keys(data)) {
    const appItem = data[key];
    out[key] = {
      name: appItem.name,
      icon: appItem.icon || '📦',
      plans: (appItem.plans || []).map(p => ({
        id: p.id,
        name: p.name,
        desc: p.desc || '',
        price: Number(p.price || 0),
        stock: Number(p.stock || 0)
      }))
    };
  }
  return out;
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ success: false, message: 'Unauthorized' });
}

function generateAccessCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendAccessCodeMail(email, code) {
  const host = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM || user || 'noreply@example.com';
  if (!host || !user || !pass) {
    return { sent: false, message: 'SMTP chua cau hinh. Dang o che do test local.' };
  }
  const transporter = nodemailer.createTransport({
    host, port: smtpPort, secure: Number(smtpPort) === 465, auth: { user, pass }
  });
  await transporter.sendMail({
    from, to: email,
    subject: 'Ma truy cap Website Bang Gia',
    text: `Ma truy cap cua ban la: ${code}\nMa co hieu luc 10 phut. Vui long nhap ma nay de mo bang gia.`
  });
  return { sent: true, message: 'Da gui email.' };
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get('/api/me', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// Khach: chi tra bang gia SAU KHI verify ma
app.get('/api/public-services', (req, res) => {
  if (!(req.session && (req.session.guestVerified || req.session.isAdmin))) {
    return res.status(401).json({ success: false, message: 'Hay nhap ma truy cap truoc.' });
  }
  try {
    res.json(toPublicData(readData()));
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to read data' });
  }
});

// Admin: du lieu day du, can dang nhap
app.get('/api/services', requireAdmin, (req, res) => {
  try {
    res.json(readData());
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to read data' });
  }
});

app.post('/api/services', requireAdmin, (req, res) => {
  try {
    const data = req.body;
    if (!isValidServices(data)) {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }
    saveData(data);
    return res.json({ success: true, message: 'Services saved' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to save data' });
  }
});

app.post('/api/request-access-code', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email || !email.includes('@') || email.length > 120) {
    return res.status(400).json({ success: false, message: 'Invalid email' });
  }
  const key = `${req.ip}|${email}`;
  if (hitLimit(requestAttempts, key, MAX_REQUEST_CODE)) {
    return res.status(429).json({ success: false, message: 'Ban gui qua nhieu lan. Thu lai sau 10 phut.' });
  }
  const code = generateAccessCode();
  accessCodes.set(email, { code, expiresAt: Date.now() + 10 * 60 * 1000, attempts: 0 });
  try {
    const result = await sendAccessCodeMail(email, code);
    // Khi da gui mail that: KHONG tra code ve client
    if (result.sent) {
      return res.json({ success: true, email, sent: true, message: 'Da gui ma qua email. Ma co hieu luc 10 phut.' });
    }
    // Chi tra code khi chua cau hinh SMTP (test local)
    return res.json({ success: true, email, sent: false, code, message: 'Che do test: SMTP chua cau hinh nen tra code truc tiep.' });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Khong gui duoc email. Thu lai sau.' });
  }
});

app.post('/api/verify-access-code', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || '').trim();
  const record = accessCodes.get(email);
  if (!record) {
    return res.status(401).json({ success: false, message: 'Chua co ma cho email nay. Hay bam Gui Ma truoc.' });
  }
  if (Date.now() > record.expiresAt) {
    accessCodes.delete(email);
    return res.status(401).json({ success: false, message: 'Ma da het han.' });
  }
  record.attempts = (record.attempts || 0) + 1;
  if (record.attempts > MAX_VERIFY) {
    accessCodes.delete(email);
    return res.status(429).json({ success: false, message: 'Nhap sai qua nhieu. Hay xin ma moi.' });
  }
  if (record.code !== code) {
    return res.status(401).json({ success: false, message: 'Ma khong dung.' });
  }
  accessCodes.delete(email);
  req.session.guestVerified = true;
  return res.json({ success: true, message: 'Verified' });
});

app.post('/api/login', (req, res) => {
  if (hitLimit(loginAttempts, req.ip, MAX_LOGIN)) {
    return res.status(429).json({ success: false, message: 'Dang nhap sai qua nhieu. Thu lai sau 10 phut.' });
  }
  const { username, password } = req.body || {};
  if (username === adminUser && password === adminPass) {
    req.session.isAdmin = true;
    return res.json({ success: true, message: 'Login successful' });
  }
  return res.status(401).json({ success: false, message: 'Invalid credentials' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, message: 'Logged out' });
  });
});

// Chan truy cap truc tiep file nhay cam
app.use('/data', (req, res) => res.status(403).json({ success: false, message: 'Forbidden' }));
app.use('/.env', (req, res) => res.status(404).send('Not found'));

// Route HTML (dat truoc static de bao ve admin.html)
app.get('/admin.html', (req, res) => {
  if (req.session && req.session.isAdmin) return res.sendFile(path.join(__dirname, 'admin.html'));
  return res.redirect('/admin');
});

app.get('/admin', (req, res) => {
  if (req.session && req.session.isAdmin) return res.sendFile(path.join(__dirname, 'admin.html'));
  return res.sendFile(path.join(__dirname, 'admin-login.html'));
});

app.get('/customer', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/', (req, res) => {
  res.redirect('/customer');
});

// File tinh: phuc vu html/css/js, KHONG phuc vu /data nho chan o tren
app.use(express.static(__dirname, { index: false, dotfiles: 'deny' }));

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
