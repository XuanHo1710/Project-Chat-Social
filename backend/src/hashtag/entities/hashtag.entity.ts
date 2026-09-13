import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type HashtagDocument = HydratedDocument<Hashtag>;

/**
 * Bảng Hashtags
 * - Chuẩn hóa tránh trùng #AI vs #ai
 * - tag_text_lowercase: để query và so sánh
 * - display_text: để hiển thị đúng format user nhập
 */
@Schema({ timestamps: true })
export class Hashtag {
    _id: Types.ObjectId;

    // Normalized lowercase for searching and uniqueness
    // Example: "ai", "javascript", "reactjs"
    @Prop({ required: true, unique: true, index: true })
    tagTextLowercase: string;

    // Original display text preserving case
    // Example: "AI", "JavaScript", "ReactJS"
    @Prop({ required: true })
    displayText: string;

    // Usage count for quick trending queries (denormalized for performance)
    @Prop({ type: Number, default: 0, index: true })
    usageCount: number;

    @Prop()
    createdAt: Date;

    @Prop()
    updatedAt: Date;
}

export const HashtagSchema = SchemaFactory.createForClass(Hashtag);

// Compound index for trending queries (sort by usage, filter by time)
HashtagSchema.index({ usageCount: -1, createdAt: -1 });
HashtagSchema.index({ tagTextLowercase: 1, usageCount: -1 });
