import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';
import { Account } from 'src/account/entities/account.entity';
import { Group } from 'src/group/entities/group.entity';

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

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Account.name })
  senderId: mongoose.Schema.Types.ObjectId; // Who triggered the notification (optional for system)

  @Prop({ enum: NotificationType, required: true })
  type: NotificationType;

  @Prop({ enum: NotificationStatus, default: NotificationStatus.UNREAD })
  status: NotificationStatus;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, default: '' })
  message: string;

  // Reference data for different notification types
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Group.name })
  groupId?: mongoose.Schema.Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId })
  postId?: mongoose.Schema.Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId })
  commentId?: mongoose.Schema.Types.ObjectId;

  // For group invitation - to track the invitation status
  @Prop({ type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED'], default: 'PENDING' })
  actionStatus?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Indexes
NotificationSchema.index({ recipientId: 1, status: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, type: 1 });
NotificationSchema.index({ groupId: 1, type: 1 });
