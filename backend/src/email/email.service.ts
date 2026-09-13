import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface SendEmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

interface BrevoResponse {
  messageId?: string;
  code?: string;
  message?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string;
  private readonly senderEmail: string;
  private readonly senderName: string;
  private readonly brevoApiUrl = 'https://api.brevo.com/v3/smtp/email';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('BREVO_API_KEY') || '';
    this.senderEmail =
      this.configService.get<string>('BREVO_SENDER_EMAIL') || 'noreply@socialchat.com';
    this.senderName = this.configService.get<string>('BREVO_SENDER_NAME') || 'Social Chat';

    if (!this.apiKey) {
      this.logger.warn('BREVO_API_KEY is not configured. Emails will not be sent.');
    }
  }

  /**
   * Send email using Brevo API
   */
  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.error('Cannot send email: BREVO_API_KEY is not configured');
      return false;
    }

    const payload = {
      sender: {
        name: this.senderName,
        email: this.senderEmail,
      },
      to: [{ email: options.to }],
      subject: options.subject,
      htmlContent: options.htmlContent,
      textContent: options.textContent || this.stripHtml(options.htmlContent),
    };

    try {
      const response = await fetch(this.brevoApiUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'api-key': this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      await response.json();

      if (response.ok) {
        return true;
      } else {
        return false;
      }
    } catch (error: any) {
      this.logger.error(`Error sending email: ${error.message}`);
      return false;
    }
  }

  /** Send a password-reset OTP. Plaintext logging is explicit and development-only. */
  async sendOtpEmail(email: string, otp: string, expiresInMinutes: number = 5): Promise<boolean> {
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    const mayLogOtp =
      nodeEnv !== 'production' && this.configService.get<string>('EMAIL_LOG_OTP') === 'true';
    if (mayLogOtp) {
      this.logger.warn(`[DEV MODE] OTP for ${email}: ${otp} (expires in ${expiresInMinutes} min)`);
    }

    if (!this.apiKey) {
      this.logger.warn('BREVO_API_KEY is not configured; OTP email was not sent');
      return mayLogOtp;
    }

    const htmlContent = this.generateOtpEmailTemplate(otp, expiresInMinutes);

    const success = await this.sendEmail({
      to: email,
      subject: `[${otp}] Mã xác minh đặt lại mật khẩu - Social Chat`,
      htmlContent,
    });

    if (!success) {
      return mayLogOtp;
    }

    return success;
  }

  /**
   * Send password reset success notification
   */
  async sendPasswordResetSuccessEmail(email: string, firstName: string): Promise<boolean> {
    const htmlContent = this.generatePasswordResetSuccessTemplate(firstName);

    return this.sendEmail({
      to: email,
      subject: 'Mật khẩu của bạn đã được thay đổi - Social Chat',
      htmlContent,
    });
  }

  /**
   * Generate OTP email template
   */
  private generateOtpEmailTemplate(otp: string, expiresInMinutes: number): string {
    return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mã xác minh OTP</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f2f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #1877f2 0%, #00c6ff 100%); border-radius: 16px 16px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Social Chat</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Khôi phục mật khẩu</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1c1e21; font-size: 24px; font-weight: 600; text-align: center;">
                Mã xác minh của bạn
              </h2>
              
              <p style="margin: 0 0 30px; color: #606770; font-size: 16px; line-height: 1.6; text-align: center;">
                Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Sử dụng mã OTP dưới đây để tiếp tục:
              </p>
              
              <!-- OTP Box -->
              <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 0 0 30px;">
                <p style="margin: 0 0 10px; color: #606770; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Mã xác minh</p>
                <div style="font-size: 40px; font-weight: 700; color: #1877f2; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                  ${otp}
                </div>
              </div>
              
              <!-- Warning -->
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px; padding: 15px 20px; margin: 0 0 30px;">
                <p style="margin: 0; color: #856404; font-size: 14px;">
                  ⏱️ <strong>Mã này sẽ hết hạn sau ${expiresInMinutes} phút.</strong><br>
                  Vui lòng không chia sẻ mã này với bất kỳ ai.
                </p>
              </div>
              
              <p style="margin: 0; color: #606770; font-size: 14px; line-height: 1.6; text-align: center;">
                Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này hoặc liên hệ với chúng tôi nếu bạn lo ngại về bảo mật tài khoản.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 16px 16px; text-align: center;">
              <p style="margin: 0 0 10px; color: #606770; font-size: 14px;">
                Cảm ơn bạn đã sử dụng Social Chat!
              </p>
              <p style="margin: 0; color: #90949c; font-size: 12px;">
                © ${new Date().getFullYear()} Social Chat. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  /**
   * Generate password reset success template
   */
  private generatePasswordResetSuccessTemplate(firstName: string): string {
    return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Đổi mật khẩu thành công</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f2f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #42b72a 0%, #36d058 100%); border-radius: 16px 16px 0 0;">
              <div style="width: 60px; height: 60px; background-color: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 32px;">✓</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Đổi mật khẩu thành công!</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #1c1e21; font-size: 18px; font-weight: 600;">
                Xin chào ${firstName},
              </p>
              
              <p style="margin: 0 0 20px; color: #606770; font-size: 16px; line-height: 1.6;">
                Mật khẩu tài khoản Social Chat của bạn đã được thay đổi thành công.
              </p>
              
              <p style="margin: 0 0 30px; color: #606770; font-size: 16px; line-height: 1.6;">
                Bây giờ bạn có thể đăng nhập bằng mật khẩu mới.
              </p>
              
              <!-- Security Warning -->
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px; padding: 15px 20px; margin: 0 0 30px;">
                <p style="margin: 0; color: #856404; font-size: 14px;">
                  🔐 <strong>Nếu bạn không thực hiện thay đổi này</strong>, vui lòng liên hệ với chúng tôi ngay lập tức để bảo vệ tài khoản của bạn.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 16px 16px; text-align: center;">
              <p style="margin: 0 0 10px; color: #606770; font-size: 14px;">
                Cảm ơn bạn đã sử dụng Social Chat!
              </p>
              <p style="margin: 0; color: #90949c; font-size: 12px;">
                © ${new Date().getFullYear()} Social Chat. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  /**
   * Strip HTML tags for plain text version
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
