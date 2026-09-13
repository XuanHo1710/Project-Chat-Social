import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Server, Socket } from 'socket.io';
import { Model } from 'mongoose';
import { Account, AccountDocument } from 'src/account/entities/account.entity';
import { CommentService } from 'src/comment/comment.service';
import { ReactionService } from 'src/reaction/reaction.service';
import { TypeFactor } from 'src/reaction/entities/reaction.entity';
import { PostService } from 'src/post/post.service';
import { PresenceService } from 'src/common/presence/presence.service';

@Injectable()
export class LivestreamSignalingService {
  private logger = new Logger('LivestreamSignalingService');

  // Map to store broadcaster ID for each livestream
  private readonly livestreamBroadcasters = new Map<string, string>(); // postId -> broadcasterId
  // Map to store viewer IDs for each livestream (manual tracking since adapter.rooms doesn't work reliably)
  private readonly livestreamViewers = new Map<string, Set<string>>(); // postId -> Set of viewer userIds

  constructor(
    private readonly postService: PostService,
    private readonly commentService: CommentService,
    private readonly reactionService: ReactionService,
    private readonly presenceService: PresenceService,
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>
  ) {}

  async handleLivestreamJoin(
    server: Server,
    client: Socket,
    data: { postId: string; broadcasterId?: string }
  ) {
    const userId = client.data.userId as string | undefined;
    if (!userId) {
      return { success: false, error: 'Forbidden' };
    }
    const access = await this.postService.getLivestreamAccess(data.postId, userId);
    if (!access.canView) {
      return { success: false, error: 'Livestream is unavailable' };
    }

    const roomName = `livestream:${data.postId}`;
    client.join(roomName);

    const isBroadcaster = access.isBroadcaster;

    if (isBroadcaster) {
      // Store broadcaster ID for this livestream
      this.livestreamBroadcasters.set(data.postId, userId);
      // Initialize viewers set for this livestream
      if (!this.livestreamViewers.has(data.postId)) {
        this.livestreamViewers.set(data.postId, new Set());
      }
      this.logger.log(`[Livestream] Broadcaster ${userId} joined room ${data.postId}`);
    } else {
      // Add viewer to the set
      if (!this.livestreamViewers.has(data.postId)) {
        this.livestreamViewers.set(data.postId, new Set());
      }
      this.livestreamViewers.get(data.postId)!.add(userId);
      this.logger.log(`[Livestream] Viewer ${userId} joined room ${data.postId}`);
    }

    // Get viewer count from our manual tracking
    const viewerCount = this.livestreamViewers.get(data.postId)?.size || 0;

    this.logger.log(`[Livestream] Room ${data.postId}: viewerCount=${viewerCount}`);

    // Emit to entire room (including broadcaster)
    server.to(roomName).emit('livestream:viewers', {
      postId: data.postId,
      count: viewerCount,
    });

    // Also emit directly to broadcaster's sockets to ensure they receive update
    const broadcasterId = this.livestreamBroadcasters.get(data.postId);
    if (broadcasterId) {
      this.presenceService
        .getSockets(broadcasterId)
        .forEach((socketId) => {
          server.to(socketId).emit('livestream:viewers', {
            postId: data.postId,
            count: viewerCount,
          });
        });
    }
    return { success: true, isBroadcaster, viewerCount };
  }

  async handleLivestreamLeave(
    server: Server,
    client: Socket,
    data: { postId: string; broadcasterId?: string }
  ) {
    const userId = client.data.userId;
    const roomName = `livestream:${data.postId}`;
    client.leave(roomName);

    this.logger.log(`[Livestream] User ${userId} left room ${data.postId}`);

    // Remove viewer from Set
    if (this.livestreamViewers.has(data.postId)) {
      const hasAnotherViewerSocket = Array.from(this.presenceService.getSockets(userId)).some(
        (socketId) => {
          if (socketId === client.id) return false;
          return server.sockets.sockets.get(socketId)?.rooms.has(roomName) === true;
        }
      );
      if (!hasAnotherViewerSocket) {
        this.livestreamViewers.get(data.postId)!.delete(userId);
      }
    }

    // Get viewer count from our manual tracking
    const viewerCount = this.livestreamViewers.get(data.postId)?.size || 0;

    this.logger.log(`[Livestream] Room ${data.postId} after leave: viewerCount=${viewerCount}`);

    // Emit to entire room
    server.to(roomName).emit('livestream:viewers', {
      postId: data.postId,
      count: viewerCount,
    });

    // Also emit directly to broadcaster to ensure they receive update
    const broadcasterId = this.livestreamBroadcasters.get(data.postId);
    if (broadcasterId) {
      this.presenceService
        .getSockets(broadcasterId)
        .forEach((socketId) => {
          server.to(socketId).emit('livestream:viewers', {
            postId: data.postId,
            count: viewerCount,
          });
        });
    }
  }

  async handleLivestreamSignal(
    server: Server,
    client: Socket,
    data: { toUserId: string; signal: any; postId: string } // Generic P2P signal
  ) {
    const fromUserId = client.data.userId as string | undefined;
    const broadcasterId = this.livestreamBroadcasters.get(data.postId);
    const viewers = this.livestreamViewers.get(data.postId);
    const fromAuthorized =
      !!fromUserId && (fromUserId === broadcasterId || viewers?.has(fromUserId) === true);
    const targetAuthorized =
      data.toUserId === broadcasterId || viewers?.has(data.toUserId) === true;
    if (
      !fromUserId ||
      !broadcasterId ||
      !fromAuthorized ||
      !targetAuthorized ||
      (fromUserId !== broadcasterId && data.toUserId !== broadcasterId)
    ) {
      return { success: false, error: 'Forbidden' };
    }
    const targetSockets = this.presenceService.getSockets(data.toUserId);

    targetSockets.forEach((sId) => {
      server.to(sId).emit('livestream:signal', {
        fromUserId,
        signal: data.signal,
        postId: data.postId,
      });
    });
  }

  async handleLivestreamEnd(server: Server, client: Socket, data: { postId: string }) {
    const userId = client.data.userId as string | undefined;
    if (!userId || this.livestreamBroadcasters.get(data.postId) !== userId) {
      return { success: false, error: 'Only the broadcaster can end this livestream' };
    }
    await this.postService.endLivestream(data.postId, userId);
    this.logger.log(`[Livestream] Ending livestream ${data.postId}`);

    // Notify all viewers in the room
    server.to(`livestream:${data.postId}`).emit('livestream:ended', { postId: data.postId });
    // Clear room
    server.in(`livestream:${data.postId}`).socketsLeave(`livestream:${data.postId}`);
    // Cleanup broadcaster mapping
    this.livestreamBroadcasters.delete(data.postId);
    this.livestreamViewers.delete(data.postId);
    return { success: true };
  }

  // ============ LIVESTREAM COMMENTS & REACTIONS ============
  async handleLivestreamComment(
    server: Server,
    client: Socket,
    data: { postId: string; content: string }
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }
    if (
      this.livestreamBroadcasters.get(data.postId) !== userId &&
      !this.livestreamViewers.get(data.postId)?.has(userId)
    ) {
      return { success: false, error: 'Forbidden' };
    }
    const content = data.content?.trim().slice(0, 2000);
    if (!content) {
      return { success: false, error: 'Comment content is required' };
    }

    try {
      // Fetch full user info for comment service and response
      const user = await this.accountModel
        .findById(userId)
        .select('firstName lastName avatar _id username');
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // 1. Save to database
      const savedComment = await this.commentService.create(
        {
          content,
          postId: data.postId,
        },
        user // Pass full user object
      );

      // 2. Prepare payload for socket
      const comment = {
        id: savedComment._id.toString(), // Use DB ID
        userId: userId,
        userName: user.firstName ? `${user.firstName} ${user.lastName}` : user.username,
        userAvatar: user.avatar,
        content,
        createdAt: savedComment.createdAt.toISOString(),
      };

      // 3. Broadcast to all viewers in livestream room
      server.to(`livestream:${data.postId}`).emit('livestream:comment:new', {
        postId: data.postId,
        comment,
      });

      return { success: true, comment };
    } catch (err) {
      this.logger.error('Failed to send livestream comment', err);
      return { success: false, error: err.message };
    }
  }

  async handleLivestreamReaction(
    server: Server,
    client: Socket,
    data: { postId: string; emoji: string }
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }
    if (
      this.livestreamBroadcasters.get(data.postId) !== userId &&
      !this.livestreamViewers.get(data.postId)?.has(userId)
    ) {
      return { success: false, error: 'Forbidden' };
    }

    try {
      // Map emoji to ReactionType
      const emojiMap: Record<string, string> = {
        '👍': 'LIKE',
        '❤️': 'LOVE',
        '😂': 'HAHA',
        '😯': 'WOW',
        '😢': 'SAD',
        '😡': 'ANGRY',
      };
      const reactionType = emojiMap[data.emoji] || 'LIKE';

      // Fetch user info for reaction service (notification logic needs firstName/lastName)
      const user = await this.accountModel.findById(userId).select('firstName lastName avatar _id');
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // 1. Save reaction to DB (toggle)
      const result = await this.reactionService.toggleReaction(
        {
          type: reactionType as any,
          factorId: data.postId,
          typeFactor: TypeFactor.POST,
        },
        user
      );

      // Only emit if added or moved (not removed) - though for livestream we might want to show flying hearts even if toggled off
      // But standard logic is persistent state.
      // For floating animations, we might want to emit anyway.

      const reaction = {
        id: `${Date.now()}`, // Floating reaction doesn't need persistent ID for animation
        userId,
        emoji: data.emoji,
        createdAt: new Date().toISOString(),
        action: result.action,
      };

      // 2. Broadcast to all viewers in livestream room
      server.to(`livestream:${data.postId}`).emit('livestream:reaction:new', {
        postId: data.postId,
        reaction,
      });

      // 3. Global broadcast for Feed reaction counters
      server.to(`livestream:${data.postId}`).emit('post:reaction:update', {
        postId: data.postId,
        action: result.action,
        reactionType,
      });

      return { success: true, reaction };
    } catch (err) {
      this.logger.error('Failed to send livestream reaction', err);
      return { success: false, error: err.message };
    }
  }

  async handleLivestreamViewerCount(server: Server, client: Socket, data: { postId: string }) {
    try {
      const userId = client.data.userId as string | undefined;
      if (
        !userId ||
        (this.livestreamBroadcasters.get(data.postId) !== userId &&
          !this.livestreamViewers.get(data.postId)?.has(userId))
      ) {
        return { success: false, viewerCount: 0 };
      }

      // Get viewer count from our manual tracking
      const viewerCount = this.livestreamViewers.get(data.postId)?.size || 0;

      return { success: true, viewerCount };
    } catch (err) {
      this.logger.error('[Livestream] Error in viewer-count:', err);
      return { success: false, viewerCount: 0 };
    }
  }
}
