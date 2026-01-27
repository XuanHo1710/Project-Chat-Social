import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

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
    _id: mongoose.Schema.Types.ObjectId;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true })
    recipientId: mongoose.Schema.Types.ObjectId;

    @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Account' }], default: [] })
    senderIds: mongoose.Schema.Types.ObjectId[];

    @Prop({ enum: NotificationType, required: true })
    type: NotificationType;

    @Prop({ enum: NotificationStatus, default: NotificationStatus.UNREAD })
    status: NotificationStatus;

    @Prop({ type: String, required: true })
    title: string;

    @Prop({ type: String, default: '' })
    message: string;

    @Prop({ type: String, default: '' })
    typeReaction: string;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Group' })
    groupId?: mongoose.Schema.Types.ObjectId;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Post' })
    postId?: mongoose.Schema.Types.ObjectId;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' })
    commentId?: mongoose.Schema.Types.ObjectId;

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
NotificationSchema.index({ recipientId: 1, type: 1, postId: 1, commentId: 1 });
