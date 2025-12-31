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
import { ReactionType, TypeFactor } from './entities/reaction.entity';

// Map để lưu userId -> Set<socketId> (support multiple connections per user)
const userSockets = new Map<string, Set<string>>();
// Map để lưu factorId -> Set<socketId> (users đang xem factor này)
const factorViewers = new Map<string, Set<string>>();

/**
 * Server-side rate limiting per user per factor
 * Key: `${userId}:${typeFactor}:${factorId}`
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
    factorId: string;
    typeFactor: TypeFactor;
    type: ReactionType;
}

// Legacy DTOs for backward compatibility
interface LegacyPostReactionDto {
    postId: string;
    type: ReactionType;
}

interface LegacyCommentReactionDto {
    commentId: string;
    type: ReactionType;
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
    ) { }

    async handleConnection(client: Socket) {
        try {
            const userId = client.handshake.query.userId as string;

            if (!userId) {
                this.logger.warn(`Client ${client.id} connected without userId`);
                client.disconnect();
                return;
            }

            client.data.userId = userId;
            client.join(`user:${userId}`);
            this.logger.log(`Client ${client.id} connected as user ${userId}`);

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

            // Remove from all factor viewer rooms
            factorViewers.forEach((viewers, factorId) => {
                if (viewers.has(client.id)) {
                    viewers.delete(client.id);
                    if (viewers.size === 0) {
                        factorViewers.delete(factorId);
                    }
                }
            });

            // Cleanup pending reactions
            this.cleanupUserPendingReactions(userId);
            this.logger.log(`Client ${client.id} disconnected`);
        } catch (error) {
            this.logger.error('Disconnect error:', error);
        }
    }

    /**
     * Subscribe to reaction updates for a factor (post/comment/message)
     */
    @SubscribeMessage('factor:subscribe')
    handleSubscribeFactor(
        @MessageBody() data: { factorId: string; typeFactor: TypeFactor },
        @ConnectedSocket() client: Socket
    ) {
        const roomKey = `${data.typeFactor}:${data.factorId}`;
        client.join(roomKey);

        if (!factorViewers.has(roomKey)) {
            factorViewers.set(roomKey, new Set());
        }
        factorViewers.get(roomKey)!.add(client.id);

        return { success: true };
    }

    /**
     * Legacy: Subscribe to post updates
     */
    @SubscribeMessage('post:subscribe')
    handleSubscribePost(
        @MessageBody() data: { postId: string },
        @ConnectedSocket() client: Socket
    ) {
        return this.handleSubscribeFactor(
            { factorId: data.postId, typeFactor: TypeFactor.POST },
            client
        );
    }

    /**
     * Unsubscribe from factor updates
     */
    @SubscribeMessage('factor:unsubscribe')
    handleUnsubscribeFactor(
        @MessageBody() data: { factorId: string; typeFactor: TypeFactor },
        @ConnectedSocket() client: Socket
    ) {
        const roomKey = `${data.typeFactor}:${data.factorId}`;
        client.leave(roomKey);

        if (factorViewers.has(roomKey)) {
            factorViewers.get(roomKey)!.delete(client.id);
            if (factorViewers.get(roomKey)!.size === 0) {
                factorViewers.delete(roomKey);
            }
        }

        return { success: true };
    }

    /**
     * Legacy: Unsubscribe from post updates
     */
    @SubscribeMessage('post:unsubscribe')
    handleUnsubscribePost(
        @MessageBody() data: { postId: string },
        @ConnectedSocket() client: Socket
    ) {
        return this.handleUnsubscribeFactor(
            { factorId: data.postId, typeFactor: TypeFactor.POST },
            client
        );
    }

    /**
     * Generic toggle reaction handler
     */
    @SubscribeMessage('reaction:toggle')
    async handleToggleReaction(
        @MessageBody() data: ToggleReactionDto | LegacyPostReactionDto,
        @ConnectedSocket() client: Socket
    ) {
        const userId = client.data.userId;

        if (!userId) {
            return { success: false, error: 'User not authenticated' };
        }

        // Handle legacy format (postId instead of factorId)
        let factorId: string;
        let typeFactor: TypeFactor;
        let type: ReactionType;

        if ('postId' in data) {
            // Legacy format
            factorId = data.postId;
            typeFactor = TypeFactor.POST;
            type = data.type;
        } else {
            factorId = data.factorId;
            typeFactor = data.typeFactor;
            type = data.type;
        }

        const key = `${userId}:${typeFactor}:${factorId}`;
        const roomKey = `${typeFactor}:${factorId}`;
        const now = Date.now();

        // Cancel existing pending reaction
        const existing = pendingReactions.get(key);
        if (existing?.timeout) {
            clearTimeout(existing.timeout);
        }

        // Set new pending reaction with debounce
        const timeout = setTimeout(async () => {
            try {
                const pending = pendingReactions.get(key);
                if (!pending) return;

                pendingReactions.delete(key);

                const result = await this.reactionService.toggleReaction(
                    { factorId, typeFactor, type: pending.type as ReactionType },
                    userId
                );

                // Emit to all users watching this factor
                this.server.to(roomKey).emit('reaction:updated', {
                    factorId,
                    typeFactor,
                    postId: typeFactor === TypeFactor.POST ? factorId : undefined, // Legacy
                    commentId: typeFactor === TypeFactor.COMMENT ? factorId : undefined, // Legacy
                    userId,
                    action: result.action,
                    type: pending.type,
                    totalReacts: result.totalReacts,
                });

                // Emit specifically to sender
                client.emit('reaction:result', {
                    success: true,
                    factorId,
                    typeFactor,
                    postId: typeFactor === TypeFactor.POST ? factorId : undefined,
                    commentId: typeFactor === TypeFactor.COMMENT ? factorId : undefined,
                    ...result,
                });

            } catch (error: any) {
                this.logger.error('Toggle reaction error:', error);
                client.emit('reaction:result', {
                    success: false,
                    factorId,
                    typeFactor,
                    error: error.message,
                });
            }
        }, RATE_LIMIT_WINDOW_MS);

        pendingReactions.set(key, { type, timestamp: now, timeout });
        return { success: true, queued: true };
    }

    /**
     * Legacy: Toggle comment reaction
     */
    @SubscribeMessage('comment:reaction:toggle')
    async handleToggleCommentReaction(
        @MessageBody() data: LegacyCommentReactionDto,
        @ConnectedSocket() client: Socket
    ) {
        const userId = client.data.userId;

        if (!userId) {
            return { success: false, error: 'User not authenticated' };
        }

        const factorId = data.commentId;
        const typeFactor = TypeFactor.COMMENT;
        const key = `${userId}:${typeFactor}:${factorId}`;
        const now = Date.now();

        const existing = pendingReactions.get(key);
        if (existing?.timeout) {
            clearTimeout(existing.timeout);
        }

        const timeout = setTimeout(async () => {
            try {
                const pending = pendingReactions.get(key);
                if (!pending) return;

                pendingReactions.delete(key);

                const result = await this.reactionService.toggleCommentReaction(
                    { commentId: factorId, type: pending.type as ReactionType },
                    userId
                );

                client.emit('comment:reaction:result', {
                    success: true,
                    commentId: factorId,
                    ...result,
                });

            } catch (error: any) {
                this.logger.error('Toggle comment reaction error:', error);
                client.emit('comment:reaction:result', {
                    success: false,
                    commentId: factorId,
                    error: error.message,
                });
            }
        }, RATE_LIMIT_WINDOW_MS);

        pendingReactions.set(key, { type: data.type, timestamp: now, timeout });
        return { success: true, queued: true };
    }

    /**
     * Get user's current reaction on a factor
     */
    @SubscribeMessage('reaction:get')
    async handleGetReaction(
        @MessageBody() data: { factorId: string; typeFactor: TypeFactor } | { postId: string },
        @ConnectedSocket() client: Socket
    ) {
        const userId = client.data.userId;

        if (!userId) {
            return { success: false, error: 'User not authenticated' };
        }

        try {
            let factorId: string;
            let typeFactor: TypeFactor;

            if ('postId' in data) {
                factorId = data.postId;
                typeFactor = TypeFactor.POST;
            } else {
                factorId = data.factorId;
                typeFactor = data.typeFactor;
            }

            const reaction = await this.reactionService.getUserReaction(factorId, typeFactor, userId);
            return { success: true, reaction };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Cleanup pending reactions for a user when they disconnect
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
