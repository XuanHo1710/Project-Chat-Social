import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserInteractionDocument = HydratedDocument<UserInteraction>;

/**
 * UserInteraction Schema - Lưu trữ tất cả interactions của users
 *
 * Dùng cho:
 * - Analytics và recommendations
 * - Tracking engagement
 * - Building user behavior profiles
 */
@Schema({ timestamps: true })
export class UserInteraction {
  _id: Types.ObjectId;

  // Stable broker identity used to make redelivery idempotent.
  @Prop({ type: String, required: true, maxlength: 200 })
  eventId: string;

  // User thực hiện action
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  // Loại interaction
  @Prop({
    type: String,
    enum: [
      'POST_VIEW',
      'POST_LIKE',
      'POST_UNLIKE',
      'POST_COMMENT',
      'POST_SHARE',
      'POST_SAVE',
      'POST_UNSAVE',
      'POST_HIDE',
      'POST_REPORT',
      'USER_FOLLOW',
      'USER_UNFOLLOW',
      'STORY_VIEW',
      'REEL_VIEW',
      'REEL_LIKE',
      'SEARCH',
      'CLICK_PROFILE',
      'TIME_SPENT', // Time spent on content
    ],
    required: true,
  })
  interactionType: string;

  // Target của interaction (có thể là postId, userId, etc.)
  @Prop({ type: Types.ObjectId })
  targetId?: Types.ObjectId;

  // Loại target
  @Prop({
    type: String,
    enum: ['POST', 'USER', 'COMMENT', 'STORY', 'REEL', 'SEARCH'],
  })
  targetType?: string;

  // Metadata bổ sung
  @Prop({ type: Object })
  metadata?: {
    reactionType?: string; // LIKE, LOVE, HAHA, etc.
    commentContent?: string; // Preview of comment
    searchQuery?: string; // Search term
    timeSpentSeconds?: number; // Time spent viewing
    source?: string; // Where the action originated (feed, profile, search, etc.)
    deviceType?: string; // mobile, desktop, tablet
  };

  // Timestamp của event gốc
  @Prop({ type: Date, required: true })
  eventTimestamp: Date;

  @Prop({ type: Boolean, default: false })
  aiSynced: boolean;

  @Prop()
  createdAt: Date;
}

export const UserInteractionSchema =
  SchemaFactory.createForClass(UserInteraction);

// Indexes for analytics queries
UserInteractionSchema.index({ userId: 1, interactionType: 1, createdAt: -1 });
UserInteractionSchema.index({ targetId: 1, interactionType: 1 });
UserInteractionSchema.index({ createdAt: -1 }); // For time-based analytics
UserInteractionSchema.index({ interactionType: 1, createdAt: -1 }); // For aggregation by type
UserInteractionSchema.index(
  { eventId: 1 },
  { unique: true, partialFilterExpression: { eventId: { $type: 'string' } } },
);
