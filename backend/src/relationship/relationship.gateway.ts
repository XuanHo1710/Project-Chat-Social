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
import { CreateRelationshipDto } from 'src/relationship/dto/create-relationship.dto';
import { RelationshipService } from 'src/relationship/relationship.service';
import { SocketAuthService } from 'src/auth/socket-auth.service';
import { socketCorsOptions } from 'src/common/config/cors.config';
import { PresenceService } from 'src/common/presence/presence.service';

@WebSocketGateway({
  cors: socketCorsOptions,
  namespace: '/relationship',
})
export class RelationshipGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  private logger = new Logger('RelationshipGateway');

  constructor(
    private readonly relationshipService: RelationshipService,
    private readonly socketAuthService: SocketAuthService,
    private readonly presenceService: PresenceService
  ) {}

  async handleConnection(client: Socket) {
    try {
      const { userId } = await this.socketAuthService.authenticate(client);
      client.join(userId);

      // Lưu mapping userId -> Set<socketId> (support multiple devices)
      this.presenceService.register(userId, client.id);
    } catch {
      this.logger.warn(`Rejected unauthorized relationship socket ${client.id}`);
      this.socketAuthService.reject(client);
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const userId = client.data.userId as string | undefined;

      if (userId) {
        // Only broadcast offline if no more connections for this user
        if (this.presenceService.unregister(userId, client.id)) {
          // Update lastActive when user goes offline
          // const lastActive = new Date();
          // await this.userModel.findByIdAndUpdate(userId, {
          //     lastActive,
          // });
          // this.server.emit('user:offline', { userId, lastActive });
        }
      }
    } catch (error) {
      this.logger.error('Disconnect error:', error);
    }
  }

  //   Gửi lời mời kết bạn
  @SubscribeMessage('friend:request')
  async handleSendFriendRequest(
    @MessageBody() data: CreateRelationshipDto,
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;

    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const actorId = userId.toString();
      const friendId = data.friendId.toString();
      await this.relationshipService.addFriend({ ...data, userId: actorId as any });

      // Lấy data song song cho cả 2 người (tối ưu performance)
      const [sentForUserId, receivedForUserId, sentForFriendId, receivedForFriendId] =
        await Promise.all([
          this.relationshipService.getSentFriendRequests(actorId),
          this.relationshipService.getReceivedFriendRequests(actorId),
          this.relationshipService.getSentFriendRequests(friendId),
          this.relationshipService.getReceivedFriendRequests(friendId),
        ]);

      // Gửi cho người A (userId)
      this.server.to(actorId).emit('friend:sent', sentForUserId);
      this.server.to(actorId).emit('friend:received', receivedForUserId);

      // Gửi cho người B (friendId)
      this.server.to(friendId).emit('friend:sent', sentForFriendId);
      this.server.to(friendId).emit('friend:received', receivedForFriendId);

      return { success: true };
    } catch (err: any) {
      this.logger.error('Failed to send friend request', err);
      return { success: false, error: err.message || 'Failed to send friend request' };
    }
  }

  //  Hủy hoặc từ chối lời mời kết bạn
  @SubscribeMessage('friend:cancel')
  async handleCancelOrRejectedRequest(
    @MessageBody() data: CreateRelationshipDto,
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;

    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const actorId = userId.toString();
      const friendId = data.friendId.toString();
      await this.relationshipService.updateStatusRelationship(
        actorId,
        friendId,
        data.status || ''
      );

      // Lấy data song song cho cả 2 người (tối ưu performance)
      const [
        sentForUserId,
        receivedForUserId,
        friendsForUserId,
        sentForFriendId,
        receivedForFriendId,
        friendsForFriendId,
      ] = await Promise.all([
        this.relationshipService.getSentFriendRequests(actorId),
        this.relationshipService.getReceivedFriendRequests(actorId),
        this.relationshipService.getFriendsList(actorId),
        this.relationshipService.getSentFriendRequests(friendId),
        this.relationshipService.getReceivedFriendRequests(friendId),
        this.relationshipService.getFriendsList(friendId),
      ]);

      // Gửi cho người A (userId)
      this.server.to(actorId).emit('friend:sent', sentForUserId);
      this.server.to(actorId).emit('friend:received', receivedForUserId);
      this.server.to(actorId).emit('friend:friends', friendsForUserId);

      // Gửi cho người B (friendId)
      this.server.to(friendId).emit('friend:sent', sentForFriendId);
      this.server.to(friendId).emit('friend:received', receivedForFriendId);
      this.server.to(friendId).emit('friend:friends', friendsForFriendId);

      return { success: true };
    } catch (err: any) {
      this.logger.error('Failed to cancel friend request', err);
      return { success: false, error: err.message || 'Failed to cancel friend request' };
    }
  }

  //   Gửi lời mời kết bạn
  @SubscribeMessage('friend:accept')
  async handleAcceptRequest(
    @MessageBody() data: CreateRelationshipDto,
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;

    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const actorId = userId.toString();
      const friendId = data.friendId.toString();
      await this.relationshipService.acceptFriend(actorId, friendId);

      // Lấy data song song cho cả 2 người (tối ưu performance)
      const [
        sentForUserId,
        receivedForUserId,
        friendsForUserId,
        sentForFriendId,
        receivedForFriendId,
        friendsForFriendId,
      ] = await Promise.all([
        this.relationshipService.getSentFriendRequests(actorId),
        this.relationshipService.getReceivedFriendRequests(actorId),
        this.relationshipService.getFriendsList(actorId),
        this.relationshipService.getSentFriendRequests(friendId),
        this.relationshipService.getReceivedFriendRequests(friendId),
        this.relationshipService.getFriendsList(friendId),
      ]);

      // Gửi cho người A (userId)
      this.server.to(actorId).emit('friend:sent', sentForUserId);
      this.server.to(actorId).emit('friend:received', receivedForUserId);
      this.server.to(actorId).emit('friend:friends', friendsForUserId);

      // Gửi cho người B (friendId)
      this.server.to(friendId).emit('friend:sent', sentForFriendId);
      this.server.to(friendId).emit('friend:received', receivedForFriendId);
      this.server.to(friendId).emit('friend:friends', friendsForFriendId);

      return { success: true };
    } catch (err: any) {
      this.logger.error('Failed to accept friend request', err);
      return { success: false, error: err.message || 'Failed to accept friend request' };
    }
  }

  // Block a user
  @SubscribeMessage('user:block')
  async handleBlockUser(
    @MessageBody() data: { targetUserId: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;

    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      await this.relationshipService.blockUser(userId, data.targetUserId);

      // Notify both users about the block
      this.server.to(userId).emit('user:blocked', {
        blockedUserId: data.targetUserId,
        blockedByUserId: userId,
      });

      // Notify the blocked user that they were blocked (so they can update UI)
      this.server.to(data.targetUserId).emit('user:blockedBy', {
        blockedByUserId: userId,
      });

      // Update friends list for both (blocking removes friendship)
      const [friendsForUser, friendsForTarget] = await Promise.all([
        this.relationshipService.getFriendsList(userId),
        this.relationshipService.getFriendsList(data.targetUserId),
      ]);

      this.server.to(userId).emit('friend:friends', friendsForUser);
      this.server.to(data.targetUserId).emit('friend:friends', friendsForTarget);

      return { success: true };
    } catch (err: any) {
      this.logger.error('Failed to block user', err);
      return { success: false, error: err.message || 'Failed to block user' };
    }
  }

  // Unblock a user
  @SubscribeMessage('user:unblock')
  async handleUnblockUser(
    @MessageBody() data: { targetUserId: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;

    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      await this.relationshipService.unblockUser(userId, data.targetUserId);

      // Notify both users about the unblock
      this.server.to(userId).emit('user:unblocked', {
        unblockedUserId: data.targetUserId,
      });

      // Notify the unblocked user
      this.server.to(data.targetUserId).emit('user:unblockedBy', {
        unblockedByUserId: userId,
      });

      return { success: true };
    } catch (err: any) {
      this.logger.error('Failed to unblock user', err);
      return { success: false, error: err.message || 'Failed to unblock user' };
    }
  }

  // Restrict a user (hide conversation but still friends)
  @SubscribeMessage('user:restrict')
  async handleRestrictUser(
    @MessageBody() data: { targetUserId: string; conversationId?: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;

    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      await this.relationshipService.restrictUser(userId, data.targetUserId);

      // Notify the user who restricted (to hide conversation immediately)
      this.server.to(userId).emit('user:restricted', {
        restrictedUserId: data.targetUserId,
        conversationId: data.conversationId,
      });

      // Emit conversation:hidden event to hide the conversation from restricter's list
      if (data.conversationId) {
        this.server.to(userId).emit('conversation:hidden', {
          conversationId: data.conversationId,
          hiddenUserId: data.targetUserId,
          reason: 'restricted',
        });
      }

      return { success: true };
    } catch (err: any) {
      this.logger.error('Failed to restrict user', err);
      return { success: false, error: err.message || 'Failed to restrict user' };
    }
  }

  // Unrestrict a user
  @SubscribeMessage('user:unrestrict')
  async handleUnrestrictUser(
    @MessageBody() data: { targetUserId: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;

    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      await this.relationshipService.unrestrictUser(userId, data.targetUserId);

      // Notify the user who unrestricted (to show conversation again)
      this.server.to(userId).emit('user:unrestricted', {
        unrestrictedUserId: data.targetUserId,
      });

      // Emit conversation:shown event to show the conversation again
      this.server.to(userId).emit('conversation:shown', {
        hiddenUserId: data.targetUserId,
        reason: 'unrestricted',
      });

      return { success: true };
    } catch (err: any) {
      this.logger.error('Failed to unrestrict user', err);
      return { success: false, error: err.message || 'Failed to unrestrict user' };
    }
  }
}
