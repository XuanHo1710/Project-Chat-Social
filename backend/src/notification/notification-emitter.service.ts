import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { NotificationType } from './entities/notification.entity';

export interface NotificationEventPayload {
    recipientId: string;
    senderId?: string;
    type: NotificationType;
    title: string;
    message?: string;
    groupId?: string;
    postId?: string;
    commentId?: string;
    metadata?: Record<string, any>;
    typeReaction?: string;
}

/**
 * Service để emit notification events tới RabbitMQ
 * Thay vì tạo notification trực tiếp, events sẽ được gửi tới RabbitMQ
 * để được xử lý bởi Aggregation Worker và Sender Worker
 */
@Injectable()
export class NotificationEmitterService {
    private readonly logger = new Logger('NotificationEmitter');

    constructor(
        @Inject('RABBITMQ_SERVICE')
        private readonly rabbitMQClient: ClientProxy,
    ) { }

    /**
     * Emit notification event tới RabbitMQ
     * Event sẽ được xử lý bởi Aggregation Worker -> Sender Worker -> Socket
     */
    async emit(payload: NotificationEventPayload): Promise<void> {
        try {
            this.rabbitMQClient.emit('notification.created', {
                ...payload,
                timestamp: Date.now(),
            });
            this.logger.log(`Emitted notification event: ${payload.type} for ${payload.recipientId}`);
        } catch (error) {
            this.logger.error('Failed to emit notification event:', error);
            throw error;
        }
    }

    /**
     * Helper methods for common notification types
     */

    // Post reaction notification
    async emitPostReaction(
        postOwnerId: string,
        reactorId: string,
        postId: string,
        reactionType: string,
        message: string,
    ): Promise<void> {
        // Don't notify if reacting to own post
        if (postOwnerId === reactorId) return;

        await this.emit({
            recipientId: postOwnerId,
            senderId: reactorId,
            type: NotificationType.POST_REACTED,
            title: 'Bài viết của bạn có lượt thích mới',
            message,
            postId,
            typeReaction: reactionType,
        });
    }

    // Post comment notification
    async emitPostComment(
        postOwnerId: string,
        commenterId: string,
        postId: string,
        message: string,
    ): Promise<void> {
        // Don't notify if commenting on own post
        if (postOwnerId === commenterId) return;

        await this.emit({
            recipientId: postOwnerId,
            senderId: commenterId,
            type: NotificationType.POST_COMMENTED,
            title: 'Bài viết của bạn có bình luận mới',
            message,
            postId,
        });
    }

    // Comment reply notification
    async emitCommentReply(
        parentCommentOwnerId: string,
        replierId: string,
        postId: string,
        commentId: string,
        message: string,
    ): Promise<void> {
        // Don't notify if replying to own comment
        if (parentCommentOwnerId === replierId) return;

        await this.emit({
            recipientId: parentCommentOwnerId,
            senderId: replierId,
            type: NotificationType.COMMENT_REPLIED,
            title: 'Bình luận của bạn có phản hồi mới',
            message,
            postId,
            commentId,
        });
    }

    // Comment reaction notification
    async emitCommentReaction(
        commentOwnerId: string,
        reactorId: string,
        commentId: string,
        reactionType: string,
        message: string,
    ): Promise<void> {
        // Don't notify if reacting to own comment
        if (commentOwnerId === reactorId) return;

        await this.emit({
            recipientId: commentOwnerId,
            senderId: reactorId,
            type: NotificationType.COMMENT_REACTED,
            title: 'Bình luận của bạn có lượt thích mới',
            message,
            commentId,
            typeReaction: reactionType,
        });
    }

    // Post shared notification
    async emitPostShared(
        originalPostOwnerId: string,
        sharerId: string,
        postId: string,
        message: string,
    ): Promise<void> {
        // Don't notify if sharing own post
        if (originalPostOwnerId === sharerId) return;

        await this.emit({
            recipientId: originalPostOwnerId,
            senderId: sharerId,
            type: NotificationType.POST_SHARED,
            title: 'Bài viết của bạn đã được chia sẻ',
            message,
            postId,
        });
    }

    // Group invitation notification
    async emitGroupInvitation(
        targetUserId: string,
        inviterId: string,
        groupId: string,
        message: string,
    ): Promise<void> {
        await this.emit({
            recipientId: targetUserId,
            senderId: inviterId,
            type: NotificationType.GROUP_INVITATION,
            title: 'Lời mời tham gia nhóm',
            message,
            groupId,
        });
    }

    // Group role changed notification
    async emitGroupRoleChanged(
        userId: string,
        changedById: string,
        groupId: string,
        newRole: string,
        message: string,
    ): Promise<void> {
        await this.emit({
            recipientId: userId,
            senderId: changedById,
            type: NotificationType.GROUP_ROLE_CHANGED,
            title: 'Thay đổi vai trò trong nhóm',
            message,
            groupId,
            metadata: { newRole },
        });
    }

    // Group ownership transferred notification
    async emitGroupOwnershipTransferred(
        newOwnerId: string,
        oldOwnerId: string,
        groupId: string,
        message: string,
    ): Promise<void> {
        await this.emit({
            recipientId: newOwnerId,
            senderId: oldOwnerId,
            type: NotificationType.GROUP_OWNERSHIP_TRANSFERRED,
            title: 'Nhận quyền sở hữu nhóm',
            message,
            groupId,
        });
    }

    // Group request approved notification
    async emitGroupRequestApproved(
        requesterId: string,
        approverId: string,
        groupId: string,
        message: string,
    ): Promise<void> {
        await this.emit({
            recipientId: requesterId,
            senderId: approverId,
            type: NotificationType.GROUP_REQUEST_APPROVED,
            title: 'Yêu cầu tham gia nhóm được chấp nhận',
            message,
            groupId,
        });
    }

    // Group request rejected notification
    async emitGroupRequestRejected(
        requesterId: string,
        rejecterId: string,
        groupId: string,
        message: string,
    ): Promise<void> {
        await this.emit({
            recipientId: requesterId,
            senderId: rejecterId,
            type: NotificationType.GROUP_REQUEST_REJECTED,
            title: 'Yêu cầu tham gia nhóm bị từ chối',
            message,
            groupId,
        });
    }

    // Friend request notification
    async emitFriendRequest(
        targetUserId: string,
        requesterId: string,
        message: string,
    ): Promise<void> {
        await this.emit({
            recipientId: targetUserId,
            senderId: requesterId,
            type: NotificationType.FRIEND_REQUEST,
            title: 'Lời mời kết bạn',
            message,
        });
    }

    // Friend accepted notification
    async emitFriendAccepted(
        requesterId: string,
        accepterId: string,
        message: string,
    ): Promise<void> {
        await this.emit({
            recipientId: requesterId,
            senderId: accepterId,
            type: NotificationType.FRIEND_ACCEPTED,
            title: 'Lời mời kết bạn được chấp nhận',
            message,
        });
    }
}
