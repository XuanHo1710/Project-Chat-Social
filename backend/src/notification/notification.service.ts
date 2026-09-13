import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
  NotificationType,
  NotificationStatus,
} from './entities/notification.entity';
import { CreateNotificationDto } from './dto/notification.dto';
import { GroupService } from 'src/group/group.service';
import { NotificationGateway } from 'src/notification/notification.gateway';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @Inject(forwardRef(() => GroupService))
    private groupService: GroupService,
    @Inject(forwardRef(() => NotificationGateway))
    private notificationGateway: NotificationGateway
  ) { }

  // Notification types that should be aggregated (combined into one notification)
  // Instead of creating multiple notifications like "A liked your post", "B liked your post"
  // We combine them into one: "A, B, C liked your post"
  private readonly AGGREGATABLE_TYPES = [
    NotificationType.POST_REACTED,
    NotificationType.POST_COMMENTED,
    NotificationType.COMMENT_REACTED,
    NotificationType.COMMENT_REPLIED,
    NotificationType.POST_SHARED,
  ];

  private objectId(value: string, label: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`${label} không hợp lệ`);
    }
    return new Types.ObjectId(value);
  }

  private validateCreateDto(dto: CreateNotificationDto): void {
    this.objectId(dto.recipientId, 'Recipient ID');
    if (dto.senderId) this.objectId(dto.senderId, 'Sender ID');
    if (dto.groupId) this.objectId(dto.groupId, 'Group ID');
    if (dto.postId) this.objectId(dto.postId, 'Post ID');
    if (dto.commentId) this.objectId(dto.commentId, 'Comment ID');
    if (!Object.values(NotificationType).includes(dto.type)) {
      throw new BadRequestException('Notification type không hợp lệ');
    }
    if (!dto.title?.trim() || dto.title.length > 200 || (dto.message?.length || 0) > 1000) {
      throw new BadRequestException('Notification content không hợp lệ');
    }
    if (dto.metadata && JSON.stringify(dto.metadata).length > 10_000) {
      throw new BadRequestException('Notification metadata quá lớn');
    }
    if (dto.templateParams && JSON.stringify(dto.templateParams).length > 4_000) {
      throw new BadRequestException('Notification templateParams quá lớn');
    }
  }

  // Create or update a notification (aggregates notifications for same action on same content)
  async create(dto: CreateNotificationDto): Promise<any> {
    this.validateCreateDto(dto);
    // Check if this notification type should be aggregated
    if (this.AGGREGATABLE_TYPES.includes(dto.type)) {
      return this.createOrUpdateAggregatedNotification(dto);
    }

    // For non-aggregatable notifications, create normally
    return this.createNewNotification(dto);
  }

  // Create new notification (for non-aggregatable types)
  private async createNewNotification(dto: CreateNotificationDto): Promise<any> {
    const notification = new this.notificationModel({
      recipientId: this.objectId(dto.recipientId, 'Recipient ID'),
      senderIds: dto.senderId ? [this.objectId(dto.senderId, 'Sender ID')] : [],
      type: dto.type,
      title: dto.title.trim(),
      message: dto.message?.trim() || '',
      groupId: dto.groupId ? this.objectId(dto.groupId, 'Group ID') : undefined,
      postId: dto.postId ? this.objectId(dto.postId, 'Post ID') : undefined,
      commentId: dto.commentId ? this.objectId(dto.commentId, 'Comment ID') : undefined,
      metadata: dto.metadata,
      actionStatus: dto.type === NotificationType.GROUP_INVITATION ? 'PENDING' : undefined,
      typeReaction: dto.typeReaction,
      templateKey: dto.templateKey,
      templateParams: dto.templateParams,
    });

    await notification.save();
    return this.emitNotification(dto.recipientId, notification._id);
  }

  // Create or update aggregated notification
  // Find existing notification by type + postId/commentId + recipientId
  // If exists: add sender to senderIds array
  // If not exists: create new notification
  private async createOrUpdateAggregatedNotification(dto: CreateNotificationDto): Promise<any> {
    const aggregationKey = [
      dto.recipientId,
      dto.type,
      dto.postId || '',
      dto.commentId || '',
    ].join(':');
    const recipientId = this.objectId(dto.recipientId, 'Recipient ID');
    const senderId = dto.senderId ? this.objectId(dto.senderId, 'Sender ID') : undefined;
    const now = new Date();
    const update = [
      {
        $set: {
          aggregationKey: { $ifNull: ['$aggregationKey', aggregationKey] },
          recipientId: { $ifNull: ['$recipientId', recipientId] },
          type: { $ifNull: ['$type', dto.type] },
          groupId: {
            $ifNull: ['$groupId', dto.groupId ? this.objectId(dto.groupId, 'Group ID') : null],
          },
          postId: {
            $ifNull: ['$postId', dto.postId ? this.objectId(dto.postId, 'Post ID') : null],
          },
          commentId: {
            $ifNull: ['$commentId', dto.commentId ? this.objectId(dto.commentId, 'Comment ID') : null],
          },
          metadata: { $ifNull: ['$metadata', dto.metadata || {}] },
          templateKey: { $ifNull: ['$templateKey', dto.templateKey || null] },
          templateParams: { $ifNull: ['$templateParams', dto.templateParams || null] },
          senderIds: senderId
            ? {
                $slice: [{ $setUnion: [{ $ifNull: ['$senderIds', []] }, [senderId]] }, -50],
              }
            : { $ifNull: ['$senderIds', []] },
          title: dto.title.trim(),
          message: dto.message?.trim() || '',
          typeReaction: dto.typeReaction || '',
          status: NotificationStatus.UNREAD,
          isActive: true,
          createdAt: { $ifNull: ['$createdAt', now] },
          updatedAt: now,
        },
      },
    ];

    const filter = {
      aggregationKey,
      status: NotificationStatus.UNREAD,
      isActive: true,
    };
    let notification: NotificationDocument | null;
    try {
      notification = await this.notificationModel.findOneAndUpdate(filter, update, {
        upsert: true,
        new: true,
      });
    } catch (error) {
      const duplicateKey =
        !!error && typeof error === 'object' && 'code' in error && error.code === 11000;
      if (!duplicateKey) throw error;
      notification = await this.notificationModel.findOneAndUpdate(filter, update, { new: true });
    }
    if (!notification) {
      throw new BadRequestException('Unable to aggregate notification');
    }
    return this.emitNotification(dto.recipientId, notification._id);
  }

  // Helper to populate and emit notification
  private async emitNotification(recipientId: string, notificationId: any): Promise<any> {
    const populatedNotification = await this.notificationModel
      .findById(notificationId)
      .populate('senderIds', 'firstName lastName avatar username')
      .populate('groupId', 'name avatar coverImage')
      .lean();

    if (!populatedNotification) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    const unreadCount = await this.notificationModel.countDocuments({
      recipientId: new Types.ObjectId(recipientId),
      status: NotificationStatus.UNREAD,
      isActive: true,
    });

    // Emit real-time notification
    this.notificationGateway.sendNotification(recipientId, populatedNotification);
    this.notificationGateway.sendUnreadCountUpdate(recipientId, unreadCount);

    return populatedNotification;
  }

  async getBrokerNotification(notificationId: string, recipientId: string): Promise<{
    notification: Record<string, unknown>;
    unreadCount: number;
  }> {
    const notificationObjectId = this.objectId(notificationId, 'Notification ID');
    const recipientObjectId = this.objectId(recipientId, 'Recipient ID');
    const [notification, unreadCount] = await Promise.all([
      this.notificationModel
        .findOne({
          _id: notificationObjectId,
          recipientId: recipientObjectId,
          isActive: true,
        })
        .populate('senderIds', 'firstName lastName avatar username')
        .populate('groupId', 'name avatar coverImage')
        .lean(),
      this.notificationModel.countDocuments({
        recipientId: recipientObjectId,
        status: NotificationStatus.UNREAD,
        isActive: true,
      }),
    ]);
    if (!notification) {
      throw new NotFoundException('Broker notification was not found');
    }
    return {
      notification: notification as unknown as Record<string, unknown>,
      unreadCount,
    };
  }

  // Get user notifications
  async getUserNotifications(
    userId: string,
    page = 1,
    limit = 20,
    status?: string,
    type?: string
  ): Promise<any> {
    const userObjectId = this.objectId(userId, 'User ID');
    page = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
    limit = Number.isFinite(limit) ? Math.min(100, Math.max(1, Math.floor(limit))) : 20;
    const skip = (page - 1) * limit;

    // Build filter query
    const filter: any = {
      recipientId: userObjectId,
      isActive: true,
    };

    // Add status filter if provided
    if (status && Object.values(NotificationStatus).includes(status as NotificationStatus)) {
      filter.status = status;
    } else if (status) {
      throw new BadRequestException('Notification status không hợp lệ');
    }

    // Add type filter if provided
    if (type && Object.values(NotificationType).includes(type as NotificationType)) {
      filter.type = type;
    } else if (type) {
      throw new BadRequestException('Notification type không hợp lệ');
    }

    const [notifications, total, unreadCount] = await Promise.all([
      this.notificationModel
        .find(filter)
        .populate('senderIds', 'firstName lastName avatar username')
        .populate('groupId', 'name avatar coverImage')
        .sort({ updatedAt: -1 }) // Sort by updatedAt to show recently updated aggregated notifications first
        .skip(skip)
        .limit(limit)
        .lean(),
      this.notificationModel.countDocuments(filter),
      this.notificationModel.countDocuments({
        recipientId: userObjectId,
        status: NotificationStatus.UNREAD,
        isActive: true,
      }),
    ]);

    return {
      notifications,
      total,
      unreadCount,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Mark notification as read
  async markAsRead(userId: string, notificationId: string) {
    const userObjectId = this.objectId(userId, 'User ID');
    const notificationObjectId = this.objectId(notificationId, 'Notification ID');
    const notification = await this.notificationModel.findOneAndUpdate(
      {
        _id: notificationObjectId,
        recipientId: userObjectId,
        isActive: true,
      },
      { status: NotificationStatus.READ },
      { new: true }
    );

    if (!notification) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    return notification;
  }

  // Mark all notifications as read
  async markAllAsRead(userId: string) {
    const userObjectId = this.objectId(userId, 'User ID');
    await this.notificationModel.updateMany(
      {
        recipientId: userObjectId,
        status: NotificationStatus.UNREAD,
        isActive: true,
      },
      { status: NotificationStatus.READ }
    );

    return { message: 'Đã đánh dấu tất cả là đã đọc' };
  }

  // Delete notification
  async deleteNotification(userId: string, notificationId: string) {
    const result = await this.notificationModel.updateOne(
      {
        _id: this.objectId(notificationId, 'Notification ID'),
        recipientId: this.objectId(userId, 'User ID'),
        isActive: true,
      },
      { $set: { isActive: false } },
    );

    if (result.matchedCount === 0) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    return { message: 'Đã xóa thông báo' };
  }

  async deactivateByPostRef(postId: string): Promise<void> {
    try {
      await this.notificationModel.updateMany(
        { postId: this.objectId(postId, 'Post ID'), isActive: true },
        { $set: { isActive: false } },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to deactivate notifications for post ${postId}: ${error?.message || error}`,
      );
    }
  }

  async deactivateByCommentRef(commentId: string): Promise<void> {
    try {
      await this.notificationModel.updateMany(
        { commentId: this.objectId(commentId, 'Comment ID'), isActive: true },
        { $set: { isActive: false } },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to deactivate notifications for comment ${commentId}: ${error?.message || error}`,
      );
    }
  }

  // Respond to group invitation
  async respondToGroupInvitation(
    userId: string,
    notificationId: string,
    action: 'ACCEPT' | 'REJECT'
  ) {
    const nextActionStatus = action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
    const notification = await this.notificationModel.findOneAndUpdate(
      {
        _id: this.objectId(notificationId, 'Notification ID'),
        recipientId: this.objectId(userId, 'User ID'),
        type: NotificationType.GROUP_INVITATION,
        actionStatus: 'PENDING',
        isActive: true,
      },
      {
        $set: {
          actionStatus: nextActionStatus,
          status: NotificationStatus.READ,
          message:
            action === 'ACCEPT'
              ? 'Bạn đã chấp nhận lời mời tham gia nhóm.'
              : 'Bạn đã từ chối lời mời tham gia nhóm.',
          templateKey:
            action === 'ACCEPT'
              ? 'notifications.group_invitation_accepted'
              : 'notifications.group_invitation_rejected',
        },
      },
      { new: false },
    );

    if (!notification) {
      throw new NotFoundException('Không tìm thấy lời mời hoặc đã được xử lý');
    }

    const groupId = notification.groupId?.toString();
    if (!groupId) {
      throw new BadRequestException('Lời mời không hợp lệ');
    }

    try {
      if (action === 'ACCEPT') {
        await this.groupService.acceptInvitation(userId, groupId);
        return { message: 'Đã tham gia nhóm' };
      }
      await this.groupService.rejectInvitation(userId, groupId);
      return { message: 'Đã từ chối lời mời' };
    } catch (error) {
      const revertSet: Record<string, unknown> = {
        actionStatus: 'PENDING',
        status: notification.status,
        message: notification.message,
      };
      const revertUpdate: Record<string, unknown> = { $set: revertSet };
      if (notification.templateKey) {
        revertSet.templateKey = notification.templateKey;
        revertSet.templateParams = notification.templateParams || {};
      } else {
        revertUpdate.$unset = { templateKey: 1, templateParams: 1 };
      }
      await this.notificationModel.updateOne(
        { _id: notification._id, actionStatus: nextActionStatus },
        revertUpdate,
      );
      throw error;
    }
  }

  async respondGroupInvitationRequest(userId: string, groupId: string, action: 'ACCEPTED' | 'REJECTED') {
    const notification = await this.notificationModel.findOneAndUpdate(
      {
        recipientId: this.objectId(userId, 'User ID'),
        groupId: this.objectId(groupId, 'Group ID'),
        type: NotificationType.GROUP_INVITATION,
        actionStatus: 'PENDING',
        isActive: true,
      },
      {
        $set: {
          actionStatus: action,
          message:
            action === 'ACCEPTED'
              ? 'Bạn đã chấp nhận lời mời tham gia nhóm.'
              : 'Bạn đã từ chối lời mời tham gia nhóm.',
          templateKey:
            action === 'ACCEPTED'
              ? 'notifications.group_invitation_accepted'
              : 'notifications.group_invitation_rejected',
          status: NotificationStatus.READ,
        },
      },
      { new: true },
    );
    if (!notification) return;
    return { message: 'Đã phản hồi yêu cầu tham gia nhóm' };
  }

  // Get unread count
  async getUnreadCount(userId: string) {
    const count = await this.notificationModel.countDocuments({
      recipientId: this.objectId(userId, 'User ID'),
      status: NotificationStatus.UNREAD,
      isActive: true,
    });

    return { unreadCount: count };
  }

  // Create group invitation notification
  async createGroupInvitationNotification(
    inviterId: string,
    targetUserId: string,
    groupId: string,
    groupName: string,
    inviterName: string
  ) {
    return this.create({
      recipientId: targetUserId,
      senderId: inviterId,
      type: NotificationType.GROUP_INVITATION,
      title: 'Lời mời tham gia nhóm',
      message: `${inviterName} đã mời bạn tham gia nhóm "${groupName}"`,
      groupId,
      templateKey: 'notifications.group_invitation',
      templateParams: { senderName: inviterName, groupName },
    });
  }

  // Create group role changed notification
  async createRoleChangedNotification(
    userId: string,
    groupId: string,
    groupName: string,
    newRole: string,
    changedBy: string
  ) {
    const roleNames: Record<string, string> = {
      ADMIN: 'Quản trị viên',
      MODERATOR: 'Người kiểm duyệt',
      MEMBER: 'Thành viên',
    };

    return this.create({
      recipientId: userId,
      senderId: changedBy,
      type: NotificationType.GROUP_ROLE_CHANGED,
      title: 'Thay đổi vai trò trong nhóm',
      message: `Bạn đã được thay đổi vai trò thành ${roleNames[newRole] || newRole} trong nhóm "${groupName}"`,
      groupId,
      metadata: { newRole },
      templateKey: 'notifications.group_role_changed',
      templateParams: { roleName: roleNames[newRole] || newRole, groupName },
    });
  }

  // Create ownership transferred notification
  async createOwnershipTransferredNotification(
    newOwnerId: string,
    oldOwnerId: string,
    groupId: string,
    groupName: string
  ) {
    return this.create({
      recipientId: newOwnerId,
      senderId: oldOwnerId,
      type: NotificationType.GROUP_OWNERSHIP_TRANSFERRED,
      title: 'Nhận quyền sở hữu nhóm',
      message: `Bạn đã được nhận quyền sở hữu nhóm "${groupName}"`,
      groupId,
      templateKey: 'notifications.group_ownership_transferred',
      templateParams: { groupName },
    });
  }
}
