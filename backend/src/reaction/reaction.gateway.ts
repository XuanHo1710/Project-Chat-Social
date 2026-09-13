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
import { AccountService } from 'src/account/account.service';
import { SocketAuthService } from 'src/auth/socket-auth.service';
import { socketCorsOptions } from 'src/common/config/cors.config';
import { PresenceService } from 'src/common/presence/presence.service';

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
  cors: socketCorsOptions,
  namespace: '/reaction',
})
export class ReactionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  private logger = new Logger('ReactionGateway');

  constructor(
    private readonly reactionService: ReactionService,
    private readonly accountService: AccountService,
    private readonly socketAuthService: SocketAuthService,
    private readonly presenceService: PresenceService
  ) {}

  async handleConnection(client: Socket) {
    try {
      const { userId } = await this.socketAuthService.authenticate(client);
      client.join(`user:${userId}`);
      this.logger.log(`Client ${client.id} connected as user ${userId}`);

      this.presenceService.register(userId, client.id);
    } catch {
      this.logger.warn(`Rejected unauthorized reaction socket ${client.id}`);
      this.socketAuthService.reject(client);
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const userId = client.data.userId as string | undefined;

      if (userId) {
        this.presenceService.unregister(userId, client.id);
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
      if (userId) {
        this.cleanupUserPendingReactions(userId);
      }
      this.logger.log(`Client ${client.id} disconnected`);
    } catch (error) {
      this.logger.error('Disconnect error:', error);
    }
  }

  /**
   * Subscribe to reaction updates for a factor (post/comment/message)
   */
  @SubscribeMessage('factor:subscribe')
  async handleSubscribeFactor(
    @MessageBody() data: { factorId: string; typeFactor: TypeFactor },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId as string | undefined;
    if (!userId) return { success: false, error: 'Forbidden' };
    try {
      await this.reactionService.assertFactorAccess(data.factorId, data.typeFactor, userId);
    } catch {
      return { success: false, error: 'Forbidden' };
    }
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
  async handleSubscribePost(
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

    const { factorId, typeFactor } = this.normalizeReactionTarget(data);
    const type = data.type;

    if (!Object.values(ReactionType).includes(type)) {
      return { success: false, error: 'Invalid reaction type' };
    }
    try {
      await this.reactionService.assertFactorAccess(factorId, typeFactor, userId);
    } catch {
      return { success: false, error: 'Forbidden' };
    }

    const key = `${userId}:${typeFactor}:${factorId}`;
    const roomKey = `${typeFactor}:${factorId}`;

    this.enqueueReaction(key, type, async (pendingType) => {
      try {
        const user = client.data.account || (await this.accountService.findOne(userId));

        const result = await this.reactionService.toggleReaction(
          { factorId, typeFactor, type: pendingType },
          user
        );

        // Get updated top 3 reactions for broadcasting
        const topReactions = await this.reactionService.getTopReactions(factorId, typeFactor);

        // Emit to all users watching this factor
        this.server.to(roomKey).emit('reaction:updated', {
          factorId,
          typeFactor,
          postId: typeFactor === TypeFactor.POST ? factorId : undefined, // Legacy
          commentId: typeFactor === TypeFactor.COMMENT ? factorId : undefined, // Legacy
          userId,
          action: result.action,
          type: pendingType,
          totalReacts: result.totalReacts,
          topReactions,
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
    });

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

    const { factorId, typeFactor } = this.normalizeReactionTarget(data);
    const type = data.type;

    if (!Object.values(ReactionType).includes(type)) {
      return { success: false, error: 'Invalid reaction type' };
    }
    try {
      await this.reactionService.assertFactorAccess(factorId, typeFactor, userId);
    } catch {
      return { success: false, error: 'Forbidden' };
    }
    const key = `${userId}:${typeFactor}:${factorId}`;

    this.enqueueReaction(key, type, async (pendingType) => {
      try {
        const user = client.data.account || (await this.accountService.findOne(userId));

        const result = await this.reactionService.toggleCommentReaction(
          { commentId: factorId, type: pendingType },
          user
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
    });

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
      const { factorId, typeFactor } = this.normalizeReactionTarget(data);

      const reaction = await this.reactionService.getUserReaction(factorId, typeFactor, userId);
      return { success: true, reaction };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Normalize legacy payload shapes (postId / commentId) into the
   * canonical factor coordinates without changing accepted inputs.
   */
  private normalizeReactionTarget(
    data:
      | ToggleReactionDto
      | LegacyPostReactionDto
      | LegacyCommentReactionDto
      | { factorId: string; typeFactor: TypeFactor }
      | { postId: string }
  ): { factorId: string; typeFactor: TypeFactor } {
    if ('postId' in data) {
      return { factorId: data.postId, typeFactor: TypeFactor.POST };
    }
    if ('commentId' in data) {
      return { factorId: data.commentId, typeFactor: TypeFactor.COMMENT };
    }
    return { factorId: data.factorId, typeFactor: data.typeFactor };
  }

  /**
   * Debounced execution shared by every reaction toggle handler.
   * Cancels any queued reaction registered under the same key and
   * schedules fn to run once RATE_LIMIT_WINDOW_MS elapses quietly.
   */
  private enqueueReaction(
    key: string,
    type: ReactionType,
    fn: (type: ReactionType) => void | Promise<void>
  ) {
    const existing = pendingReactions.get(key);
    if (existing?.timeout) {
      clearTimeout(existing.timeout);
    }

    const timeout = setTimeout(() => {
      const pending = pendingReactions.get(key);
      if (!pending) return;

      pendingReactions.delete(key);
      void Promise.resolve(fn(pending.type as ReactionType)).catch((error: any) =>
        this.logger.error('Debounced reaction failed:', error)
      );
    }, RATE_LIMIT_WINDOW_MS);

    pendingReactions.set(key, { type, timestamp: Date.now(), timeout });
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

    keysToDelete.forEach((key) => pendingReactions.delete(key));
  }
}
