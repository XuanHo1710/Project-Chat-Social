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

  // Create a notification
  async create(dto: CreateNotificationDto): Promise<any> {
    const notification = new this.notificationModel({
      recipientId: new Types.ObjectId(dto.recipientId),
      senderId: dto.senderId ? new Types.ObjectId(dto.senderId) : undefined,
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

    // Populate and send real-time notification
    const populatedNotification = await this.notificationModel
      .findById(notification._id)
      .populate('senderId', 'firstName lastName avatar username')
      .populate('groupId', 'name avatar coverImage')
      .lean();

    // Get unread count
    const unreadCount = await this.notificationModel.countDocuments({
      recipientId: new Types.ObjectId(dto.recipientId),
      status: NotificationStatus.UNREAD,
    });

    // Emit real-time notification
    this.notificationGateway.sendNotification(dto.recipientId, populatedNotification);
    this.notificationGateway.sendUnreadCountUpdate(dto.recipientId, unreadCount);

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
        .populate('senderId', 'firstName lastName avatar username')
        .populate('groupId', 'name avatar coverImage')
        .sort({ createdAt: -1 })
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
