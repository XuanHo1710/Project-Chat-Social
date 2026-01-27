import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

export type UserFeedDocument = HydratedDocument<UserFeed>;

/**
 * UserFeed Schema - Lưu trữ pre-computed feed cho mỗi user
 * 
 * Kiến trúc Fan-out on Write:
 * - Khi user A post bài, bài viết được push vào feed của tất cả followers
 * - Khi user mở app, feed đã sẵn sàng để hiển thị (không cần aggregate)
 */
@Schema({ timestamps: true })
export class UserFeed {
    _id: mongoose.Schema.Types.ObjectId;

    // User sở hữu feed này
    @Prop({ type: mongoose.Schema.Types.ObjectId, required: true, index: true })
    userId: mongoose.Schema.Types.ObjectId;

    // Post ID được thêm vào feed
    @Prop({ type: mongoose.Schema.Types.ObjectId, required: true })
    postId: mongoose.Schema.Types.ObjectId;

    // User tạo post (author)
    @Prop({ type: mongoose.Schema.Types.ObjectId, required: true })
    authorId: mongoose.Schema.Types.ObjectId;

    // Loại action tạo ra entry này
    @Prop({
        type: String,
        enum: ['POST_CREATED', 'POST_SHARED', 'POST_LIKED_BY_FRIEND', 'POST_COMMENTED_BY_FRIEND'],
        required: true
    })
    actionType: string;

    // Điểm ranking cho feed sorting (có thể dựa trên engagement, recency, etc.)
    @Prop({ type: Number, default: 0 })
    score: number;

    // Thời điểm post được tạo (để sort)
    @Prop({ type: Date, required: true })
    postCreatedAt: Date;

    // Đã được user xem chưa
    @Prop({ type: Boolean, default: false })
    isViewed: boolean;

    // Đã bị ẩn khỏi feed chưa
    @Prop({ type: Boolean, default: false })
    isHidden: boolean;

    // Đề xuất bởi hệ thống
    @Prop({ type: Boolean, default: false })
    isRecommended: boolean;

    @Prop()
    createdAt: Date;

    @Prop()
    updatedAt: Date;
}

export const UserFeedSchema = SchemaFactory.createForClass(UserFeed);

// Compound index for efficient feed queries
UserFeedSchema.index({ userId: 1, postCreatedAt: -1 });
UserFeedSchema.index({ userId: 1, postId: 1 }, { unique: true }); // Prevent duplicates
UserFeedSchema.index({ userId: 1, isViewed: 1, postCreatedAt: -1 }); // For unread feed items
