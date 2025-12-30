import { Logger } from '@nestjs/common';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ReactionService } from './reaction.service';
import { CommentService } from 'src/comment/comment.service';
import { ReactionType } from './entities/reaction.entity';

// Map để lưu userId -> Set<socketId> (support multiple connections per user)
const userSockets = new Map<string, Set<string>>();
// Map để lưu postId -> Set<socketId> (users đang xem post này)
const postViewers = new Map<string, Set<string>>();

/**
 * Server-side rate limiting per user per entity
 * Key: `${userId}:${entityType}:${entityId}`
 * Value: { lastType, timestamp, pending }
 */
interface PendingReaction {
    type: string;
    timestamp: number;
    timeout?: NodeJS.Timeout;
}
const pendingReactions = new Map<string, PendingReaction>();

// Rate limit config
const RATE_LIMIT_WINDOW_MS = 300; // 300ms debounce window

interface ToggleReactionDto {
    postId: string;
    type: ReactionType;
}

interface ToggleCommentReactionDto {
    commentId: string;
    type: string; // CommentReactionType
}

@WebSocketGateway({
    cors: {
        origin: '*',
        credentials: true,
    },
    namespace: '/reaction',
})
export class ReactionGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;
    private logger = new Logger('ReactionGateway');

    constructor(
        private readonly reactionService: ReactionService,
        private readonly commentService: CommentService,
    ) { }

    async handleConnection(client: Socket) {
        try {
            const userId = client.handshake.query.userId as string;

            if (!userId) {
                this.logger.warn(`Client ${client.id} connected without userId`);
                client.disconnect();
                return;
            }

            // Store userId in client data for later use
            client.data.userId = userId;

            // Join user's personal room
            client.join(`user:${userId}`);
            this.logger.log(`Client ${client.id} connected as user ${userId}`);

            // Lưu mapping userId -> Set<socketId>
            if (!userSockets.has(userId)) {
                userSockets.set(userId, new Set());
            }
            userSockets.get(userId)!.add(client.id);

        } catch (error) {
            this.logger.error('Connection error:', error);
        }
    }

    async handleDisconnect(client: Socket) {
        try {
            const userId = client.data.userId || (client.handshake.query.userId as string);

            if (userId && userSockets.has(userId)) {
                const sockets = userSockets.get(userId)!;
                sockets.delete(client.id);

                if (sockets.size === 0) {
                    userSockets.delete(userId);
                }
            }

            // Remove from all post viewer rooms
            postViewers.forEach((viewers, postId) => {
                if (viewers.has(client.id)) {
                    viewers.delete(client.id);
                    if (viewers.size === 0) {
                        postViewers.delete(postId);
                    }
                }
            });

            this.logger.log(`Client ${client.id} disconnected`);
        } catch (error) {
            this.logger.error('Disconnect error:', error);
        }
    }

    /**
     * Subscribe to reaction updates for a post
     */
    @SubscribeMessage('post:subscribe')
    handleSubscribePost(
        @MessageBody() data: { postId: string },
        @ConnectedSocket() client: Socket
    ) {
        const { postId } = data;

        // Join room for this post
        client.join(`post:${postId}`);

        // Track viewers
        if (!postViewers.has(postId)) {
            postViewers.set(postId, new Set());
        }
        postViewers.get(postId)!.add(client.id);

        return { success: true };
    }

    /**
     * Unsubscribe from post updates
     */
    @SubscribeMessage('post:unsubscribe')
    handleUnsubscribePost(
        @MessageBody() data: { postId: string },
        @ConnectedSocket() client: Socket
    ) {
        const { postId } = data;

        client.leave(`post:${postId}`);

        if (postViewers.has(postId)) {
            postViewers.get(postId)!.delete(client.id);
            if (postViewers.get(postId)!.size === 0) {
                postViewers.delete(postId);
            }
        }

        return { success: true };
    }

    /**
     * Toggle reaction trên post qua WebSocket
     * Server-side debounce để xử lý spam từ user
     * Chỉ xử lý reaction CUỐI CÙNG trong window
     */
    @SubscribeMessage('reaction:toggle')
    async handleToggleReaction(
        @MessageBody() data: ToggleReactionDto,
        @ConnectedSocket() client: Socket
    ) {
        const userId = client.data.userId;

        if (!userId) {
            return { success: false, error: 'User not authenticated' };
        }

        const key = `${userId}:post:${data.postId}`;
        const now = Date.now();

        // Check if there's a pending reaction
        const existing = pendingReactions.get(key);

        if (existing) {
            // Cancel the existing timeout
            if (existing.timeout) {
                clearTimeout(existing.timeout);
            }
        }

        // Set new pending reaction with debounce
        const timeout = setTimeout(async () => {
            try {
                const pending = pendingReactions.get(key);
                if (!pending) return;

                pendingReactions.delete(key);

                // Actually process the reaction
                const result = await this.reactionService.toggleReaction(
                    { postId: data.postId, type: pending.type as ReactionType },
                    userId
                );

                // Emit to all users watching this post
                this.server.to(`post:${data.postId}`).emit('reaction:updated', {
                    postId: data.postId,
                    userId,
                    action: result.action,
                    type: pending.type,
                    totalReacts: result.totalReacts,
                });

                // Emit specifically to the sender
                client.emit('reaction:result', {
                    success: true,
                    postId: data.postId,
                    ...result,
                });

            } catch (error: any) {
                this.logger.error('Toggle reaction error:', error);
                client.emit('reaction:result', {
                    success: false,
                    postId: data.postId,
                    error: error.message,
                });
            }
        }, RATE_LIMIT_WINDOW_MS);

        pendingReactions.set(key, {
            type: data.type,
            timestamp: now,
            timeout,
        });

        // Return immediately để UI responsive
        return { success: true, queued: true };
    }

    /**
     * Toggle reaction trên comment qua WebSocket
     * Server-side debounce tương tự post
     */
    @SubscribeMessage('comment:reaction:toggle')
    async handleToggleCommentReaction(
        @MessageBody() data: ToggleCommentReactionDto,
        @ConnectedSocket() client: Socket
    ) {
        const userId = client.data.userId;

        if (!userId) {
            return { success: false, error: 'User not authenticated' };
        }

        const key = `${userId}:comment:${data.commentId}`;
        const now = Date.now();

        // Check if there's a pending reaction
        const existing = pendingReactions.get(key);

        if (existing) {
            // Cancel the existing timeout
            if (existing.timeout) {
                clearTimeout(existing.timeout);
            }
        }

        // Set new pending reaction with debounce
        const timeout = setTimeout(async () => {
            try {
                const pending = pendingReactions.get(key);
                if (!pending) return;

                pendingReactions.delete(key);

                // Actually process the reaction
                const result = await this.commentService.toggleReaction(
                    { commentId: data.commentId, type: pending.type as any },
                    userId
                );

                // Emit to the sender
                client.emit('comment:reaction:result', {
                    success: true,
                    commentId: data.commentId,
                    ...result,
                });

            } catch (error: any) {
                this.logger.error('Toggle comment reaction error:', error);
                client.emit('comment:reaction:result', {
                    success: false,
                    commentId: data.commentId,
                    error: error.message,
                });
            }
        }, RATE_LIMIT_WINDOW_MS);

        pendingReactions.set(key, {
            type: data.type,
            timestamp: now,
            timeout,
        });

        // Return immediately để UI responsive
        return { success: true, queued: true };
    }

    /**
     * Get user's current reaction on a post
     */
    @SubscribeMessage('reaction:get')
    async handleGetReaction(
        @MessageBody() data: { postId: string },
        @ConnectedSocket() client: Socket
    ) {
        const userId = client.data.userId;

        if (!userId) {
            return { success: false, error: 'User not authenticated' };
        }

        try {
            const reaction = await this.reactionService.getUserReaction(data.postId, userId);
            return { success: true, reaction };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Cleanup pending reactions for a user when they disconnect
     * Prevents memory leaks
     */
    private cleanupUserPendingReactions(userId: string) {
        const keysToDelete: string[] = [];

        pendingReactions.forEach((value, key) => {
            if (key.startsWith(`${userId}:`)) {
                if (value.timeout) {
                    clearTimeout(value.timeout);
                }
                keysToDelete.push(key);
            }
        });

        keysToDelete.forEach(key => pendingReactions.delete(key));
    }
}
