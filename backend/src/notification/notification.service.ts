import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
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

  // Create or update a notification (aggregates notifications for same action on same content)
  async create(dto: CreateNotificationDto): Promise<any> {
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
      recipientId: new Types.ObjectId(dto.recipientId),
      senderIds: dto.senderId ? [new Types.ObjectId(dto.senderId)] : [],
      type: dto.type,
      title: dto.title,
      message: dto.message || '',
      groupId: dto.groupId ? new Types.ObjectId(dto.groupId) : undefined,
      postId: dto.postId ? new Types.ObjectId(dto.postId) : undefined,
      commentId: dto.commentId ? new Types.ObjectId(dto.commentId) : undefined,
      metadata: dto.metadata,
      actionStatus: dto.type === NotificationType.GROUP_INVITATION ? 'PENDING' : undefined,
      typeReaction: dto.typeReaction,
    });

    await notification.save();
    return this.emitNotification(dto.recipientId, notification._id);
  }

  // Create or update aggregated notification
  // Find existing notification by type + postId/commentId + recipientId
  // If exists: add sender to senderIds array
  // If not exists: create new notification
  private async createOrUpdateAggregatedNotification(dto: CreateNotificationDto): Promise<any> {
    // Build filter to find existing notification
    const filter: any = {
      recipientId: new Types.ObjectId(dto.recipientId),
      type: dto.type,
      isActive: true,
    };

    // Add postId or commentId to filter based on notification type
    if (dto.postId) {
      filter.postId = new Types.ObjectId(dto.postId);
    }
    if (dto.commentId) {
      filter.commentId = new Types.ObjectId(dto.commentId);
    }

    // Find existing notification
    const existingNotification = await this.notificationModel.findOne(filter);

    if (existingNotification) {
      // Check if sender is already in senderIds array
      const senderIdObj = dto.senderId ? new Types.ObjectId(dto.senderId) : null;
      const senderAlreadyExists = senderIdObj && existingNotification.senderIds.some(
        (id) => id.toString() === senderIdObj.toString()
      );

      if (senderAlreadyExists) {
        // Sender already in list - move them to end of array (latest position)
        // First remove, then add to end so they appear first when reversed
        if (senderIdObj) {
          await this.notificationModel.updateOne(
            { _id: existingNotification._id },
            {
              $pull: { senderIds: senderIdObj },
            }
          );
          await this.notificationModel.updateOne(
            { _id: existingNotification._id },
            {
              $push: { senderIds: senderIdObj },
              $set: {
                status: NotificationStatus.UNREAD,
                updatedAt: new Date(),
                ...(dto.message && { message: dto.message }),
                ...(dto.typeReaction && { typeReaction: dto.typeReaction }),
              },
            }
          );
        }
        return this.emitNotification(dto.recipientId, existingNotification._id);
      }

      // Add new sender to end of senderIds array (latest position)
      // Also update message, typeReaction, and mark as unread
      const updateData: any = {
        $push: { senderIds: senderIdObj },
        $set: {
          status: NotificationStatus.UNREAD, // Mark as unread again for visibility
          updatedAt: new Date(),
          ...(dto.message && { message: dto.message }),
          ...(dto.typeReaction && { typeReaction: dto.typeReaction }),
        },
      };

      await this.notificationModel.updateOne(
        { _id: existingNotification._id },
        updateData
      );

      return this.emitNotification(dto.recipientId, existingNotification._id);
    } else {
      // No existing notification, create new one
      return this.createNewNotification(dto);
    }
  }

  // Helper to populate and emit notification
  private async emitNotification(recipientId: string, notificationId: any): Promise<any> {
    const populatedNotification = await this.notificationModel
      .findById(notificationId)
      .populate('senderIds', 'firstName lastName avatar username')
      .populate('groupId', 'name avatar coverImage')
      .lean();

    // Get unread count
    const unreadCount = await this.notificationModel.countDocuments({
      recipientId: new Types.ObjectId(recipientId),
      status: NotificationStatus.UNREAD,
    });

    // Emit real-time notification
    this.notificationGateway.sendNotification(recipientId, populatedNotification);
    this.notificationGateway.sendUnreadCountUpdate(recipientId, unreadCount);

    return populatedNotification;
  }

  // Get user notifications
  async getUserNotifications(
    userId: string,
    page = 1,
    limit = 20,
    status?: string,
    type?: string
  ): Promise<any> {
    const skip = (page - 1) * limit;

    // Build filter query
    const filter: any = {
      recipientId: new Types.ObjectId(userId),
      isActive: true,
    };

    // Add status filter if provided
    if (status) {
      filter.status = status;
    }

    // Add type filter if provided
    if (type) {
      filter.type = type;
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
        recipientId: new Types.ObjectId(userId),
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
    const notification = await this.notificationModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(notificationId),
        recipientId: new Types.ObjectId(userId),
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
    await this.notificationModel.updateMany(
      {
        recipientId: new Types.ObjectId(userId),
        status: NotificationStatus.UNREAD,
      },
      { status: NotificationStatus.READ }
    );

    return { message: 'Đã đánh dấu tất cả là đã đọc' };
  }

  // Delete notification
  async deleteNotification(userId: string, notificationId: string) {
    const result = await this.notificationModel.deleteOne({
      _id: new Types.ObjectId(notificationId),
      recipientId: new Types.ObjectId(userId),
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    return { message: 'Đã xóa thông báo' };
  }

  // Respond to group invitation
  async respondToGroupInvitation(
    userId: string,
    notificationId: string,
    action: 'ACCEPT' | 'REJECT'
  ) {
    const notification = await this.notificationModel.findOne({
      _id: new Types.ObjectId(notificationId),
      recipientId: new Types.ObjectId(userId),
      type: NotificationType.GROUP_INVITATION,
      actionStatus: 'PENDING',
      isActive: true,
    });

    if (!notification) {
      throw new NotFoundException('Không tìm thấy lời mời hoặc đã được xử lý');
    }

    const groupId = notification.groupId?.toString();
    if (!groupId) {
      throw new BadRequestException('Lời mời không hợp lệ');
    }

    if (action === 'ACCEPT') {
      // Accept the group invitation
      await this.groupService.acceptInvitation(userId, groupId);
      notification.actionStatus = 'ACCEPTED';
      notification.status = NotificationStatus.READ;
      notification.message = 'Bạn đã chấp nhận lời mời tham gia nhóm.';
      await notification.save();

      return { message: 'Đã tham gia nhóm' };
    } else {
      // Reject the group invitation
      await this.groupService.rejectInvitation(userId, groupId);
      notification.actionStatus = 'REJECTED';
      notification.status = NotificationStatus.READ;
      notification.message = 'Bạn đã từ chối lời mời tham gia nhóm.';
      await notification.save();

      return { message: 'Đã từ chối lời mời' };
    }
  }

  async respondGroupInvitationRequest(userId: string, groupdId: string, action: 'ACCEPTED' | 'REJECTED') {
    const notification = await this.notificationModel.findOne({
      recipientId: new Types.ObjectId(userId),
      groupId: new Types.ObjectId(groupdId),
      type: NotificationType.GROUP_INVITATION,
      actionStatus: 'PENDING',
      isActive: true,
    });
    if (!notification) return;
    notification.actionStatus = action;
    notification.message = action === 'ACCEPTED' ? 'Bạn đã chấp nhận lời mời tham gia nhóm.' : 'Bạn đã từ chối lời mời tham gia nhóm.';
    notification.status = NotificationStatus.READ;
    await notification.save();
    return { message: 'Đã phản hồi yêu cầu tham gia nhóm' };
  }

  // Get unread count
  async getUnreadCount(userId: string) {
    const count = await this.notificationModel.countDocuments({
      recipientId: new Types.ObjectId(userId),
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
    });
  }
}
