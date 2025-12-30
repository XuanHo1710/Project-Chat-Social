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

// Map để lưu userId -> Set<socketId> (support multiple connections per user)
const userSockets = new Map<string, Set<string>>();

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/relationship',
})
export class RelationshipGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  private logger = new Logger('RelationshipGateway');

  constructor(private readonly relationshipService: RelationshipService) { }

  async handleConnection(client: Socket) {
    try {
      const userId = client.handshake.query.userId as string;

      //  Lúc vô là join room theo userId để gửi request dễ hơn.
      client.join(userId);
      console.log(`Client ${client.id} joined room ${userId}`);

      if (!userId) {
        this.logger.warn(`Client ${client.id} connected without userId`);
        client.disconnect();
        return;
      }

      // Store userId in client data for later use
      client.data.userId = userId;

      // Lưu mapping userId -> Set<socketId> (support multiple devices)
      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
      }
      userSockets.get(userId)!.add(client.id);
    } catch { }
  }

  async handleDisconnect(client: Socket) {
    try {
      const userId = client.data.userId || (client.handshake.query.userId as string);

      if (userId && userSockets.has(userId)) {
        const sockets = userSockets.get(userId)!;
        sockets.delete(client.id);

        // Only broadcast offline if no more connections for this user
        if (sockets.size === 0) {
          userSockets.delete(userId);

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
      await this.relationshipService.addFriend(data);

      // Lấy data song song cho cả 2 người (tối ưu performance)
      const [sentForUserId, receivedForUserId, sentForFriendId, receivedForFriendId] =
        await Promise.all([
          this.relationshipService.getSentFriendRequests(data.userId.toString()),
          this.relationshipService.getReceivedFriendRequests(data.userId.toString()),
          this.relationshipService.getSentFriendRequests(data.friendId.toString()),
          this.relationshipService.getReceivedFriendRequests(data.friendId.toString()),
        ]);

      // Gửi cho người A (userId)
      this.server.to(data.userId.toString()).emit('friend:sent', sentForUserId);
      this.server.to(data.userId.toString()).emit('friend:received', receivedForUserId);

      // Gửi cho người B (friendId)
      this.server.to(data.friendId.toString()).emit('friend:sent', sentForFriendId);
      this.server.to(data.friendId.toString()).emit('friend:received', receivedForFriendId);
    } catch (err) {
      this.logger.error('Failed to save message', err);
      return { success: false, error: 'Failed to save message' };
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
      await this.relationshipService.updateStatusRelationship(
        data.userId.toString(),
        data.friendId.toString(),
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
        this.relationshipService.getSentFriendRequests(data.userId.toString()),
        this.relationshipService.getReceivedFriendRequests(data.userId.toString()),
        this.relationshipService.getFriendsList(data.userId.toString()),
        this.relationshipService.getSentFriendRequests(data.friendId.toString()),
        this.relationshipService.getReceivedFriendRequests(data.friendId.toString()),
        this.relationshipService.getFriendsList(data.friendId.toString()),
      ]);

      // Gửi cho người A (userId)
      this.server.to(data.userId.toString()).emit('friend:sent', sentForUserId);
      this.server.to(data.userId.toString()).emit('friend:received', receivedForUserId);
      this.server.to(data.userId.toString()).emit('friend:friends', friendsForUserId);

      // Gửi cho người B (friendId)
      this.server.to(data.friendId.toString()).emit('friend:sent', sentForFriendId);
      this.server.to(data.friendId.toString()).emit('friend:received', receivedForFriendId);
      this.server.to(data.friendId.toString()).emit('friend:friends', friendsForFriendId);
    } catch (err) {
      this.logger.error('Failed to save message', err);
      return { success: false, error: 'Failed to save message' };
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
      await this.relationshipService.acceptFriend(data.userId.toString(), data.friendId.toString());

      // Lấy data song song cho cả 2 người (tối ưu performance)
      const [
        sentForUserId,
        receivedForUserId,
        friendsForUserId,
        sentForFriendId,
        receivedForFriendId,
        friendsForFriendId,
      ] = await Promise.all([
        this.relationshipService.getSentFriendRequests(data.userId.toString()),
        this.relationshipService.getReceivedFriendRequests(data.userId.toString()),
        this.relationshipService.getFriendsList(data.userId.toString()),
        this.relationshipService.getSentFriendRequests(data.friendId.toString()),
        this.relationshipService.getReceivedFriendRequests(data.friendId.toString()),
        this.relationshipService.getFriendsList(data.friendId.toString()),
      ]);

      // Gửi cho người A (userId)
      this.server.to(data.userId.toString()).emit('friend:sent', sentForUserId);
      this.server.to(data.userId.toString()).emit('friend:received', receivedForUserId);
      this.server.to(data.userId.toString()).emit('friend:friends', friendsForUserId);

      // Gửi cho người B (friendId)
      this.server.to(data.friendId.toString()).emit('friend:sent', sentForFriendId);
      this.server.to(data.friendId.toString()).emit('friend:received', receivedForFriendId);
      this.server.to(data.friendId.toString()).emit('friend:friends', friendsForFriendId);
    } catch (err) {
      this.logger.error('Failed to save message', err);
      return { success: false, error: 'Failed to save message' };
    }
  }
}
