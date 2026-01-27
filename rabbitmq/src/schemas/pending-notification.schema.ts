import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { NotificationType } from './notification.schema';

export type PendingNotificationDocument = HydratedDocument<PendingNotification>;

/**
 * PendingNotification - Lưu trữ các notification đang chờ gửi (aggregation + delay)
 * 
 * Flow:
 * 1. User action -> Backend emit event -> Aggregation Worker nhận
 * 2. Aggregation Worker upsert vào collection này với delay timestamp
 * 3. Sender Worker định kỳ check và gửi những notification đã đến hạn
 */
@Schema({ timestamps: true })
export class PendingNotification {
    _id: mongoose.Schema.Types.ObjectId;

    @Prop({ type: mongoose.Schema.Types.ObjectId, required: true })
    recipientId: mongoose.Schema.Types.ObjectId;

    @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId }], default: [] })
    senderIds: mongoose.Schema.Types.ObjectId[];

    @Prop({ enum: NotificationType, required: true })
    type: NotificationType;

    @Prop({ type: String, required: true })
    title: string;

    @Prop({ type: String, default: '' })
    message: string;

    @Prop({ type: String, default: '' })
    typeReaction: string;

    @Prop({ type: mongoose.Schema.Types.ObjectId })
    groupId?: mongoose.Schema.Types.ObjectId;

    @Prop({ type: mongoose.Schema.Types.ObjectId })
    postId?: mongoose.Schema.Types.ObjectId;

    @Prop({ type: mongoose.Schema.Types.ObjectId })
    commentId?: mongoose.Schema.Types.ObjectId;

    @Prop({ type: Object })
    metadata?: Record<string, any>;

    // Aggregation key: unique identifier để group notifications
    // Format: {type}:{recipientId}:{refId}
    @Prop({ type: String, required: true })
    aggregationKey: string;

    // Thời điểm dự kiến gửi notification
    @Prop({ type: Date, required: true, index: true })
    scheduledSendAt: Date;

    // Đã được xử lý và move sang Notification collection chưa
    @Prop({ type: Boolean, default: false, index: true })
    isSent: boolean;

    @Prop()
    createdAt: Date;

    @Prop()
    updatedAt: Date;
}

export const PendingNotificationSchema = SchemaFactory.createForClass(PendingNotification);

// Indexes for efficient querying
PendingNotificationSchema.index({ isSent: 1, scheduledSendAt: 1 });
PendingNotificationSchema.index({ aggregationKey: 1 });
