import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { Model } from 'mongoose';
import { Otp, OtpDocument } from './entities/otp.entity';

export type OtpType = 'PASSWORD_RESET' | 'EMAIL_VERIFICATION' | 'PHONE_VERIFICATION';

@Injectable()
export class OtpService {
  private readonly OTP_LENGTH = 6;
  private readonly OTP_EXPIRY_MINUTES = 5;
  private readonly MAX_ATTEMPTS = 5;
  private readonly RESEND_COOLDOWN_SECONDS = 60;
  private readonly RESET_TOKEN_MINUTES = 10;
  private readonly hashSecret: string;

  constructor(
    @InjectModel(Otp.name) private readonly otpModel: Model<OtpDocument>,
    private readonly configService: ConfigService,
  ) {
    this.hashSecret =
      this.configService.get<string>('OTP_HASH_SECRET') ||
      this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET') ||
      '';

    if (!this.hashSecret) {
      throw new Error('OTP_HASH_SECRET or JWT_REFRESH_TOKEN_SECRET must be configured');
    }
  }

  private generateOtpCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(this.OTP_LENGTH, '0');
  }

  private hash(value: string): string {
    return createHmac('sha256', this.hashSecret).update(value).digest('hex');
  }

  private hashesMatch(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  async createOtp(email: string, type: OtpType): Promise<{ code: string; expiresAt: Date }> {
    const normalizedEmail = email.toLowerCase().trim();
    const cooldownStart = new Date(Date.now() - this.RESEND_COOLDOWN_SECONDS * 1000);
    const recentOtp = await this.otpModel
      .findOne({ email: normalizedEmail, type, createdAt: { $gte: cooldownStart } })
      .select('createdAt')
      .lean();

    if (recentOtp) {
      const waitSeconds = Math.max(
        1,
        Math.ceil(
          (recentOtp.createdAt.getTime() + this.RESEND_COOLDOWN_SECONDS * 1000 - Date.now()) /
            1000,
        ),
      );
      throw new BadRequestException(`Vui lòng đợi ${waitSeconds} giây trước khi gửi lại mã`);
    }

    const now = new Date();
    await this.otpModel.updateMany(
      { email: normalizedEmail, type, isConsumed: { $ne: true } },
      { $set: { isUsed: true, isConsumed: true, consumedAt: now } },
    );

    const code = this.generateOtpCode();
    const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.otpModel.create({
      email: normalizedEmail,
      code: this.hash(code),
      type,
      expiresAt,
    });

    return { code, expiresAt };
  }

  async verifyOtp(
    email: string,
    code: string,
    type: OtpType,
  ): Promise<{ resetToken: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const now = new Date();
    const otp = await this.otpModel
      .findOne({
        email: normalizedEmail,
        type,
        isUsed: false,
        expiresAt: { $gt: now },
      })
      .sort({ createdAt: -1 })
      .select('+code');

    if (!otp || otp.attempts >= this.MAX_ATTEMPTS) {
      throw new BadRequestException('Mã OTP không hợp lệ hoặc đã hết hạn');
    }

    if (!this.hashesMatch(otp.code, this.hash(code))) {
      const updated = await this.otpModel.findOneAndUpdate(
        { _id: otp._id, isUsed: false, attempts: { $lt: this.MAX_ATTEMPTS } },
        { $inc: { attempts: 1 } },
        { new: true },
      );
      const attempts = updated?.attempts ?? this.MAX_ATTEMPTS;

      if (attempts >= this.MAX_ATTEMPTS) {
        await this.otpModel.updateOne(
          { _id: otp._id, isUsed: false },
          { $set: { isUsed: true, isConsumed: true, consumedAt: new Date() } },
        );
      }

      throw new BadRequestException(
        `Mã OTP không chính xác. Còn ${Math.max(0, this.MAX_ATTEMPTS - attempts)} lần thử.`,
      );
    }

    const resetToken = randomBytes(32).toString('hex');
    const verified = await this.otpModel.findOneAndUpdate(
      {
        _id: otp._id,
        isUsed: false,
        attempts: { $lt: this.MAX_ATTEMPTS },
        expiresAt: { $gt: now },
      },
      {
        $set: {
          isUsed: true,
          usedAt: now,
          resetTokenHash: this.hash(resetToken),
          isConsumed: false,
          expiresAt: new Date(now.getTime() + this.RESET_TOKEN_MINUTES * 60 * 1000),
        },
      },
      { new: true },
    );

    if (!verified) {
      throw new BadRequestException('Mã OTP không hợp lệ hoặc đã được sử dụng');
    }

    return { resetToken };
  }

  async consumeResetToken(email: string, resetToken: string, type: OtpType): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim();
    const now = new Date();
    const result = await this.otpModel.findOneAndUpdate(
      {
        email: normalizedEmail,
        type,
        isUsed: true,
        isConsumed: false,
        resetTokenHash: this.hash(resetToken),
        expiresAt: { $gt: now },
      },
      {
        $set: { isConsumed: true, consumedAt: now },
        $unset: { resetTokenHash: 1 },
      },
      { new: true },
    );

    return !!result;
  }

  getExpiryMinutes(): number {
    return this.OTP_EXPIRY_MINUTES;
  }
}
