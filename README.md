# Bảng giá dịch vụ số — Bản đã sửa (chạy bằng Node/Express)

Bản này GIỮ backend Express, KHÔNG dùng GitHub Pages nữa (vì GitHub Pages không chạy Node, không gửi mail, không giữ session đăng nhập được).

## Những gì đã sửa
- Đăng nhập admin chuyển hoàn toàn về server (`POST /api/login` + session). Xóa tài khoản cứng `admin/admin123` trong HTML.
- Trang khách xin mã + verify mã qua server. Khi đã cấu hình SMTP thì KHÔNG trả code về client nữa. Có giới hạn: 5 lần xin mã / 10 phút, 8 lần nhập sai / mã, 10 lần login sai / 10 phút.
- Bảng giá khách (`GET /api/public-services`) chỉ trả giá bán + tồn kho, KHÔNG lộ giá vốn. Chỉ trả sau khi đã verify mã.
- API admin (`GET/POST /api/services`) bắt buộc đăng nhập, có validate dữ liệu.
- Thêm `dotenv` để đọc file `.env`, thêm phục vụ file tĩnh, chặn truy cập trực tiếp `/data`, thêm file `data/services.json` mẫu.
- Sửa lỗi sửa gói nhảy nhầm app, chống XSS khi render tên app/gói, thêm nút Hủy sửa.

## Cách chạy
1. Cài Node.js 18 trở lên.
2. Copy `.env.example` thành `.env` rồi đổi `ADMIN_PASSWORD` và `SESSION_SECRET`.
   (Muốn gửi mail thật: điền SMTP Gmail bằng App Password.)
3. Chạy:
   ```
   npm install
   npm start
   ```
4. Mở:
   - Khách: http://localhost:3000/
   - Admin: http://localhost:3000/admin

## Deploy
- KHÔNG deploy bản này lên GitHub Pages. Hãy deploy lên Render / Railway / VPS (có chạy Node).
- Nhớ đặt biến môi trường `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `SMTP_*` trên server, và bật `COOKIE_SECURE=true` khi đã có HTTPS.
- File `CNAME` giữ lại nếu bạn vẫn trỏ domain phanngoquocbao.id.vn về server của mình.
