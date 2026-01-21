# Hướng dẫn cấu hình Brevo Email API

## Giới thiệu
Brevo (trước đây là Sendinblue) là nền tảng email marketing và transactional email phổ biến, cung cấp API miễn phí với 300 email/ngày.

## Bước 1: Tạo tài khoản Brevo

1. Truy cập [https://www.brevo.com](https://www.brevo.com)
2. Click **"Sign up free"** hoặc **"Get started free"**
3. Điền thông tin đăng ký:
   - Email
   - Password
   - Tên công ty (có thể để tên dự án)
4. Xác nhận email bằng link gửi về hộp thư

## Bước 2: Lấy API Key

1. Đăng nhập vào tài khoản Brevo
2. Click vào **avatar/tên** ở góc trên bên phải
3. Chọn **"SMTP & API"** từ menu dropdown
4. Hoặc truy cập trực tiếp: [https://app.brevo.com/settings/keys/api](https://app.brevo.com/settings/keys/api)
5. Tại mục **"API Keys"**, click **"Generate a new API key"**
6. Đặt tên cho key (ví dụ: `social-chat-app`)
7. Click **"Generate"**
8. Copy API Key ngay lập tức (key chỉ hiển thị 1 lần!)

> ⚠️ **Quan trọng**: Lưu API Key ở nơi an toàn. Nếu mất, bạn phải tạo key mới.

## Bước 3: Cấu hình trong dự án

### 1. Thêm biến môi trường vào file `.env` (Backend)

```env
# Brevo Email Configuration
BREVO_API_KEY=your-api-key-here
BREVO_SENDER_EMAIL=noreply@yourdomain.com
BREVO_SENDER_NAME=Social Chat
```

### 2. Giải thích các biến

| Biến | Mô tả | Ví dụ |
|------|-------|-------|
| `BREVO_API_KEY` | API Key từ Brevo Dashboard | `xkeysib-xxxxx...` |
| `BREVO_SENDER_EMAIL` | Email người gửi (nên dùng email đã xác minh) | `noreply@socialchat.com` |
| `BREVO_SENDER_NAME` | Tên hiển thị của người gửi | `Social Chat` |

## Bước 4: Xác minh Sender Email (Khuyến nghị)

Để tránh email bị đánh dấu spam:

1. Vào **"Settings"** → **"Senders, Domains & Dedicated IPs"**
2. Hoặc truy cập: [https://app.brevo.com/senders](https://app.brevo.com/senders)
3. Click **"Add a sender"**
4. Điền email và tên
5. Click vào link xác nhận gửi về email đó

## Bước 5: Kiểm tra cấu hình

Sau khi cấu hình xong, khởi động lại Backend Server:

```bash
npm run start:dev
```

Thử gửi email test bằng cách trigger luồng "Quên mật khẩu" từ Frontend.

## Gói miễn phí của Brevo

- ✅ 300 email/ngày
- ✅ API không giới hạn request
- ✅ Email Templates
- ✅ Tracking & Analytics

## Troubleshooting

### Lỗi `permission_denied - Your SMTP account is not yet activated`

**Nguyên nhân**: Tài khoản Brevo mới cần được kích hoạt SMTP.

**Cách khắc phục**:

1. **Kích hoạt SMTP**:
   - Vào **Settings** → **SMTP & API**: https://app.brevo.com/settings/keys/smtp
   - Click **"Activate SMTP"** hoặc **"Request SMTP activation"**
   - Đợi email xác nhận (5-10 phút)

2. **Xác minh Sender Email** (BẮT BUỘC):
   - Vào **Senders, domains, IPs**: https://app.brevo.com/senders
   - Click **"Add a sender"** và thêm email dùng trong `BREVO_SENDER_EMAIL`
   - Click link xác nhận trong email

3. **Tắt IP Blocking** (để cho phép mọi IP):
   - Vào **Settings** → **Security** → **Authorized IPs**: https://app.brevo.com/security/authorised_ips
   - Đảm bảo **"Blocking unauthorized IP addresses"** hiển thị **"Deactivated"**
   - Nếu đang Active, click để tắt

### Dev Mode (Bypass Email)

Khi Brevo chưa sẵn sàng, hệ thống tự động chuyển sang **Dev Mode**:
- OTP sẽ được log ra **terminal console**
- Luồng vẫn hoạt động bình thường để test
- Tìm OTP trong log: `[DEV MODE] OTP for email@example.com: 123456`

### Email không gửi được

1. Kiểm tra `BREVO_API_KEY` đã đúng chưa
2. Kiểm tra `BREVO_SENDER_EMAIL` đã được xác minh chưa
3. Xem log lỗi trong terminal Backend

### Email vào Spam

1. Xác minh domain gửi (nếu có)
2. Sử dụng email sender đã verify
3. Tránh nội dung giống spam trong email

## Liên hệ hỗ trợ

- Brevo Help Center: [https://help.brevo.com](https://help.brevo.com)
- Brevo API Docs: [https://developers.brevo.com](https://developers.brevo.com)
