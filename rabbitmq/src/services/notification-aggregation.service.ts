import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientProxy } from '@nestjs/microservices';
import { Model, PipelineStage, Types } from 'mongoose';
import { lastValueFrom } from 'rxjs';
import { PermanentEventError } from '../common/event-validation';
import { NotificationEventDto, NotificationType } from '../dto/notification.dto';
import { Account, AccountDocument } from '../schemas/account.schema';
import {
  Notification,
  NotificationDocument,
  NotificationStatus,
} from '../schemas/notification.schema';
import { EventInboxService, EventLeaseBusyError } from './event-inbox.service';
import { FirebaseService } from './firebase.service';

@Injectable()
export class NotificationAggregationService {
  private readonly logger = new Logger(NotificationAggregationService.name);
  private readonly aggregatableTypes = new Set<NotificationType>([
    NotificationType.POST_REACTED,
    NotificationType.POST_COMMENTED,
    NotificationType.COMMENT_REACTED,
    NotificationType.COMMENT_REPLIED,
    NotificationType.POST_SHARED,
  ]);

  constructor(
    @InjectModel(Account.name)
    private readonly accountModel: Model<AccountDocument>,
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @Inject('BACKEND_SERVICE')
    private readonly backendService: ClientProxy,
    private readonly eventInbox: EventInboxService,
    private readonly firebaseService: FirebaseService
  ) {}

  async processNotificationEvent(event: NotificationEventDto, eventId: string): Promise<void> {
    const state = await this.eventInbox.begin(eventId, 'notification.created');
    if (state.completed || state.deadLettered) return;
    if (!state.claimed) throw new EventLeaseBusyError(eventId);
    const recipientExists = await this.accountModel.exists({
      _id: new Types.ObjectId(event.recipientId),
      status: 'ACTIVE',
      isActive: { $ne: false },
      isDeleted: { $ne: true },
      isBlocked: { $ne: true },
    });
    if (!recipientExists) {
      throw new PermanentEventError('Notification recipient is not active');
    }
    if (state.notificationCompleted) {
      await this.eventInbox.complete(eventId);
      return;
    }

    const notification = this.aggregatableTypes.has(event.type)
      ? await this.upsertAggregatedNotification(event)
      : await this.createNotification(event, eventId);

    await this.emitSocketNotification(notification, event.recipientId);
    await this.sendFcmNotification(notification, event.recipientId);
    await this.eventInbox.completeStep(eventId, 'notificationCompleted');
    await this.eventInbox.complete(eventId);
  }

  private async upsertAggregatedNotification(
    event: NotificationEventDto
  ): Promise<NotificationDocument> {
    const aggregationKey = this.buildAggregationKey(event);
    const senderId = event.senderId ? new Types.ObjectId(event.senderId) : undefined;
    const filter = {
      aggregationKey,
      status: NotificationStatus.UNREAD,
      isActive: true,
    };
    const now = new Date();
    const update: PipelineStage[] = [
      {
        $set: {
          recipientId: { $ifNull: ['$recipientId', new Types.ObjectId(event.recipientId)] },
          type: { $ifNull: ['$type', event.type] },
          status: { $ifNull: ['$status', NotificationStatus.UNREAD] },
          isActive: { $ifNull: ['$isActive', true] },
          aggregationKey: { $ifNull: ['$aggregationKey', aggregationKey] },
          title: event.title,
          message: event.message || '',
          typeReaction: event.typeReaction || '',
          metadata: event.metadata || {},
          templateKey: { $ifNull: ['$templateKey', event.templateKey || null] },
          templateParams: { $ifNull: ['$templateParams', event.templateParams || null] },
          groupId: {
            $ifNull: ['$groupId', event.groupId ? new Types.ObjectId(event.groupId) : null],
          },
          postId: {
            $ifNull: ['$postId', event.postId ? new Types.ObjectId(event.postId) : null],
          },
          commentId: {
            $ifNull: ['$commentId', event.commentId ? new Types.ObjectId(event.commentId) : null],
          },
          actionStatus: {
            $ifNull: [
              '$actionStatus',
              event.type === NotificationType.GROUP_INVITATION ? 'PENDING' : null,
            ],
          },
          senderIds: senderId
            ? {
                $slice: [{ $setUnion: [{ $ifNull: ['$senderIds', []] }, [senderId]] }, -50],
              }
            : { $ifNull: ['$senderIds', []] },
          createdAt: { $ifNull: ['$createdAt', now] },
          updatedAt: now,
        },
      },
    ];

    try {
      const notification = await this.notificationModel.findOneAndUpdate(filter, update, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      });
      if (!notification) throw new Error('Unable to upsert aggregated notification');
      return notification;
    } catch (error) {
      if (!this.isDuplicateKeyError(error)) throw error;
      const notification = await this.notificationModel.findOneAndUpdate(filter, update, {
        new: true,
      });
      if (!notification) throw error;
      return notification;
    }
  }

  private async createNotification(
    event: NotificationEventDto,
    eventId: string
  ): Promise<NotificationDocument> {
    const notification = await this.notificationModel.findOneAndUpdate(
      { sourceEventId: eventId },
      {
        $setOnInsert: {
          sourceEventId: eventId,
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
          templateKey: event.templateKey,
          templateParams: event.templateParams,
          status: NotificationStatus.UNREAD,
          isActive: true,
          actionStatus: event.type === NotificationType.GROUP_INVITATION ? 'PENDING' : undefined,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (!notification) throw new Error('Unable to persist notification');
    return notification;
  }

  private async emitSocketNotification(
    notification: NotificationDocument,
    recipientId: string
  ): Promise<void> {
    const [populatedNotification, unreadCount] = await Promise.all([
      this.notificationModel
        .findById(notification._id)
        .select('-sourceEventId -sourceEventIds -aggregationKey')
        .populate('senderIds', 'firstName lastName avatar username')
        .populate('groupId', 'name avatar coverImage')
        .lean(),
      this.notificationModel.countDocuments({
        recipientId: new Types.ObjectId(recipientId),
        status: NotificationStatus.UNREAD,
        isActive: true,
      }),
    ]);
    if (!populatedNotification) throw new Error('Notification disappeared before delivery');

    await lastValueFrom(
      this.backendService.emit('notification.send', {
        recipientId,
        notification: populatedNotification,
        unreadCount,
      }),
      { defaultValue: undefined }
    );
    this.logger.debug(`Delivered notification event to backend for ${recipientId}`);
  }

  private async sendFcmNotification(
    notification: NotificationDocument,
    recipientId: string
  ): Promise<void> {
    try {
      const account = await this.accountModel
        .findOne({
          _id: new Types.ObjectId(recipientId),
          status: 'ACTIVE',
          isActive: { $ne: false },
          isDeleted: { $ne: true },
          isBlocked: { $ne: true },
        })
        .select('fcmTokens')
        .lean();
      const tokens = [...new Set(account?.fcmTokens || [])].slice(0, 20);
      if (tokens.length === 0) return;

      const data: Record<string, string> = {
        type: 'NOTIFICATION',
        notificationId: String(notification._id),
        templateKey: notification.templateKey ?? '',
        templateParams: JSON.stringify(notification.templateParams ?? {}),
      };
      if (notification.postId) data.postId = String(notification.postId);
      if (notification.commentId) data.commentId = String(notification.commentId);
      if (notification.groupId) data.groupId = String(notification.groupId);

      const invalidTokens = await this.firebaseService.sendToDevice(
        tokens,
        notification.title || '',
        notification.message || '',
        data
      );
      if (invalidTokens.length > 0) {
        await this.accountModel.updateMany(
          { fcmTokens: { $in: invalidTokens } },
          { $pull: { fcmTokens: { $in: invalidTokens } } }
        );
      }
    } catch (error) {
      this.logger.warn(
        `FCM delivery failed for notification ${String(notification._id)} / recipient ${recipientId}: ${this.errorMessage(error)}`
      );
    }
  }

  private buildAggregationKey(event: NotificationEventDto): string {
    return [event.recipientId, event.type, event.postId || '', event.commentId || ''].join(':');
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 11000);
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (typeof error === 'number' || typeof error === 'boolean') return String(error);
    return 'Unknown worker error';
  }
}
