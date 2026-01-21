import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Otp, OtpDocument } from './entities/otp.entity';

export type OtpType = 'PASSWORD_RESET' | 'EMAIL_VERIFICATION' | 'PHONE_VERIFICATION';

@Injectable()
export class OtpService {
    private readonly OTP_LENGTH = 6;
    private readonly OTP_EXPIRY_MINUTES = 5;
    private readonly MAX_ATTEMPTS = 5;
    private readonly RESEND_COOLDOWN_SECONDS = 60;

    constructor(
        @InjectModel(Otp.name) private otpModel: Model<OtpDocument>,
    ) { }

    /**
     * Generate a random OTP code
     */
    private generateOtpCode(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    /**
     * Create and store a new OTP
     */
    async createOtp(email: string, type: OtpType): Promise<{ code: string; expiresAt: Date }> {
        const normalizedEmail = email.toLowerCase().trim();

        // Check for recent OTP (cooldown)
        const recentOtp = await this.otpModel.findOne({
            email: normalizedEmail,
            type,
            isUsed: false,
            createdAt: { $gte: new Date(Date.now() - this.RESEND_COOLDOWN_SECONDS * 1000) },
        });

        if (recentOtp) {
            const waitSeconds = Math.ceil(
                (recentOtp.createdAt.getTime() + this.RESEND_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000
            );
            throw new BadRequestException(`Vui lòng đợi ${waitSeconds} giây trước khi gửi lại mã`);
        }

        // Invalidate any existing unused OTPs for this email and type
        await this.otpModel.updateMany(
            { email: normalizedEmail, type, isUsed: false },
            { isUsed: true }
        );

        // Generate new OTP
        const code = this.generateOtpCode();
        const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

        await this.otpModel.create({
            email: normalizedEmail,
            code,
            type,
            expiresAt,
        });

        return { code, expiresAt };
    }

    /**
     * Verify an OTP code
     */
    async verifyOtp(email: string, code: string, type: OtpType): Promise<boolean> {
        const normalizedEmail = email.toLowerCase().trim();

        const otp = await this.otpModel.findOne({
            email: normalizedEmail,
            type,
            isUsed: false,
            expiresAt: { $gt: new Date() },
        }).sort({ createdAt: -1 });

        if (!otp) {
            throw new BadRequestException('Mã OTP không hợp lệ hoặc đã hết hạn');
        }

        // Check max attempts
        if (otp.attempts >= this.MAX_ATTEMPTS) {
            otp.isUsed = true;
            await otp.save();
            throw new BadRequestException('Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới.');
        }

        // Verify code
        if (otp.code !== code) {
            otp.attempts += 1;
            await otp.save();
            const remaining = this.MAX_ATTEMPTS - otp.attempts;
            throw new BadRequestException(`Mã OTP không chính xác. Còn ${remaining} lần thử.`);
        }

        // Mark as used
        otp.isUsed = true;
        otp.usedAt = new Date();
        await otp.save();

        return true;
    }

    /**
     * Check if OTP was recently verified (for password reset flow)
     */
    async isOtpVerified(email: string, type: OtpType, withinMinutes: number = 10): Promise<boolean> {
        const normalizedEmail = email.toLowerCase().trim();
        const minTime = new Date(Date.now() - withinMinutes * 60 * 1000);

        const verifiedOtp = await this.otpModel.findOne({
            email: normalizedEmail,
            type,
            isUsed: true,
            usedAt: { $gte: minTime },
        });

        return !!verifiedOtp;
    }

    /**
     * Get OTP expiry time in minutes
     */
    getExpiryMinutes(): number {
        return this.OTP_EXPIRY_MINUTES;
    }
}
