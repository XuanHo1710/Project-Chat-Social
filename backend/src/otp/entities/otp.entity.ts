import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

export type OtpDocument = HydratedDocument<Otp>;

@Schema({ timestamps: true })
export class Otp {
    _id: mongoose.Schema.Types.ObjectId;

    @Prop({ required: true })
    email: string;

    @Prop({ required: true })
    code: string;

    @Prop({ required: true, enum: ['PASSWORD_RESET', 'EMAIL_VERIFICATION', 'PHONE_VERIFICATION'] })
    type: string;

    @Prop({ required: true })
    expiresAt: Date;

    @Prop({ default: false })
    isUsed: boolean;

    @Prop({ default: 0 })
    attempts: number; // Số lần thử sai

    @Prop()
    usedAt?: Date;

    @Prop()
    createdAt: Date;
}

export const OtpSchema = SchemaFactory.createForClass(Otp);

// TTL Index: Tự động xóa document sau khi hết hạn
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index cho tìm kiếm nhanh
OtpSchema.index({ email: 1, type: 1, isUsed: 1 });
