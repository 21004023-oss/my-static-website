# Web tĩnh: khách xem, chỉ chủ shop sửa

Khách mở trang chủ là xem bảng giá ngay, không cần PIN.

## Mỗi lần cập nhật có dễ không
Rất dễ, mỗi lần chỉ khoảng 2 phút:
1. Bạn mở trang `/admin.html`, nhập mật khẩu quản trị (nhớ đổi dòng `ADMIN_PASSWORD` trong file trước khi đăng).
2. Sửa giá, tồn kho, thêm hoặc xóa gói ngay trên trang.
3. Bấm “Tải file services.json mới”.
4. Bấm “Mở trang đăng file lên GitHub”, kéo file vừa tải vào, bấm Commit. Web tự cập nhật sau vài phút.

Cách nhanh hơn nữa: vào thẳng `data/services.json` trên GitHub, bấm sửa, đổi giá rồi Commit.

## Vì sao chỉ mình bạn sửa được
- Trang khách không có nút nào dẫn tới trang admin.
- Trang admin có mật khẩu cửa ngoài (lưu ý: đây chỉ là lớp che trên trình duyệt, không phải bảo mật tuyệt đối).
- Quan trọng nhất: file trên web chỉ thay đổi khi có người đăng nhập đúng tài khoản GitHub của bạn và bấm Commit. Người khác không có tài khoản đó thì không đăng được gì lên web của bạn.

## Lưu ý
- File `data/services.json` bản này chỉ chứa giá bán, không chứa giá vốn nên khách không thấy được lãi của bạn.
- Nhớ đổi `ADMIN_PASSWORD` trong `admin.html` thành mật khẩu riêng trước khi upload.
- Upload toàn bộ thư mục này lên repo `my-static-website`, bật GitHub Pages là chạy.
