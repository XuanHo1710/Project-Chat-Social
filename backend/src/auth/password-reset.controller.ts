import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from 'decorators/customize';
import { AccountService } from 'src/account/account.service';
import { EmailService } from 'src/email/email.service';
import { OtpService } from 'src/otp/otp.service';
import { AuthSessionService } from './auth-session.service';
import { ForgotPasswordDto, ResendOtpDto, ResetPasswordDto, VerifyOtpDto } from './dto/password-reset.dto';

@Controller('auth/password')
export class PasswordResetController {
  constructor(
    private readonly accountService: AccountService,
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  private async assertRequestRateLimit(request: Request, email: string, action: string): Promise<void> {
    const ipAddress = request.ip || request.socket.remoteAddress || 'unknown';
    await Promise.all([
      this.authSessionService.assertRateLimit(`${action}-email`, email, 1, 60),
      this.authSessionService.assertRateLimit(`${action}-ip`, ipAddress, 30, 15 * 60),
    ]);
  }

  private genericRequestResponse(expiresAt: Date) {
    return {
      success: true,
      message: 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được mã xác minh',
      expiresAt,
    };
  }

  private async requestOtp(email: string): Promise<{ success: boolean; message: string; expiresAt: Date }> {
    const { code, expiresAt } = await this.otpService.createOtp(email, 'PASSWORD_RESET');
    const account = await this.accountService.findByEmailForPasswordReset(email);
    if (account) {
      void this.emailService
        .sendOtpEmail(email, code, this.otpService.getExpiryMinutes())
        .catch(() => false);
    }
    return this.genericRequestResponse(expiresAt);
  }

  @Public()
  @Post('forgot')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Req() request: Request, @Body() dto: ForgotPasswordDto) {
    const email = dto.email.toLowerCase().trim();
    await this.assertRequestRateLimit(request, email, 'password-reset-request');
    return this.requestOtp(email);
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Req() request: Request, @Body() dto: VerifyOtpDto) {
    const email = dto.email.toLowerCase().trim();
    const ipAddress = request.ip || request.socket.remoteAddress || 'unknown';
    await this.authSessionService.assertRateLimit(
      'password-reset-verify-ip',
      ipAddress,
      30,
      15 * 60,
    );
    const { resetToken } = await this.otpService.verifyOtp(email, dto.otp, 'PASSWORD_RESET');
    return {
      success: true,
      message: 'Xác minh thành công. Bạn có thể đặt lại mật khẩu.',
      resetToken,
    };
  }

  @Public()
  @Post('reset')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Req() request: Request, @Body() dto: ResetPasswordDto) {
    const email = dto.email.toLowerCase().trim();
    if (Buffer.byteLength(dto.newPassword, 'utf8') > 72) {
      throw new BadRequestException('Mật khẩu không được vượt quá 72 byte');
    }

    const ipAddress = request.ip || request.socket.remoteAddress || 'unknown';
    await this.authSessionService.assertRateLimit(
      'password-reset-submit-ip',
      ipAddress,
      20,
      15 * 60,
    );

    const tokenConsumed = await this.otpService.consumeResetToken(
      email,
      dto.resetToken,
      'PASSWORD_RESET',
    );
    if (!tokenConsumed) {
      throw new BadRequestException('Phiên xác minh không hợp lệ hoặc đã hết hạn');
    }

    const account = await this.accountService.findByEmailForPasswordReset(email);
    if (!account || !(await this.accountService.updatePassword(email, dto.newPassword))) {
      throw new BadRequestException('Không thể cập nhật mật khẩu');
    }

    await this.authSessionService.removeAllUserSessions(account._id.toString());
    void this.emailService
      .sendPasswordResetSuccessEmail(email, account.firstName)
      .catch(() => false);

    return {
      success: true,
      message: 'Đổi mật khẩu thành công! Vui lòng đăng nhập lại.',
    };
  }

  @Public()
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  async resendOtp(@Req() request: Request, @Body() dto: ResendOtpDto) {
    const email = dto.email.toLowerCase().trim();
    await this.assertRequestRateLimit(request, email, 'password-reset-request');
    return this.requestOtp(email);
  }
}
