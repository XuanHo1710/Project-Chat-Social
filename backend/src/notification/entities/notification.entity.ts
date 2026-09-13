import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';
import { Account } from 'src/account/entities/account.entity';
import { Comment } from 'src/comment/entities/comment.entity';
import { Group } from 'src/group/entities/group.entity';
import { Post } from 'src/post/entities/post.entity';

export type NotificationDocument = HydratedDocument<Notification>;

export enum NotificationType {
  // Group notifications
  GROUP_INVITATION = 'GROUP_INVITATION', // You've been invited to join a group
  GROUP_REQUEST_APPROVED = 'GROUP_REQUEST_APPROVED', // Your join request was approved
  GROUP_REQUEST_REJECTED = 'GROUP_REQUEST_REJECTED', // Your join request was rejected
  GROUP_ROLE_CHANGED = 'GROUP_ROLE_CHANGED', // Your role in a group was changed
  GROUP_OWNERSHIP_TRANSFERRED = 'GROUP_OWNERSHIP_TRANSFERRED', // Group ownership transferred to you
  // Post notifications
  POST_COMMENTED = 'POST_COMMENTED', // Someone commented on your post
  POST_REACTED = 'POST_REACTED', // Someone reacted to your post
  POST_SHARED = 'POST_SHARED', // Someone shared your post
  // Comment notifications
  COMMENT_REPLIED = 'COMMENT_REPLIED', // Someone replied to your comment
  COMMENT_REACTED = 'COMMENT_REACTED', // Someone reacted to your comment
  // Relationship notifications
  FRIEND_REQUEST = 'FRIEND_REQUEST', // Someone sent you a friend request
  FRIEND_ACCEPTED = 'FRIEND_ACCEPTED', // Someone accepted your friend request
  // System notifications
  SYSTEM = 'SYSTEM', // System notification
}

export enum NotificationStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
}

@Schema({ timestamps: true })
export class Notification {
  _id: mongoose.Schema.Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Account.name, required: true })
  recipientId: mongoose.Schema.Types.ObjectId; // Who receives the notification

  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: Account.name }], default: [] })
  senderIds: mongoose.Schema.Types.ObjectId[]; // Users who triggered the notification (array for aggregated notifications like "A, B, C liked your post")

  @Prop({ enum: NotificationType, required: true })
  type: NotificationType;

  @Prop({ enum: NotificationStatus, default: NotificationStatus.UNREAD })
  status: NotificationStatus;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, default: '' })
  message: string;

  // i18n template key (title key, e.g. "notifications.post_reacted"; body key = key + "_message")
  @Prop({ type: String })
  templateKey?: string;

  // i18n template params (e.g. senderName, otherCount, groupName, roleName, postPreview, commentPreview, reactionType)
  @Prop({ type: Object })
  templateParams?: Record<string, string | number>;

  // Để hiện thị cảm xúc gì trong thông báo
  @Prop({ type: String, default: '' })
  typeReaction: string;

  @Prop({ select: false })
  aggregationKey?: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;

  @Prop({ type: String, select: false })
  sourceEventId?: string;

  @Prop({ type: [String], default: undefined, select: false })
  sourceEventIds?: string[];

  // Reference data for different notification types
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Group.name })
  groupId?: mongoose.Schema.Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Post.name })
  postId?: mongoose.Schema.Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Comment.name })
  commentId?: mongoose.Schema.Types.ObjectId;

  // For group invitation - to track the invitation status
  @Prop({ type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED'], default: 'PENDING' })
  actionStatus?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Indexes
NotificationSchema.index({ recipientId: 1, isActive: 1, status: 1, updatedAt: -1 });
NotificationSchema.index({ recipientId: 1, type: 1 });
NotificationSchema.index({ groupId: 1, type: 1 });
// Index for aggregated notifications lookup (find existing notification to update instead of creating new)
NotificationSchema.index({ recipientId: 1, type: 1, postId: 1, commentId: 1 });
NotificationSchema.index(
  { aggregationKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      aggregationKey: { $type: 'string' },
      status: NotificationStatus.UNREAD,
      isActive: true,
    },
  },
);
NotificationSchema.index(
  { sourceEventId: 1 },
  { unique: true, partialFilterExpression: { sourceEventId: { $type: 'string' } } },
);
