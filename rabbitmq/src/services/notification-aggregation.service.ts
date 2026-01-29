import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ClientProxy } from '@nestjs/microservices';
import { NotificationEventDto, NotificationType } from '../dto/notification.dto';
import { Notification, NotificationDocument, NotificationStatus } from '../schemas/notification.schema';

/**
 * Notification Service
 * 
 * Handles incoming notification events, aggregates them if needed (direct database update),
 * and emits socket events to the backend.
 */
@Injectable()
export class NotificationAggregationService {
    private readonly logger = new Logger('NotificationService');

    // Types that should be aggregated
    private readonly AGGREGATABLE_TYPES = [
        NotificationType.POST_REACTED,
        NotificationType.POST_COMMENTED,
        NotificationType.COMMENT_REACTED,
        NotificationType.COMMENT_REPLIED,
        NotificationType.POST_SHARED,
    ];

    constructor(
        @InjectModel(Notification.name)
        private notificationModel: Model<NotificationDocument>,
        @Inject('BACKEND_SERVICE')
        private readonly backendService: ClientProxy,
    ) { }

    /**
     * Process incoming notification event
     */
    async processNotificationEvent(event: NotificationEventDto): Promise<void> {
        this.logger.log(`Processing notification event: ${event.type} for recipient ${event.recipientId}`);

        try {
            const shouldAggregate = this.AGGREGATABLE_TYPES.includes(event.type as NotificationType);
            let notification: NotificationDocument;

            if (shouldAggregate) {
                notification = await this.upsertAggregatedNotification(event);
            } else {
                notification = await this.createNotification(event);
            }

            // Broadcast to user via Backend Socket
            await this.emitSocketNotification(notification, event.recipientId);

        } catch (error) {
            this.logger.error('Error processing notification:', error);
        }
    }

    /**
     * Upsert aggregated notification (update existing if found, else create)
     */
    private async upsertAggregatedNotification(event: NotificationEventDto): Promise<NotificationDocument> {
        const filter: any = {
            recipientId: new Types.ObjectId(event.recipientId),
            type: event.type,
            isActive: true,
        };

        if (event.postId) filter.postId = new Types.ObjectId(event.postId);
        if (event.commentId) filter.commentId = new Types.ObjectId(event.commentId);

        // Find existing recent notification (e.g., within last 24h or just last active unread)
        // For simplicity, we find any active unread check
        const existing = await this.notificationModel.findOne({
            ...filter,
            status: NotificationStatus.UNREAD
        });

        if (existing) {
            // Append new sender
            const newSenderId = event.senderId ? event.senderId.toString() : null;
            if (newSenderId) {
                const existingSenders = existing.senderIds.map(id => id.toString());
                if (!existingSenders.includes(newSenderId)) {
                    // Add to front or end? Usually recent is better.
                    // But schema is array. Let's push.
                    await this.notificationModel.updateOne(
                        { _id: existing._id },
                        {
                            $addToSet: { senderIds: new Types.ObjectId(newSenderId) },
                            $set: { updatedAt: new Date() }
                        }
                    );
                } else {
                    // Just update time
                    await this.notificationModel.updateOne({ _id: existing._id }, { updatedAt: new Date() });
                }
            }
            return (await this.notificationModel.findById(existing._id))!;
        } else {
            return this.createNotification(event);
        }
    }

    /**
     * Create new notification
     */
    private async createNotification(event: NotificationEventDto): Promise<NotificationDocument> {
        const notification = new this.notificationModel({
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
            status: NotificationStatus.UNREAD,
            isActive: true,
            actionStatus: event.type === 'GROUP_INVITATION' ? 'PENDING' : undefined,
        });

        return notification.save();
    }

    /**
     * Emit socket event to Backend
     */
    private async emitSocketNotification(notification: NotificationDocument, recipientId: string): Promise<void> {
        const populatedNotification = await this.notificationModel
            .findById(notification._id)
            .populate('senderIds', 'firstName lastName avatar username')
            .populate('groupId', 'name avatar coverImage')
            .lean();

        const unreadCount = await this.notificationModel.countDocuments({
            recipientId: new Types.ObjectId(recipientId) as any,
            status: NotificationStatus.UNREAD,
            isActive: true,
        });

        this.backendService.emit('notification.send', {
            recipientId: recipientId,
            notification: populatedNotification,
            unreadCount,
        });

        this.logger.log(`Emitted notification.send for user ${recipientId}`);
    }
}
