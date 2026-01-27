import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PendingNotification, PendingNotificationDocument } from '../schemas/pending-notification.schema';
import { NotificationEventDto, NotificationType } from '../dto/notification.dto';

/**
 * Notification Aggregation Worker
 * 
 * Receives notification events and aggregates them:
 * - Upsert vào pending_notifications collection
 * - Nếu notification đã tồn tại (cùng aggregationKey): thêm sender vào senderIds
 * - Nếu chưa tồn tại: tạo mới với delay timestamp
 */
@Injectable()
export class NotificationAggregationService {
    private readonly logger = new Logger('NotificationAggregation');

    // Delay time in milliseconds before sending aggregated notifications
    // Nếu có nhiều actions liên tục (e.g. nhiều người like), sẽ gom lại thành 1 notification
    private readonly AGGREGATION_DELAY_MS = 5000; // 5 seconds

    // Types that should be aggregated
    private readonly AGGREGATABLE_TYPES = [
        NotificationType.POST_REACTED,
        NotificationType.POST_COMMENTED,
        NotificationType.COMMENT_REACTED,
        NotificationType.COMMENT_REPLIED,
        NotificationType.POST_SHARED,
    ];

    constructor(
        @InjectModel(PendingNotification.name)
        private pendingNotificationModel: Model<PendingNotificationDocument>,
    ) { }

    /**
     * Process incoming notification event
     * Aggregate if applicable, otherwise schedule immediately
     */
    async processNotificationEvent(event: NotificationEventDto): Promise<void> {
        this.logger.log(`Processing notification event: ${event.type} for recipient ${event.recipientId}`);

        // Check if this type should be aggregated
        const shouldAggregate = this.AGGREGATABLE_TYPES.includes(event.type as NotificationType);

        if (shouldAggregate) {
            await this.upsertAggregatedNotification(event);
        } else {
            await this.createImmediateNotification(event);
        }
    }

    /**
     * Generate aggregation key for grouping notifications
     */
    private generateAggregationKey(event: NotificationEventDto): string {
        const { type, recipientId, postId, commentId, senderId } = event;

        // Key format: type:recipientId:refId
        // refId = commentId if exists, else postId
        const refId = commentId || postId || 'none';

        // Check if aggregatable
        if (this.AGGREGATABLE_TYPES.includes(type as NotificationType)) {
            return `${type}:${recipientId}:${refId}`;
        }

        // Non-aggregatable: include senderId and unique timestamp/random
        return `${type}:${recipientId}:${senderId || 'sys'}:${Date.now()}:${Math.random().toString(36).substring(7)}`;
    }

    /**
     * Upsert aggregated notification
     * If exists: add sender to senderIds and extend delay
     * If not exists: create new with delay
     */
    private async upsertAggregatedNotification(event: NotificationEventDto): Promise<void> {
        const aggregationKey = this.generateAggregationKey(event);
        const scheduledSendAt = new Date(Date.now() + this.AGGREGATION_DELAY_MS);

        const senderId = event.senderId ? new Types.ObjectId(event.senderId) : null;

        // Find existing pending notification
        const existing = await this.pendingNotificationModel.findOne({
            aggregationKey,
            isSent: false,
        });

        if (existing) {
            // Check if sender already exists
            const senderExists = senderId && existing.senderIds.some(
                (id) => id.toString() === senderId.toString()
            );

            if (senderExists) {
                // Move sender to end (most recent)
                await this.pendingNotificationModel.updateOne(
                    { _id: existing._id },
                    {
                        $pull: { senderIds: senderId },
                    }
                );
            }

            // Add sender to end and extend delay
            await this.pendingNotificationModel.updateOne(
                { _id: existing._id },
                {
                    $push: { senderIds: senderId },
                    $set: {
                        scheduledSendAt,
                        message: event.message || existing.message,
                        typeReaction: event.typeReaction || existing.typeReaction,
                    },
                }
            );

            this.logger.log(`Updated existing aggregated notification: ${aggregationKey}`);
        } else {
            // Create new pending notification
            const pending = new this.pendingNotificationModel({
                recipientId: new Types.ObjectId(event.recipientId),
                senderIds: senderId ? [senderId] : [],
                type: event.type,
                title: event.title,
                message: event.message || '',
                typeReaction: event.typeReaction || '',
                groupId: event.groupId ? new Types.ObjectId(event.groupId) : undefined,
                postId: event.postId ? new Types.ObjectId(event.postId) : undefined,
                commentId: event.commentId ? new Types.ObjectId(event.commentId) : undefined,
                metadata: event.metadata,
                aggregationKey,
                scheduledSendAt,
                isSent: false,
            });

            await pending.save();
            this.logger.log(`Created new pending notification: ${aggregationKey}`);
        }
    }

    /**
     * Create immediate notification (no aggregation)
     * Schedule to be sent immediately
     */
    private async createImmediateNotification(event: NotificationEventDto): Promise<void> {
        const aggregationKey = this.generateAggregationKey(event);
        const scheduledSendAt = new Date(); // Send immediately

        // Check if already exists (shouldn't for non-aggregatable types, but safe check)
        const existing = await this.pendingNotificationModel.findOne({
            aggregationKey,
            isSent: false,
        });

        if (existing) {
            this.logger.warn(`Duplicate notification event for key: ${aggregationKey}, skipping`);
            return;
        }

        const pending = new this.pendingNotificationModel({
            recipientId: new Types.ObjectId(event.recipientId),
            senderIds: event.senderId ? [new Types.ObjectId(event.senderId)] : [],
            type: event.type,
            title: event.title,
            message: event.message || '',
            typeReaction: event.typeReaction || '',
            groupId: event.groupId ? new Types.ObjectId(event.groupId) : undefined,
            postId: event.postId ? new Types.ObjectId(event.postId) : undefined,
            commentId: event.commentId ? new Types.ObjectId(event.commentId) : undefined,
            metadata: event.metadata,
            aggregationKey,
            scheduledSendAt,
            isSent: false,
        });

        await pending.save();
        this.logger.log(`Created immediate notification: ${aggregationKey}`);
    }
}
