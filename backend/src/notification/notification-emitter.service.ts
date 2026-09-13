import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy, RmqRecordBuilder } from '@nestjs/microservices';
import { NotificationType } from './entities/notification.entity';
import { randomUUID } from 'crypto';
import { lastValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';

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
    templateKey?: string;
    templateParams?: Record<string, string | number>;
}

interface TypedNotificationArgs {
    recipientId: string;
    senderId: string;
    senderName?: string;
    preview?: string;
    postId?: string;
    commentId?: string;
    groupId?: string;
    typeReaction?: string;
    reactionType?: string;
    reactionLabel?: string;
    otherCount?: number;
    groupName?: string;
    roleName?: string;
    newRole?: string;
}

interface TypedNotificationConfig {
    suppressSelfAction: boolean;
    title: string;
    templateKey: string;
    message: (args: TypedNotificationArgs) => string;
    templateParams: (args: TypedNotificationArgs) => Record<string, string | number | undefined>;
    metadata?: (args: TypedNotificationArgs) => Record<string, any>;
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

    // Declarative table: notification type -> title/template key/message + param builders.
    // suppressSelfAction mirrors the per-method self-notification suppression semantics.
    private readonly typeConfig: Record<NotificationType, TypedNotificationConfig> = {
        [NotificationType.POST_REACTED]: {
            suppressSelfAction: true,
            title: 'Bài viết của bạn có lượt thích mới',
            templateKey: 'notifications.post_reacted',
            message: ({ senderName, reactionLabel }) =>
                `${senderName} đã thả cảm xúc "${reactionLabel}" về bài viết của bạn`,
            templateParams: ({ senderName, reactionType, otherCount }) => ({
                senderName,
                reactionType,
                ...(otherCount !== undefined ? { otherCount } : {}),
            }),
        },
        [NotificationType.POST_COMMENTED]: {
            suppressSelfAction: true,
            title: 'Bài viết của bạn có bình luận mới',
            templateKey: 'notifications.post_commented',
            message: ({ senderName, preview }) =>
                `${senderName} đã bình luận: "${preview}" về bài viết của bạn`,
            templateParams: ({ senderName, preview }) => ({
                senderName,
                commentPreview: preview ?? '',
            }),
        },
        [NotificationType.COMMENT_REPLIED]: {
            suppressSelfAction: true,
            title: 'Bình luận của bạn có phản hồi mới',
            templateKey: 'notifications.comment_replied',
            message: ({ senderName }) => `${senderName} đã trả lời bình luận của bạn`,
            templateParams: ({ senderName, preview }) => ({
                senderName,
                commentPreview: preview ?? '',
            }),
        },
        [NotificationType.COMMENT_REACTED]: {
            suppressSelfAction: true,
            title: 'Bình luận của bạn có lượt thích mới',
            templateKey: 'notifications.comment_reacted',
            message: ({ senderName, reactionLabel }) =>
                `${senderName} đã thả cảm xúc "${reactionLabel}" về bình luận của bạn`,
            templateParams: ({ senderName, reactionType }) => ({
                senderName,
                reactionType,
            }),
        },
        [NotificationType.POST_SHARED]: {
            suppressSelfAction: true,
            title: 'Bài viết của bạn đã được chia sẻ',
            templateKey: 'notifications.post_shared',
            message: ({ senderName }) => `${senderName} đã chia sẻ bài viết của bạn.`,
            templateParams: ({ senderName, preview }) => ({
                senderName,
                postPreview: preview ?? '',
            }),
        },
        [NotificationType.GROUP_INVITATION]: {
            suppressSelfAction: false,
            title: 'Lời mời tham gia nhóm',
            templateKey: 'notifications.group_invitation',
            message: ({ senderName, groupName }) =>
                `${senderName} đã mời bạn tham gia nhóm "${groupName}"`,
            templateParams: ({ senderName, groupName }) => ({
                senderName,
                groupName,
            }),
        },
        [NotificationType.GROUP_ROLE_CHANGED]: {
            suppressSelfAction: false,
            title: 'Thay đổi vai trò trong nhóm',
            templateKey: 'notifications.group_role_changed',
            message: ({ roleName, groupName }) =>
                `Bạn đã được thay đổi vai trò thành ${roleName} trong nhóm "${groupName}"`,
            templateParams: ({ roleName, groupName }) => ({
                roleName,
                groupName,
            }),
            metadata: ({ newRole }) => ({ newRole }),
        },
        [NotificationType.GROUP_OWNERSHIP_TRANSFERRED]: {
            suppressSelfAction: false,
            title: 'Nhận quyền sở hữu nhóm',
            templateKey: 'notifications.group_ownership_transferred',
            message: ({ groupName }) => `Bạn đã được nhận quyền sở hữu nhóm "${groupName}"`,
            templateParams: ({ groupName }) => ({
                groupName,
            }),
        },
        [NotificationType.GROUP_REQUEST_APPROVED]: {
            suppressSelfAction: false,
            title: 'Yêu cầu tham gia nhóm được chấp nhận',
            templateKey: 'notifications.group_request_approved',
            message: ({ groupName }) =>
                `Yêu cầu tham gia nhóm "${groupName}" của bạn đã được chấp nhận.`,
            templateParams: ({ groupName }) => ({
                groupName,
            }),
        },
        [NotificationType.GROUP_REQUEST_REJECTED]: {
            suppressSelfAction: false,
            title: 'Yêu cầu tham gia nhóm bị từ chối',
            templateKey: 'notifications.group_request_rejected',
            message: ({ groupName }) =>
                `Yêu cầu tham gia nhóm "${groupName}" của bạn đã bị từ chối.`,
            templateParams: ({ groupName }) => ({
                groupName,
            }),
        },
        [NotificationType.FRIEND_REQUEST]: {
            suppressSelfAction: false,
            title: 'Lời mời kết bạn',
            templateKey: 'notifications.friend_request',
            message: ({ senderName }) => `${senderName} đã gửi lời mời kết bạn`,
            templateParams: ({ senderName }) => ({
                senderName,
            }),
        },
        [NotificationType.FRIEND_ACCEPTED]: {
            suppressSelfAction: false,
            title: 'Lời mời kết bạn được chấp nhận',
            templateKey: 'notifications.friend_accepted',
            message: ({ senderName }) => `${senderName} đã chấp nhận lời mời kết bạn`,
            templateParams: ({ senderName }) => ({
                senderName,
            }),
        },
        [NotificationType.SYSTEM]: {
            suppressSelfAction: false,
            title: 'Thông báo hệ thống',
            templateKey: 'notifications.system',
            message: ({ preview }) => preview || '',
            templateParams: () => ({}),
        },
    };

    /**
     * Emit notification event tới RabbitMQ
     * Event sẽ được xử lý bởi Aggregation Worker -> Sender Worker -> Socket
     */
    async emit(payload: NotificationEventPayload): Promise<void> {
        const eventId = randomUUID();
        try {
            const record = new RmqRecordBuilder({
                ...payload,
                eventId,
                timestamp: Date.now(),
            })
                .setOptions({
                    persistent: true,
                    headers: { 'x-event-id': eventId },
                })
                .build();
            await lastValueFrom(
                this.rabbitMQClient.emit('notification.created', record).pipe(timeout(5000)),
                { defaultValue: undefined },
            );
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
        reactionLabel: string,
        senderName: string,
        otherCount?: number,
    ): Promise<void> {
        await this.emitTyped(NotificationType.POST_REACTED, {
            recipientId: postOwnerId,
            senderId: reactorId,
            postId,
            typeReaction: reactionType,
            reactionLabel,
            senderName,
            otherCount,
        });
    }

    // Post comment notification
    async emitPostComment(
        postOwnerId: string,
        commenterId: string,
        postId: string,
        commenterName: string,
        commentPreview: string,
    ): Promise<void> {
        await this.emitTyped(NotificationType.POST_COMMENTED, {
            recipientId: postOwnerId,
            senderId: commenterId,
            postId,
            senderName: commenterName,
            preview: commentPreview,
        });
    }

    // Comment reply notification
    async emitCommentReply(
        parentCommentOwnerId: string,
        replierId: string,
        postId: string,
        commentId: string,
        replierName: string,
        commentPreview: string,
    ): Promise<void> {
        await this.emitTyped(NotificationType.COMMENT_REPLIED, {
            recipientId: parentCommentOwnerId,
            senderId: replierId,
            postId,
            commentId,
            senderName: replierName,
            preview: commentPreview,
        });
    }

    // Comment reaction notification
    async emitCommentReaction(
        commentOwnerId: string,
        reactorId: string,
        commentId: string,
        reactionType: string,
        reactionLabel: string,
        senderName: string,
    ): Promise<void> {
        await this.emitTyped(NotificationType.COMMENT_REACTED, {
            recipientId: commentOwnerId,
            senderId: reactorId,
            commentId,
            typeReaction: reactionType,
            reactionLabel,
            senderName,
        });
    }

    // Post shared notification
    async emitPostShared(
        originalPostOwnerId: string,
        sharerId: string,
        postId: string,
        sharerName: string,
        postPreview?: string,
    ): Promise<void> {
        await this.emitTyped(NotificationType.POST_SHARED, {
            recipientId: originalPostOwnerId,
            senderId: sharerId,
            postId,
            senderName: sharerName,
            preview: postPreview,
        });
    }

    // Group invitation notification
    async emitGroupInvitation(
        targetUserId: string,
        inviterId: string,
        groupId: string,
        inviterName: string,
        groupName: string,
    ): Promise<void> {
        await this.emitTyped(NotificationType.GROUP_INVITATION, {
            recipientId: targetUserId,
            senderId: inviterId,
            groupId,
            senderName: inviterName,
            groupName,
        });
    }

    // Group role changed notification
    async emitGroupRoleChanged(
        userId: string,
        changedById: string,
        groupId: string,
        newRole: string,
        roleName: string,
        groupName: string,
    ): Promise<void> {
        await this.emitTyped(NotificationType.GROUP_ROLE_CHANGED, {
            recipientId: userId,
            senderId: changedById,
            groupId,
            newRole,
            roleName,
            groupName,
        });
    }

    // Group ownership transferred notification
    async emitGroupOwnershipTransferred(
        newOwnerId: string,
        oldOwnerId: string,
        groupId: string,
        groupName: string,
    ): Promise<void> {
        await this.emitTyped(NotificationType.GROUP_OWNERSHIP_TRANSFERRED, {
            recipientId: newOwnerId,
            senderId: oldOwnerId,
            groupId,
            groupName,
        });
    }

    // Group request approved notification
    async emitGroupRequestApproved(
        requesterId: string,
        approverId: string,
        groupId: string,
        groupName: string,
    ): Promise<void> {
        await this.emitTyped(NotificationType.GROUP_REQUEST_APPROVED, {
            recipientId: requesterId,
            senderId: approverId,
            groupId,
            groupName,
        });
    }

    // Group request rejected notification
    async emitGroupRequestRejected(
        requesterId: string,
        rejecterId: string,
        groupId: string,
        groupName: string,
    ): Promise<void> {
        await this.emitTyped(NotificationType.GROUP_REQUEST_REJECTED, {
            recipientId: requesterId,
            senderId: rejecterId,
            groupId,
            groupName,
        });
    }

    // Friend request notification
    async emitFriendRequest(
        targetUserId: string,
        requesterId: string,
        requesterName: string,
    ): Promise<void> {
        await this.emitTyped(NotificationType.FRIEND_REQUEST, {
            recipientId: targetUserId,
            senderId: requesterId,
            senderName: requesterName,
        });
    }

    // Friend accepted notification
    async emitFriendAccepted(
        requesterId: string,
        accepterId: string,
        accepterName: string,
    ): Promise<void> {
        await this.emitTyped(NotificationType.FRIEND_ACCEPTED, {
            recipientId: requesterId,
            senderId: accepterId,
            senderName: accepterName,
        });
    }

    private async emitTyped(
        type: NotificationType,
        args: TypedNotificationArgs,
    ): Promise<void> {
        const config = this.typeConfig[type];
        if (config.suppressSelfAction && args.recipientId === args.senderId) return;

        const payload: NotificationEventPayload = {
            recipientId: args.recipientId,
            senderId: args.senderId,
            type,
            title: config.title,
            message: config.message(args),
            groupId: args.groupId,
            postId: args.postId,
            commentId: args.commentId,
            typeReaction: args.typeReaction,
            templateKey: config.templateKey,
            templateParams: config.templateParams(args) as Record<string, string | number>,
        };
        if (config.metadata) payload.metadata = config.metadata(args);

        try {
            await this.emit(payload);
        } catch (error) {
            // Never fail the caller's business transaction because the RMQ
            // notification hop is unavailable — log and continue.
            const reason = error instanceof Error ? error.message : String(error);
            this.logger.warn(
                `Failed to emit notification event (type=${type}, recipient=${args.recipientId}): ${reason}`,
            );
        }
    }
}
