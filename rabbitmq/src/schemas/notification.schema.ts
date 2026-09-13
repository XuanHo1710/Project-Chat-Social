import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

export enum NotificationType {
  GROUP_INVITATION = 'GROUP_INVITATION',
  GROUP_REQUEST_APPROVED = 'GROUP_REQUEST_APPROVED',
  GROUP_REQUEST_REJECTED = 'GROUP_REQUEST_REJECTED',
  GROUP_ROLE_CHANGED = 'GROUP_ROLE_CHANGED',
  GROUP_OWNERSHIP_TRANSFERRED = 'GROUP_OWNERSHIP_TRANSFERRED',
  POST_COMMENTED = 'POST_COMMENTED',
  POST_REACTED = 'POST_REACTED',
  POST_SHARED = 'POST_SHARED',
  COMMENT_REPLIED = 'COMMENT_REPLIED',
  COMMENT_REACTED = 'COMMENT_REACTED',
  FRIEND_REQUEST = 'FRIEND_REQUEST',
  FRIEND_ACCEPTED = 'FRIEND_ACCEPTED',
  SYSTEM = 'SYSTEM',
}

export enum NotificationStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
}

@Schema({ timestamps: true })
export class Notification {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Account', required: true })
  recipientId: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Account' }], default: [] })
  senderIds: Types.ObjectId[];

  @Prop({ enum: NotificationType, required: true })
  type: NotificationType;

  @Prop({ enum: NotificationStatus, default: NotificationStatus.UNREAD })
  status: NotificationStatus;

  @Prop({ type: String, required: true, maxlength: 160 })
  title: string;

  @Prop({ type: String, default: '', maxlength: 1_000 })
  message: string;

  @Prop({ type: String, maxlength: 200 })
  templateKey?: string;

  @Prop({ type: Object })
  templateParams?: Record<string, string | number>;

  @Prop({ type: String, default: '', maxlength: 32 })
  typeReaction: string;

  @Prop({ type: Types.ObjectId, ref: 'Group' })
  groupId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Post' })
  postId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Comment' })
  commentId?: Types.ObjectId;

  @Prop({ type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED'], default: 'PENDING' })
  actionStatus?: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;

  @Prop({ type: String, select: false, maxlength: 200 })
  sourceEventId?: string;

  @Prop({ type: String, select: false, maxlength: 400 })
  aggregationKey?: string;

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
NotificationSchema.index({ recipientId: 1, type: 1, postId: 1, commentId: 1 });
NotificationSchema.index(
  { sourceEventId: 1 },
  { unique: true, partialFilterExpression: { sourceEventId: { $type: 'string' } } }
);
NotificationSchema.index(
  { aggregationKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      aggregationKey: { $type: 'string' },
      status: NotificationStatus.UNREAD,
      isActive: true,
    },
  }
);
