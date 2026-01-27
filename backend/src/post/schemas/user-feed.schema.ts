import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserFeedDocument = UserFeed & Document;

@Schema({ timestamps: true, collection: 'user_feeds' })
export class UserFeed {
    @Prop({ type: Types.ObjectId, required: true, index: true })
    userId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, required: true })
    postId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, required: true })
    authorId: Types.ObjectId;

    // Loại hành động: POST_CREATED, POST_SHARED, POST_LIKED, POST_COMMENTED...
    @Prop({ required: true })
    actionType: string;

    // Điểm số để ranking (EdgeRank)
    @Prop({ default: 0, index: true })
    score: number;

    @Prop()
    postCreatedAt: Date;

    @Prop({ default: false })
    isViewed: boolean;

    @Prop({ default: false })
    isHidden: boolean;

    @Prop({ default: false })
    isRecommended: boolean;
}

export const UserFeedSchema = SchemaFactory.createForClass(UserFeed);

// Composite indexes for efficient querying
UserFeedSchema.index({ userId: 1, postCreatedAt: -1 });
UserFeedSchema.index({ userId: 1, score: -1 });
UserFeedSchema.index({ userId: 1, postId: 1 }, { unique: true });
UserFeedSchema.index({ userId: 1, isViewed: 1, postCreatedAt: -1 });
