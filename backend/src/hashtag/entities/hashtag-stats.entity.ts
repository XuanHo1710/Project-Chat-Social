import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { Hashtag } from './hashtag.entity';

export type HashtagStatsDocument = HydratedDocument<HashtagStats>;

/**
 * Bảng thống kê hashtag theo thời gian (trending)
 * - Lưu count theo period để tính trending nhanh
 * - Tránh đếm COUNT mỗi lần query (chết DB)
 */
@Schema({ timestamps: true })
export class HashtagStats {
    _id: mongoose.Schema.Types.ObjectId;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Hashtag.name, required: true, index: true })
    hashtagId: mongoose.Schema.Types.ObjectId;

    // The date this stat represents (start of period)
    @Prop({ type: Date, required: true, index: true })
    periodDate: Date;

    // Period type: 'HOURLY', 'DAILY', 'WEEKLY'
    @Prop({ type: String, enum: ['HOURLY', 'DAILY', 'WEEKLY'], required: true })
    periodType: string;

    // Number of times used in this period
    @Prop({ type: Number, default: 0 })
    usageCount: number;

    // Number of unique users who used it
    @Prop({ type: Number, default: 0 })
    uniqueUsers: number;

    @Prop()
    createdAt: Date;

    @Prop()
    updatedAt: Date;
}

export const HashtagStatsSchema = SchemaFactory.createForClass(HashtagStats);

// Unique index for upsert operations
HashtagStatsSchema.index({ hashtagId: 1, periodDate: 1, periodType: 1 }, { unique: true });

// Index for trending queries (get top hashtags in a period)
HashtagStatsSchema.index({ periodType: 1, periodDate: 1, usageCount: -1 });
