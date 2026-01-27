import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ClientProxy } from '@nestjs/microservices';
import { PendingNotification, PendingNotificationDocument } from '../schemas/pending-notification.schema';
import { Notification, NotificationDocument, NotificationStatus } from '../schemas/notification.schema';
import { Account, AccountDocument } from '../schemas/account.schema';

/**
 * Notification Sender Worker
 * 
 * Định kỳ check pending notifications và gửi những notification đã đến hạn:
 * 1. Query pending notifications where scheduledSendAt <= now AND isSent = false
 * 2. Upsert vào Notification collection (aggregate with existing if needed)
 * 3. Emit socket event về Backend để broadcast cho user
 * 4. Mark pending as sent
 */
@Injectable()
export class NotificationSenderService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger('NotificationSender');
    private intervalId: NodeJS.Timeout;

    // Check interval in milliseconds
    private readonly CHECK_INTERVAL_MS = 2000; // 2 seconds

    // Types that should be aggregated in final notification
    private readonly AGGREGATABLE_TYPES = [
        'POST_REACTED',
        'POST_COMMENTED',
        'COMMENT_REACTED',
        'COMMENT_REPLIED',
        'POST_SHARED',
    ];

    constructor(
        @InjectModel(PendingNotification.name)
        private pendingNotificationModel: Model<PendingNotificationDocument>,
        @InjectModel(Notification.name)
        private notificationModel: Model<NotificationDocument>,
        @InjectModel(Account.name)
        private accountModel: Model<AccountDocument>,
        @Inject('BACKEND_SERVICE')
        private readonly backendService: ClientProxy,
    ) { }

    onModuleInit() {
        this.logger.log('Starting notification sender worker...');
        this.startWorker();
    }

    onModuleDestroy() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }

    private startWorker() {
        this.intervalId = setInterval(async () => {
            try {
                await this.processPendingNotifications();
            } catch (error) {
                this.logger.error('Error processing pending notifications:', error);
            }
        }, this.CHECK_INTERVAL_MS);
    }

    /**
     * Process all pending notifications that are ready to be sent
     */
    private async processPendingNotifications(): Promise<void> {
        const now = new Date();

        // Find all pending notifications that are due
        const pendingNotifications = await this.pendingNotificationModel.find({
            isSent: false,
            scheduledSendAt: { $lte: now },
        }).limit(50); // Process in batches

        if (pendingNotifications.length === 0) {
            return;
        }

        this.logger.log(`Processing ${pendingNotifications.length} pending notifications`);

        for (const pending of pendingNotifications) {
            try {
                await this.sendNotification(pending);
            } catch (error) {
                this.logger.error(`Error sending notification ${pending._id}:`, error);
            }
        }
    }

    /**
     * Send a pending notification:
     * 1. Upsert to Notification collection
     * 2. Emit socket event to Backend
     * 3. Mark as sent
     */
    private async sendNotification(pending: PendingNotificationDocument): Promise<void> {
        const isAggregatable = this.AGGREGATABLE_TYPES.includes(pending.type);

        let notification: NotificationDocument;

        if (isAggregatable) {
            // Upsert: find existing notification and update, or create new
            notification = await this.upsertAggregatedNotification(pending);
        } else {
            // Create new notification directly
            notification = await this.createNotification(pending);
        }

        // Populate sender info for socket emission
        const populatedNotification = await this.notificationModel
            .findById(notification._id)
            .populate('senderIds', 'firstName lastName avatar username')
            .populate('groupId', 'name avatar coverImage')
            .lean();

        // Get unread count
        const unreadCount = await this.notificationModel.countDocuments({
            recipientId: pending.recipientId,
            status: NotificationStatus.UNREAD,
            isActive: true,
        });

        // Emit to Backend for socket broadcast
        this.backendService.emit('notification.send', {
            recipientId: pending.recipientId.toString(),
            notification: populatedNotification,
            unreadCount,
        });

        this.logger.log(`Sent notification to user ${pending.recipientId}`);

        // Mark pending as sent
        await this.pendingNotificationModel.updateOne(
            { _id: pending._id },
            { $set: { isSent: true } }
        );
    }

    /**
     * Upsert aggregated notification
     * Find existing by type + postId/commentId + recipientId, update senderIds
     */
    private async upsertAggregatedNotification(pending: PendingNotificationDocument): Promise<NotificationDocument> {
        const filter: any = {
            recipientId: pending.recipientId,
            type: pending.type,
            isActive: true,
        };

        if (pending.postId) {
            filter.postId = pending.postId;
        }
        if (pending.commentId) {
            filter.commentId = pending.commentId;
        }

        const existing = await this.notificationModel.findOne(filter);

        if (existing) {
            // Merge senderIds from pending into existing
            const existingSenderIds = existing.senderIds.map((id) => id.toString());
            const newSenderIds = pending.senderIds.map((id) => id.toString());

            // Create unique merged list, with new senders at the end
            const mergedSenderIds = [...new Set([...existingSenderIds, ...newSenderIds])];

            await this.notificationModel.updateOne(
                { _id: existing._id },
                {
                    $set: {
                        senderIds: mergedSenderIds.map((id) => new Types.ObjectId(id)),
                        status: NotificationStatus.UNREAD,
                        message: pending.message || existing.message,
                        typeReaction: pending.typeReaction || existing.typeReaction,
                        updatedAt: new Date(),
                    },
                }
            );

            return (await this.notificationModel.findById(existing._id))!;
        } else {
            return this.createNotification(pending);
        }
    }

    /**
     * Create new notification from pending
     */
    private async createNotification(pending: PendingNotificationDocument): Promise<NotificationDocument> {
        const notification = new this.notificationModel({
            recipientId: pending.recipientId,
            senderIds: pending.senderIds,
            type: pending.type,
            title: pending.title,
            message: pending.message,
            typeReaction: pending.typeReaction,
            groupId: pending.groupId,
            postId: pending.postId,
            commentId: pending.commentId,
            metadata: pending.metadata,
            status: NotificationStatus.UNREAD,
            isActive: true,
            actionStatus: pending.type === 'GROUP_INVITATION' ? 'PENDING' : undefined,
        });

        return notification.save();
    }
}
