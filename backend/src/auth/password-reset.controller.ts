import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AccountService } from 'src/account/account.service';
import { OtpService } from 'src/otp/otp.service';
import { EmailService } from 'src/email/email.service';
import { ForgotPasswordDto, VerifyOtpDto, ResetPasswordDto, ResendOtpDto } from './dto/password-reset.dto';
import { Public } from 'decorators/customize';

@Controller('auth/password')
export class PasswordResetController {
    constructor(
        private readonly accountService: AccountService,
        private readonly otpService: OtpService,
        private readonly emailService: EmailService,
    ) { }

    /**
     * Step 1: Request password reset - Send OTP to email
     */
    @Public()
    @Post('forgot')
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
        const email = dto.email.toLowerCase().trim();

        // Check if account exists
        const account = await this.accountService.findByEmailForPasswordReset(email);

        // Always return success message to prevent email enumeration attacks
        if (!account) {
            return {
                success: true,
                message: 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được mã xác minh',
            };
        }

        // Generate OTP
        const { code, expiresAt } = await this.otpService.createOtp(email, 'PASSWORD_RESET');

        // Send OTP email
        const emailSent = await this.emailService.sendOtpEmail(
            email,
            code,
            this.otpService.getExpiryMinutes()
        );

        if (!emailSent) {
            return {
                success: false,
                message: 'Không thể gửi email. Vui lòng thử lại sau.',
            };
        }

        return {
            success: true,
            message: 'Mã xác minh đã được gửi đến email của bạn',
            expiresAt,
        };
    }

    /**
     * Step 2: Verify OTP
     */
    @Public()
    @Post('verify-otp')
    @HttpCode(HttpStatus.OK)
    async verifyOtp(@Body() dto: VerifyOtpDto) {
        const email = dto.email.toLowerCase().trim();

        // Verify OTP
        await this.otpService.verifyOtp(email, dto.otp, 'PASSWORD_RESET');

        return {
            success: true,
            message: 'Xác minh thành công. Bạn có thể đặt lại mật khẩu.',
        };
    }

    /**
     * Step 3: Reset password
     */
    @Public()
    @Post('reset')
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() dto: ResetPasswordDto) {
        const email = dto.email.toLowerCase().trim();

        // Check if OTP was recently verified
        const isVerified = await this.otpService.isOtpVerified(email, 'PASSWORD_RESET', 10);

        if (!isVerified) {
            return {
                success: false,
                message: 'Phiên xác minh đã hết hạn. Vui lòng bắt đầu lại quá trình.',
            };
        }

        // Get account info for email notification
        const account = await this.accountService.findByEmailForPasswordReset(email);

        if (!account) {
            return {
                success: false,
                message: 'Không tìm thấy tài khoản',
            };
        }

        // Update password
        const updated = await this.accountService.updatePassword(email, dto.newPassword);

        if (!updated) {
            return {
                success: false,
                message: 'Không thể cập nhật mật khẩu. Vui lòng thử lại.',
            };
        }

        // Send success notification email (non-blocking)
        this.emailService.sendPasswordResetSuccessEmail(email, account.firstName).catch(() => {
            // Ignore email send errors for notification
        });

        return {
            success: true,
            message: 'Đổi mật khẩu thành công! Vui lòng đăng nhập lại.',
        };
    }

    /**
     * Resend OTP
     */
    @Public()
    @Post('resend-otp')
    @HttpCode(HttpStatus.OK)
    async resendOtp(@Body() dto: ResendOtpDto) {
        const email = dto.email.toLowerCase().trim();

        // Check if account exists
        const account = await this.accountService.findByEmailForPasswordReset(email);

        if (!account) {
            return {
                success: true,
                message: 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được mã xác minh mới',
            };
        }

        // Generate new OTP
        const { code, expiresAt } = await this.otpService.createOtp(email, 'PASSWORD_RESET');

        // Send OTP email
        const emailSent = await this.emailService.sendOtpEmail(
            email,
            code,
            this.otpService.getExpiryMinutes()
        );

        if (!emailSent) {
            return {
                success: false,
                message: 'Không thể gửi email. Vui lòng thử lại sau.',
            };
        }

        return {
            success: true,
            message: 'Đã gửi lại mã xác minh',
            expiresAt,
        };
    }
}
