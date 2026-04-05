import { Inject, Logger } from '@nestjs/common';
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
import { ChatService } from 'src/chat/chat.service';
import { CreateMessageDto } from 'src/chat/dto/create-message.dto';
import { ConversationService } from 'src/conversation/conversation.service';
import { InjectModel } from '@nestjs/mongoose';
import { Account, AccountDocument } from 'src/account/entities/account.entity';
import { Model, Types } from 'mongoose';
import { EmotionType, MessageType } from './entities/message.entity';
import { RelationshipService } from 'src/relationship/relationship.service';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { Conversation } from 'src/conversation/entities/conversation.entity';
import { FirebaseService } from 'src/firebase/firebase.service';
import { CommentService } from 'src/comment/comment.service';
import { ReactionService } from 'src/reaction/reaction.service';
import { TypeFactor } from 'src/reaction/entities/reaction.entity';
import { ClientProxy } from '@nestjs/microservices';

interface CallPayload {
  toUserId: string;
  offer: any;
  conversationId: string;
  callType?: 'AUDIO' | 'VIDEO';
}

interface AnswerPayload {
  toUserId: string;
  answer: any;
  conversationId: string;
}

interface IceCandidatePayload {
  toUserId: string;
  candidate: any;
  conversationId: string;
}

// Map để lưu userId -> Set<socketId> (support multiple connections per user)
const userSockets = new Map<string, Set<string>>();

// Store pending calls for persistence on reload (recipientId -> CallData)
const pendingCalls = new Map<
  string,
  {
    fromUserId: string;
    offer: any;
    conversationId: string;
    timestamp: number;
    callType: 'AUDIO' | 'VIDEO';
    answered: boolean;
  }
>();

// Map conversationId -> Set<userId> for active group calls
const activeGroupCalls = new Map<string, Set<string>>();

// Map socketId -> Set<conversationId> that this socket joined for group calls
const socketGroupCalls = new Map<string, Set<string>>();

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  private logger = new Logger('ChatGateway');

  constructor(
    private readonly conversationService: ConversationService,
    private readonly chatService: ChatService,
    private readonly relationshipService: RelationshipService,
    private readonly httpService: HttpService,
    private readonly firebaseService: FirebaseService,
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    @Inject('RABBITMQ_SERVICE') private readonly rabbitMQService: ClientProxy,
    private readonly commentService: CommentService,
    private readonly reactionService: ReactionService
  ) {}

  private readonly aiServerUrl = 'http://localhost:8000/api/v1';

  private isAdminBlockActive(account: Partial<Account>): boolean {
    if (!account?.isBlocked) return false;
    if (!account?.expireBlockAt) return true;
    return new Date(account.expireBlockAt) > new Date();
  }

  private isSelfBlockActive(account: Partial<Account>): boolean {
    if (!account?.selfBlockedAt || !account?.selfBlockExpireAt) return false;
    return new Date(account.selfBlockExpireAt) > new Date();
  }

  private isAccountAccessDenied(account: Partial<Account> | null): boolean {
    if (!account) return true;
    if (account.isActive === false) return true;
    if (this.isAdminBlockActive(account)) return true;
    if (this.isSelfBlockActive(account)) return true;
    return false;
  }

  private async isRealtimeAccessDenied(userId: string): Promise<boolean> {
    const account = await this.accountModel
      .findById(userId)
      .select('isBlocked expireBlockAt selfBlockedAt selfBlockExpireAt isActive')
      .lean();

    return this.isAccountAccessDenied(account as Partial<Account> | null);
  }

  private ensureSocketGroupCalls(socketId: string) {
    if (!socketGroupCalls.has(socketId)) {
      socketGroupCalls.set(socketId, new Set());
    }
  }

  private trackSocketGroupCall(socketId: string, conversationId: string) {
    this.ensureSocketGroupCalls(socketId);
    socketGroupCalls.get(socketId)!.add(conversationId);
  }

  private untrackSocketGroupCall(socketId: string, conversationId: string) {
    const calls = socketGroupCalls.get(socketId);
    if (!calls) return;

    calls.delete(conversationId);
    if (calls.size === 0) {
      socketGroupCalls.delete(socketId);
    }
  }

  private hasAnotherSocketInGroupCall(
    userId: string,
    conversationId: string,
    currentSocketId: string
  ): boolean {
    const sockets = userSockets.get(userId);
    if (!sockets || sockets.size === 0) return false;

    for (const socketId of sockets) {
      if (socketId === currentSocketId) continue;
      if (socketGroupCalls.get(socketId)?.has(conversationId)) {
        return true;
      }
    }

    return false;
  }

  private cleanupStaleGroupParticipants(conversationId: string): Set<string> {
    if (!activeGroupCalls.has(conversationId)) {
      activeGroupCalls.set(conversationId, new Set());
    }

    const participants = activeGroupCalls.get(conversationId)!;

    Array.from(participants).forEach((participantId) => {
      const sockets = userSockets.get(participantId);
      const hasJoinedSocket =
        sockets &&
        Array.from(sockets).some((socketId) => socketGroupCalls.get(socketId)?.has(conversationId));

      if (!hasJoinedSocket) {
        participants.delete(participantId);
      }
    });

    if (participants.size === 0) {
      activeGroupCalls.delete(conversationId);
      activeGroupCalls.set(conversationId, new Set());
    }

    return activeGroupCalls.get(conversationId)!;
  }

  private async removeUserFromGroupCall(conversationId: string, userId: string, userName?: string) {
    const currentParticipants = activeGroupCalls.get(conversationId);
    if (!currentParticipants || !currentParticipants.has(userId)) {
      return;
    }

    currentParticipants.delete(userId);

    const name = userName || (await this.getUserDisplayName(userId)) || 'Someone';

    currentParticipants.forEach((pId) => {
      const sockets = userSockets.get(pId);
      if (sockets) {
        sockets.forEach((sId) => {
          this.server.to(sId).emit('group-call:user-left', { userId, userName: name });
        });
      }
    });

    if (currentParticipants.size === 0) {
      activeGroupCalls.delete(conversationId);
      try {
        await this.finalizeGroupCallMessage(conversationId);
      } catch (err) {
        this.logger.error('Failed to finalize group call message:', err);
      }
    }
  }

  async handleConnection(client: Socket) {
    try {
      const userId = client.handshake.query.userId as string;

      if (!userId) {
        this.logger.warn(`Client ${client.id} connected without userId`);
        client.disconnect();
        return;
      }

      const accessAccount = await this.accountModel
        .findById(userId)
        .select('isBlocked expireBlockAt selfBlockedAt selfBlockExpireAt isActive')
        .lean();

      if (this.isAccountAccessDenied(accessAccount as Partial<Account> | null)) {
        this.logger.warn(`Blocked or inactive account tried to connect socket: ${userId}`);
        client.emit('auth:error', {
          message: 'Tài khoản đã bị khóa hoặc vô hiệu hóa',
        });
        client.disconnect();
        return;
      }

      // Store userId in client data for later use
      client.data.userId = userId;
      this.ensureSocketGroupCalls(client.id);

      // Check if this is the first connection for this user
      const isFirstConnection = !userSockets.has(userId) || userSockets.get(userId)!.size === 0;

      // Lưu mapping userId -> Set<socketId> (support multiple devices)
      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
      }
      userSockets.get(userId)!.add(client.id);

      // Join user vào room của chính họ
      client.join(`user:${userId}`);

      // If first connection, update status to ACTIVE
      if (isFirstConnection) {
        const account = await this.accountModel.findByIdAndUpdate(
          userId,
          {
            status: 'ACTIVE',
            lastLogin: new Date(),
          },
          { new: true }
        );

        // Only broadcast online status if user allows showing activity status
        if (account?.showActivityStatus !== false) {
          this.server.emit('user:online', {
            userId,
            status: 'ACTIVE',
            lastLogin: new Date(),
          });
        }

        this.logger.log(
          `User ${userId} is now ONLINE (showActivityStatus: ${account?.showActivityStatus})`
        );
      }

      // Join user vào tất cả conversations của họ
      const conversations = await this.conversationService.findConversationByUserId(userId);
      conversations.forEach((conv) => {
        client.join(`room:${conv._id.toString()}`);
      });

      // CHECK PENDING CALLS (Persistence)
      // Check 1v1 pending calls
      const pendingCall = pendingCalls.get(userId);
      if (pendingCall) {
        // Check expiry (e.g. 45 seconds)
        if (Date.now() - pendingCall.timestamp < 45000) {
          const callerProfile = await this.getSenderProfile(pendingCall.fromUserId);
          client.emit('call:incoming', {
            fromUserId: pendingCall.fromUserId,
            callerName: callerProfile.name,
            callerAvatar: callerProfile.avatar,
            offer: pendingCall.offer,
            conversationId: pendingCall.conversationId,
          });
          this.logger.log(`Re-emitted pending call to ${userId}`);
        } else {
          pendingCalls.delete(userId);
        }
      }

      // Check active group calls? Maybe notify if a group call is active in one of their rooms?
      // (Optional - for now user sees it via UI "Join" button if we implement that, or Notification Persistence)
    } catch (error) {
      this.logger.error('Connection error:', error);
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const userId = client.data.userId || (client.handshake.query.userId as string);

      const joinedCalls = new Set(socketGroupCalls.get(client.id) || []);
      let userNameForCall: string | undefined;

      if (userId && joinedCalls.size > 0) {
        for (const conversationId of joinedCalls) {
          if (!this.hasAnotherSocketInGroupCall(userId, conversationId, client.id)) {
            if (!userNameForCall) {
              userNameForCall = await this.getUserDisplayName(userId);
            }
            await this.removeUserFromGroupCall(conversationId, userId, userNameForCall);
          }
        }
      }

      socketGroupCalls.delete(client.id);

      if (userId && userSockets.has(userId)) {
        const sockets = userSockets.get(userId)!;
        sockets.delete(client.id);

        // Only update status to offline if no more connections for this user
        if (sockets.size === 0) {
          userSockets.delete(userId);

          // Update status to DEACTIVE and lastActive
          const lastActive = new Date();
          const account = await this.accountModel.findByIdAndUpdate(
            userId,
            {
              status: 'DEACTIVE',
              lastActive,
            },
            { new: true }
          );

          // Only broadcast offline status if user allows showing activity status
          if (account?.showActivityStatus !== false) {
            this.server.emit('user:offline', {
              userId,
              status: 'DEACTIVE',
              lastActive,
            });
          }

          this.logger.log(
            `User ${userId} is now OFFLINE (showActivityStatus: ${account?.showActivityStatus})`
          );
        }
      }
    } catch (error) {
      this.logger.error('Disconnect error:', error);
    }
  }

  @SubscribeMessage('room')
  async handleJoinConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket
  ) {
    client.join(`room:${data.conversationId}`);
    return { success: true };
  }

  // ============ VIDEO CALL SIGNALING ============

  @SubscribeMessage('call:start')
  async handleCallStart(@MessageBody() data: CallPayload, @ConnectedSocket() client: Socket) {
    const fromUserId = client.data.userId;

    if (!fromUserId) {
      return { success: false, reason: 'User not authenticated' };
    }

    if (await this.isRealtimeAccessDenied(fromUserId)) {
      return { success: false, reason: 'Tài khoản đã bị khóa hoặc vô hiệu hóa' };
    }

    const blocked = await this.relationshipService.isUserBlocked(fromUserId, data.toUserId);
    if (blocked) {
      return {
        success: false,
        reason: 'Không thể gọi vì một trong hai bên đã chặn nhau',
      };
    }

    // Tìm socket của người nhận
    const recipientSockets = userSockets.get(data.toUserId);

    // Lấy thông tin người gọi
    const callerProfile = await this.getSenderProfile(fromUserId);

    // Save pending call for reliability/refresh
    pendingCalls.set(data.toUserId, {
      fromUserId,
      offer: data.offer,
      conversationId: data.conversationId,
      timestamp: Date.now(),
      callType: data.callType || 'VIDEO',
      answered: false,
    });

    if (recipientSockets && recipientSockets.size > 0) {
      recipientSockets.forEach((socketId) => {
        this.server.to(socketId).emit('call:incoming', {
          fromUserId,
          callerName: callerProfile.name,
          callerAvatar: callerProfile.avatar,
          offer: data.offer,
          conversationId: data.conversationId,
        });
      });
      // Báo lại cho người gọi là đã đổ chuông
      return { success: true };
    } else {
      // Người nhận offline, vẫn giữ pending call một lúcเผื่อ online lại
      return { success: false, reason: 'User offline (Calling...)' };
    }
  }

  @SubscribeMessage('call:answer')
  async handleCallAnswer(@MessageBody() data: AnswerPayload, @ConnectedSocket() client: Socket) {
    const fromUserId = client.data.userId; // Người nhận (Callee) trả lời

    // Mark call as answered (keep pending for duration tracking)
    const pending = pendingCalls.get(fromUserId);
    if (pending) {
      pending.answered = true;
      pending.timestamp = Date.now(); // Reset timestamp to track call duration from answer
    }

    // Gửi answer lại cho người gọi (Caller)
    const callerSockets = userSockets.get(data.toUserId);
    if (callerSockets) {
      callerSockets.forEach((socketId) => {
        this.server.to(socketId).emit('call:accepted', {
          fromUserId, // ID của người nhận
          answer: data.answer,
        });
      });
    }
  }

  @SubscribeMessage('call:ice-candidate')
  async handleIceCandidate(
    @MessageBody() data: IceCandidatePayload,
    @ConnectedSocket() client: Socket
  ) {
    const fromUserId = client.data.userId;

    const targetSockets = userSockets.get(data.toUserId);
    if (targetSockets) {
      targetSockets.forEach((socketId) => {
        this.server.to(socketId).emit('call:ice-candidate', {
          fromUserId,
          candidate: data.candidate,
        });
      });
    }
  }

  @SubscribeMessage('call:end')
  async handleCallEnd(
    @MessageBody() data: { toUserId: string; conversationId?: string },
    @ConnectedSocket() client: Socket
  ) {
    const fromUserId = client.data.userId;
    const targetSockets = userSockets.get(data.toUserId);

    // Find the pending call to determine status and duration
    const pendingAsCallee = pendingCalls.get(fromUserId); // callee rejects/ends
    const pendingAsCaller = pendingCalls.get(data.toUserId); // caller cancels/ends
    const pending = pendingAsCallee || pendingAsCaller;

    // Remove pending calls
    pendingCalls.delete(data.toUserId);
    pendingCalls.delete(fromUserId);

    if (targetSockets) {
      targetSockets.forEach((socketId) => {
        this.server.to(socketId).emit('call:ended', { fromUserId });
      });
    }

    // Create call history message
    const conversationId = data.conversationId || pending?.conversationId;
    if (conversationId) {
      try {
        let callStatus: 'ANSWERED' | 'MISSED' | 'CANCELLED' = 'CANCELLED';
        let duration = 0;
        const callType = pending?.callType || 'VIDEO';

        if (pending?.answered) {
          callStatus = 'ANSWERED';
          duration = Math.round((Date.now() - pending.timestamp) / 1000);
        } else if (pendingAsCaller) {
          // Caller cancelled before answer
          callStatus = 'CANCELLED';
        } else {
          // Callee rejected or timeout
          callStatus = 'MISSED';
        }

        await this.createCallMessage(
          conversationId,
          fromUserId,
          callType,
          callStatus,
          duration,
          false
        );
      } catch (err) {
        this.logger.error('Failed to create call message:', err);
      }
    }
  }

  // ============ GROUP VIDEO CALL ============
  @SubscribeMessage('group-call:start')
  async handleGroupCallStart(
    @MessageBody() data: { conversationId: string; callType?: 'AUDIO' | 'VIDEO' },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    if (await this.isRealtimeAccessDenied(userId)) {
      return { success: false, error: 'Tài khoản đã bị khóa hoặc vô hiệu hóa' };
    }

    const conversation = await this.conversationService.findById(data.conversationId);
    if (!conversation) {
      return { success: false, error: 'Conversation not found' };
    }

    const callerProfile = await this.getSenderProfile(userId);

    const activeParticipants = this.cleanupStaleGroupParticipants(data.conversationId);
    const starterAlreadyInCall = activeParticipants.has(userId);

    // Track starter immediately so we can correctly finalize call history on leave/disconnect.
    this.trackSocketGroupCall(client.id, data.conversationId);
    activeParticipants.add(userId);

    // Create a CALL message whenever starter is not currently in the active call set.
    // This avoids stale participant states blocking new joinable call messages.
    if (!starterAlreadyInCall) {
      try {
        await this.createCallMessage(
          data.conversationId,
          userId,
          data.callType || 'VIDEO',
          'ONGOING',
          0,
          true
        );
      } catch (err) {
        this.logger.error('Failed to create group call message:', err);
      }
    }

    // Notify only participants NOT already in the call
    conversation.participants.forEach((p) => {
      const pId = p.user._id.toString();
      if (pId === userId) return; // Don't notify self
      if (activeParticipants.has(pId)) return; // Don't notify users already in the call

      const sockets = userSockets.get(pId);
      if (sockets) {
        sockets.forEach((sId) => {
          this.server.to(sId).emit('group-call:incoming', {
            conversationId: data.conversationId,
            callerName: callerProfile.name,
            callerAvatar: callerProfile.avatar,
            fromUserId: userId,
            isGroup: true,
          });
        });
      }
    });
  }

  @SubscribeMessage('group-call:join')
  async handleGroupCallJoin(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, users: [] };
    }

    if (await this.isRealtimeAccessDenied(userId)) {
      return { success: false, users: [] };
    }

    const currentParticipants = this.cleanupStaleGroupParticipants(data.conversationId);
    this.trackSocketGroupCall(client.id, data.conversationId);

    if (currentParticipants) {
      const alreadyJoined = currentParticipants.has(userId);

      // Notify existing participants that a new user joined
      if (!alreadyJoined) {
        currentParticipants.forEach((pId) => {
          if (pId === userId) return;
          const sockets = userSockets.get(pId);
          if (sockets) {
            sockets.forEach((sId) => {
              this.server.to(sId).emit('group-call:user-joined', { userId });
            });
          }
        });
      }

      // Add current user
      currentParticipants.add(userId);

      // Return list of existing users to the joiner
      // They will initiate P2P connections to these users
      const participantsList = Array.from(currentParticipants).filter((id) => id !== userId);
      return { success: true, users: participantsList };
    }

    return { success: false, users: [] };
  }

  @SubscribeMessage('group-call:leave')
  async handleGroupCallLeave(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    this.untrackSocketGroupCall(client.id, data.conversationId);

    if (this.hasAnotherSocketInGroupCall(userId, data.conversationId, client.id)) {
      return;
    }

    try {
      const userName = await this.getUserDisplayName(userId);
      await this.removeUserFromGroupCall(data.conversationId, userId, userName);
    } catch (err) {
      this.logger.error('Failed to process group call leave:', err);
    }
  }

  @SubscribeMessage('group-call:check')
  async handleGroupCallCheck(@MessageBody() data: { conversationId: string }) {
    const participants = this.cleanupStaleGroupParticipants(data.conversationId);
    if (participants && participants.size > 0) {
      return { active: true, participantCount: participants.size };
    }

    activeGroupCalls.delete(data.conversationId);
    return { active: false, participantCount: 0 };
  }

  @SubscribeMessage('call:signal')
  async handleCallSignal(
    @MessageBody() data: { toUserId: string; signal: any; conversationId: string }, // Generic signal (offer/answer/ice)
    @ConnectedSocket() client: Socket
  ) {
    const fromUserId = client.data.userId;
    const targetSockets = userSockets.get(data.toUserId);
    if (targetSockets) {
      targetSockets.forEach((sId) => {
        this.server.to(sId).emit('call:signal', {
          fromUserId,
          signal: data.signal,
          conversationId: data.conversationId,
        });
      });
    }
  }

  // ============ LIVESTREAM SIGNALING ============
  // Map to store broadcaster ID for each livestream
  private livestreamBroadcasters = new Map<string, string>(); // postId -> broadcasterId
  // Map to store viewer IDs for each livestream (manual tracking since adapter.rooms doesn't work reliably)
  private livestreamViewers = new Map<string, Set<string>>(); // postId -> Set of viewer userIds

  @SubscribeMessage('livestream:join')
  async handleLivestreamJoin(
    @MessageBody() data: { postId: string; broadcasterId?: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    const roomName = `livestream:${data.postId}`;
    client.join(roomName);

    // Check if this is the broadcaster joining (broadcasterId matches current user)
    const isBroadcaster = data.broadcasterId && data.broadcasterId === userId;

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
    this.server.to(roomName).emit('livestream:viewers', {
      postId: data.postId,
      count: viewerCount,
    });

    // Also emit directly to broadcaster's sockets to ensure they receive update
    const broadcasterId = this.livestreamBroadcasters.get(data.postId);
    if (broadcasterId) {
      const broadcasterSockets = userSockets.get(broadcasterId);
      if (broadcasterSockets) {
        broadcasterSockets.forEach((socketId) => {
          this.server.to(socketId).emit('livestream:viewers', {
            postId: data.postId,
            count: viewerCount,
          });
        });
      }
    }
  }

  @SubscribeMessage('livestream:leave')
  async handleLivestreamLeave(
    @MessageBody() data: { postId: string; broadcasterId?: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    const roomName = `livestream:${data.postId}`;
    client.leave(roomName);

    this.logger.log(`[Livestream] User ${userId} left room ${data.postId}`);

    // Remove viewer from Set
    if (this.livestreamViewers.has(data.postId)) {
      this.livestreamViewers.get(data.postId)!.delete(userId);
    }

    // Get viewer count from our manual tracking
    const viewerCount = this.livestreamViewers.get(data.postId)?.size || 0;

    this.logger.log(`[Livestream] Room ${data.postId} after leave: viewerCount=${viewerCount}`);

    // Emit to entire room
    this.server.to(roomName).emit('livestream:viewers', {
      postId: data.postId,
      count: viewerCount,
    });

    // Also emit directly to broadcaster to ensure they receive update
    const broadcasterId = this.livestreamBroadcasters.get(data.postId);
    if (broadcasterId) {
      const broadcasterSockets = userSockets.get(broadcasterId);
      if (broadcasterSockets) {
        broadcasterSockets.forEach((socketId) => {
          this.server.to(socketId).emit('livestream:viewers', {
            postId: data.postId,
            count: viewerCount,
          });
        });
      }
    }
  }

  @SubscribeMessage('livestream:signal')
  async handleLivestreamSignal(
    @MessageBody() data: { toUserId: string; signal: any; postId: string }, // Generic P2P signal
    @ConnectedSocket() client: Socket
  ) {
    const fromUserId = client.data.userId;
    const targetSockets = userSockets.get(data.toUserId);

    if (targetSockets) {
      targetSockets.forEach((sId) => {
        this.server.to(sId).emit('livestream:signal', {
          fromUserId,
          signal: data.signal,
          postId: data.postId,
        });
      });
    }
  }

  @SubscribeMessage('livestream:end')
  async handleLivestreamEnd(
    @MessageBody() data: { postId: string },
    @ConnectedSocket() client: Socket
  ) {
    this.logger.log(`[Livestream] Ending livestream ${data.postId}`);

    // Notify all viewers in the room
    this.server.to(`livestream:${data.postId}`).emit('livestream:ended', { postId: data.postId });
    // Clear room
    this.server.in(`livestream:${data.postId}`).socketsLeave(`livestream:${data.postId}`);
    // Cleanup broadcaster mapping
    this.livestreamBroadcasters.delete(data.postId);
    this.livestreamViewers.delete(data.postId);
  }

  // ============ LIVESTREAM COMMENTS & REACTIONS ============
  @SubscribeMessage('livestream:comment')
  async handleLivestreamComment(
    @MessageBody() data: { postId: string; content: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
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
          content: data.content,
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
        content: data.content,
        createdAt: savedComment.createdAt.toISOString(),
      };

      // 3. Broadcast to all viewers in livestream room
      this.server.to(`livestream:${data.postId}`).emit('livestream:comment:new', {
        postId: data.postId,
        comment,
      });

      return { success: true, comment };
    } catch (err) {
      this.logger.error('Failed to send livestream comment', err);
      return { success: false, error: err.message };
    }
  }

  @SubscribeMessage('livestream:reaction')
  async handleLivestreamReaction(
    @MessageBody() data: { postId: string; emoji: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
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
      this.server.to(`livestream:${data.postId}`).emit('livestream:reaction:new', {
        postId: data.postId,
        reaction,
      });

      // 3. Global broadcast for Feed reaction counters
      this.server.emit('post:reaction:update', {
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

  @SubscribeMessage('livestream:viewer-count')
  async handleLivestreamViewerCount(
    @MessageBody() data: { postId: string },
    @ConnectedSocket() client: Socket
  ) {
    try {
      const roomName = `livestream:${data.postId}`;

      // Get viewer count from our manual tracking
      const viewerCount = this.livestreamViewers.get(data.postId)?.size || 0;

      return { success: true, viewerCount };
    } catch (err) {
      this.logger.error('[Livestream] Error in viewer-count:', err);
      return { success: false, viewerCount: 0 };
    }
  }

  // ============ ACTIVITY STATUS TOGGLE ============
  @SubscribeMessage('activity:toggle')
  async handleActivityToggle(
    @MessageBody() data: { showActivityStatus: boolean },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    // Get current user status
    const account = await this.accountModel.findById(userId).select('status lastActive lastLogin');
    if (!account) return;

    if (data.showActivityStatus) {
      // User wants to show activity status - broadcast current status
      if (account.status === 'ACTIVE') {
        this.server.emit('user:online', {
          userId,
          status: 'ACTIVE',
          lastLogin: account.lastLogin,
        });
      } else {
        this.server.emit('user:offline', {
          userId,
          status: 'DEACTIVE',
          lastActive: account.lastActive,
        });
      }
    } else {
      // User wants to hide activity status - broadcast as offline
      this.server.emit('user:offline', {
        userId,
        status: 'HIDDEN',
        lastActive: null,
      });
    }

    this.logger.log(`User ${userId} toggled activity status to ${data.showActivityStatus}`);
    return { success: true };
  }

  // ============ TYPING INDICATOR ============
  @SubscribeMessage('typing:start')
  async handleTypingStart(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    // Emit typing event to all users in the conversation except sender
    client.to(`room:${data.conversationId}`).emit('typing:start', {
      conversationId: data.conversationId,
      userId,
    });
  }

  @SubscribeMessage('typing:stop')
  async handleTypingStop(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    client.to(`room:${data.conversationId}`).emit('typing:stop', {
      conversationId: data.conversationId,
      userId,
    });
  }

  @SubscribeMessage('message')
  async handleSendMessage(
    @MessageBody() data: CreateMessageDto,
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;

    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    if (await this.isRealtimeAccessDenied(userId)) {
      return { success: false, error: 'Tài khoản đã bị khóa hoặc vô hiệu hóa' };
    }

    try {
      // Kiểm tra user có bị kick hoặc left trước khi cho gửi message
      const conversation = await this.conversationService.findById(data.conversationId.toString());

      const senderParticipant = conversation.participants.find(
        (p) => p.user._id.toString() === userId.toString()
      );

      if (!senderParticipant || senderParticipant.kickedAt || senderParticipant.leftAt) {
        client.leave(`room:${data.conversationId.toString()}`);
        return {
          success: false,
          error: 'You are not allowed to send messages in this conversation',
        };
      }

      // Check if this is a DIRECT conversation and if either user has blocked the other
      if (conversation.type === 'DIRECT') {
        const otherParticipant = conversation.participants.find(
          (p) => p.user._id.toString() !== userId.toString()
        );

        if (otherParticipant) {
          const otherUserId = otherParticipant.user._id.toString();
          const isBlocked = await this.relationshipService.isUserBlocked(userId, otherUserId);

          if (isBlocked) {
            return {
              success: false,
              error: 'Bạn không thể gửi tin nhắn cho người dùng này do một trong hai bên đã chặn',
            };
          }
        }
      }

      const savedMessage = await this.chatService.sendMessage(data);

      if (!savedMessage) {
        return { success: false, error: 'Failed to save message' };
      }

      await this.handleEmitMessageToClient(savedMessage, data, conversation, userId);

      // 4️⃣ Emit EVENT cho RabbitMQ (ASYNC processing - AI chatbot + FCM notification)
      // Determine if AI should reply
      const isChatbotConversation = conversation.type === 'CHATBOT';
      const isChatbotMentioned = data.content && data.content.includes('@[chatbot:');

      let chatMessage = data.content || '';
      let chatbotName = 'AI Assistant';

      if (isChatbotMentioned && data.content) {
        chatbotName = data.content.match(/@\[\w+:([^\]]+)\]/)?.[1] || 'Bot';
        chatMessage = data.content.replace(/@\[\w+:([^\]]+)\]/, '').trim();
      }

      // Get sender profile for FCM notification
      const senderProfile = await this.getSenderProfile(userId);

      // Get offline participant IDs for FCM notification
      const activeParticipants = conversation.participants.filter((p) => !p.kickedAt && !p.leftAt);
      const offlineParticipantIds = activeParticipants
        .filter((p) => {
          const participantId = p.user._id.toString();
          if (participantId === userId) return false; // Skip sender
          const participantSockets = userSockets.get(participantId);
          return !participantSockets || participantSockets.size === 0; // Only offline users
        })
        .map((p) => p.user._id.toString());

      // Emit to RabbitMQ with all necessary data
      this.rabbitMQService.emit('chat.message.created', {
        messageId: savedMessage._id.toString(),
        conversationId: data.conversationId.toString(),
        senderId: userId,
        content: savedMessage.content,
        conversationType: conversation.type,
        // AI chatbot data
        isChatbotConversation,
        isChatbotMentioned,
        chatMessage,
        chatbotName,
        attachments: data.attachments,
        // FCM notification data
        participantIds: offlineParticipantIds,
        senderName: senderProfile.name,
        senderAvatar: senderProfile.avatar,
      });

      // Log for debugging
      if (isChatbotConversation || isChatbotMentioned) {
        this.logger.log(
          `Chatbot request sent to RabbitMQ. Type: ${isChatbotConversation ? 'Conversation' : 'Mention'}. Message: ${chatMessage}`
        );
      }

      if (offlineParticipantIds.length > 0) {
        this.logger.log(
          `FCM request sent to RabbitMQ for ${offlineParticipantIds.length} offline users`
        );
      }

      return { success: true, message: savedMessage };
    } catch (err) {
      this.logger.error('Failed to save message', err);
      return { success: false, error: 'Failed to save message' };
    }
  }

  async handleEmitMessageToClient(
    savedMessage: any,
    data: CreateMessageDto,
    conversation: any,
    userId: string
  ) {
    // To be implemented
    // Convert to plain object and ensure conversationId is string
    const messageToEmit = {
      ...savedMessage.toObject(),
      conversationId: data.conversationId.toString(),
    };

    // Chỉ emit message cho những participants chưa bị kick/left
    const activeParticipants = conversation.participants.filter((p) => !p.kickedAt && !p.leftAt);

    // CRITICAL: Increment unread count BEFORE emitting message:new
    // This ensures frontend receives message AND updated unreadCount simultaneously
    const updatedUnreadCount = await this.conversationService.incrementUnreadCount(
      data.conversationId.toString(),
      userId
    );

    // Include unreadCount in message:new payload for synchronized update
    const messageWithUnread = {
      ...messageToEmit,
      _unreadCount: updatedUnreadCount?.unreadCount, // Prefixed with _ to indicate metadata
    };

    // Kiểm tra xem user có bị restrict không
    // Chỉ dành cho conversation 1:1 DIRECT
    let isRestricted = false;
    if (conversation.type === 'DIRECT') {
      const otherUserId = activeParticipants
        .find((p) => p.user._id.toString() !== userId)
        ?.user._id.toString();
      const restrictedUsers = await this.relationshipService.getRestrictedUsers(otherUserId);
      isRestricted = restrictedUsers.length > 0;
    }

    messageWithUnread.isRestricted = isRestricted;

    activeParticipants.forEach(async (participant) => {
      const participantId = participant.user._id.toString();
      const participantSockets = userSockets.get(participantId);
      const messageWithMutedAndUnread = {
        ...messageWithUnread,
        isMuted: conversation.mutedBy.includes(participantId) ? true : false,
      };

      if (participantSockets && participantSockets.size > 0) {
        participantSockets.forEach((socketId) => {
          this.server.to(socketId).emit('message:new', messageWithMutedAndUnread);
        });
      }
    });

    await this.conversationService.updateLastMessage(
      data.conversationId.toString(),
      savedMessage._id.toString()
    );

    // Also emit conversation:unread:updated for backward compatibility with conversation list
    activeParticipants.forEach((participant) => {
      const participantId = participant.user._id.toString();
      const participantSockets = userSockets.get(participantId);

      if (participantSockets && participantSockets.size > 0) {
        participantSockets.forEach((socketId) => {
          this.server.to(socketId).emit('conversation:unread:updated', {
            conversationId: data.conversationId.toString(),
            unreadCount: updatedUnreadCount?.unreadCount,
          });
        });
      }
    });

    // NOTE: FCM notifications are now handled asynchronously by RabbitMQ service
    // This makes the message flow faster as we don't wait for FCM to complete
  }

  // ============ MESSAGE FEATURES ============

  // Chỉnh sửa tin nhắn
  @SubscribeMessage('message:edit')
  async handleEditMessage(
    @MessageBody() data: { messageId: string; conversationId: string; content: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const updatedMessage = await this.chatService.editMessage(
        data.messageId,
        userId,
        data.content
      );
      this.server.to(`room:${data.conversationId}`).emit('message:edited', updatedMessage);
      return { success: true, message: updatedMessage };
    } catch (err) {
      this.logger.error('Failed to edit message', err);
      return { success: false, error: err.message };
    }
  }

  // Thả cảm xúc tin nhắn
  @SubscribeMessage('message:reaction')
  async handleMessageReaction(
    @MessageBody() data: { messageId: string; conversationId: string; emotionType: EmotionType },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const updatedMessage = await this.chatService.addReaction(
        data.messageId,
        userId,
        data.emotionType
      );
      this.server
        .to(`room:${data.conversationId}`)
        .emit('message:reaction:updated', updatedMessage);
      return { success: true, message: updatedMessage };
    } catch (err) {
      this.logger.error('Failed to add reaction', err);
      return { success: false, error: err.message };
    }
  }

  // Xóa cảm xúc tin nhắn
  @SubscribeMessage('message:reaction:remove')
  async handleRemoveReaction(
    @MessageBody() data: { messageId: string; conversationId: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const updatedMessage = await this.chatService.removeReaction(data.messageId, userId);
      this.server
        .to(`room:${data.conversationId}`)
        .emit('message:reaction:updated', updatedMessage);
      return { success: true, message: updatedMessage };
    } catch (err) {
      this.logger.error('Failed to remove reaction', err);
      return { success: false, error: err.message };
    }
  }

  // Xóa tin nhắn
  @SubscribeMessage('message:delete')
  async handleDeleteMessage(
    @MessageBody() data: { messageId: string; conversationId: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const deletedMessage = await this.chatService.deleteMessage(data.messageId, userId);
      // Xóa media liên quan nếu có

      this.server.to(`room:${data.conversationId}`).emit('message:deleted', deletedMessage);
      return { success: true, message: deletedMessage };
    } catch (err) {
      this.logger.error('Failed to delete message', err);
      return { success: false, error: err.message };
    }
  }

  // ============ CONVERSATION FEATURES ============

  // Helper: Send system message
  private async sendSystemMessage(conversationId: string, content: string) {
    try {
      const systemMsg = await this.chatService.createMessage({
        conversationId,
        senderId: 'system',
        type: 'SYSTEM',
        content,
      } as any);
      this.server.to(`room:${conversationId}`).emit('message:new', systemMsg);
    } catch (err) {
      this.logger.error('Failed to send system message:', err);
    }
  }

  // Helper: Get user profile (name + avatar) for notifications
  private async getSenderProfile(userId: string): Promise<{ name: string; avatar: string }> {
    try {
      const user = await this.accountModel.findById(userId).select('firstName lastName avatar');
      if (user) {
        return {
          name: `${user.firstName} ${user.lastName}`.trim(),
          avatar: user.avatar || '',
        };
      }
    } catch (err) {
      this.logger.error('Failed to get user profile:', err);
    }
    return { name: 'Người dùng', avatar: '' };
  }

  // Helper: Get user display name
  private async getUserDisplayName(userId: string): Promise<string> {
    const profile = await this.getSenderProfile(userId);
    return profile.name || 'Ai đó';
  }

  // Helper: Create a CALL type message and emit to room
  private async createCallMessage(
    conversationId: string,
    senderId: string,
    callType: 'AUDIO' | 'VIDEO',
    callStatus: 'ANSWERED' | 'MISSED' | 'CANCELLED' | 'ONGOING',
    duration: number,
    isGroup: boolean
  ) {
    const senderName = await this.getUserDisplayName(senderId);
    const savedMessage = await this.chatService.sendMessage({
      conversationId: new Types.ObjectId(conversationId) as any,
      senderId: new Types.ObjectId(senderId) as any,
      type: MessageType.CALL,
      content: `${senderName} đã gọi 1 cuộc gọi`,
      callData: { callType, callStatus, duration, isGroup },
    } as any);

    if (savedMessage) {
      const conversation = await this.conversationService.findById(conversationId);
      const activeParticipants = conversation.participants.filter((p) => !p.kickedAt && !p.leftAt);

      const messageToEmit = {
        ...savedMessage.toObject(),
        conversationId: conversationId,
      };

      activeParticipants.forEach((participant) => {
        const participantId = participant.user._id.toString();
        const participantSockets = userSockets.get(participantId);
        if (participantSockets && participantSockets.size > 0) {
          participantSockets.forEach((socketId) => {
            this.server.to(socketId).emit('message:new', messageToEmit);
          });
        }
      });

      await this.conversationService.updateLastMessage(conversationId, savedMessage._id.toString());
    }
  }

  // Helper: Update ONGOING group call message to ANSWERED with duration
  private async finalizeGroupCallMessage(conversationId: string) {
    const lastCallMsg = await this.chatService.findLastCallMessage(conversationId);
    if (lastCallMsg && lastCallMsg.callData?.callStatus === 'ONGOING') {
      const duration = Math.round((Date.now() - new Date(lastCallMsg.createdAt).getTime()) / 1000);
      lastCallMsg.callData.callStatus = 'ANSWERED';
      lastCallMsg.callData.duration = duration;
      await lastCallMsg.save();
    }
  }

  // Thay đổi Quick Reaction
  @SubscribeMessage('conversation:quick-reaction')
  async handleQuickReaction(
    @MessageBody() data: { conversationId: string; emoji: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const updated = await this.conversationService.updateQuickReaction(
        data.conversationId,
        userId,
        data.emoji
      );
      this.server.to(`room:${data.conversationId}`).emit('conversation:updated', updated);

      // Send system message
      const userName = await this.getUserDisplayName(userId);
      await this.sendSystemMessage(
        data.conversationId,
        `${userName} đã đổi biểu tượng cảm xúc nhanh thành ${data.emoji}`
      );

      return { success: true, conversation: updated };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Thay đổi Theme Color
  @SubscribeMessage('conversation:theme')
  async handleThemeChange(
    @MessageBody() data: { conversationId: string; theme: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const updated = await this.conversationService.updateTheme(
        data.conversationId,
        userId,
        data.theme
      );
      this.server.to(`room:${data.conversationId}`).emit('conversation:updated', updated);

      // Send system message
      const userName = await this.getUserDisplayName(userId);
      await this.sendSystemMessage(
        data.conversationId,
        `${userName} đã đổi chủ đề cuộc trò chuyện`
      );

      return { success: true, conversation: updated };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Thay đổi nickname của member
  @SubscribeMessage('conversation:nickname')
  async handleNicknameChange(
    @MessageBody() data: { conversationId: string; targetUserId: string; nickname: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const updated = await this.conversationService.updateMemberNickname(
        data.conversationId,
        userId,
        data.targetUserId,
        data.nickname
      );

      // Emit specific event for nickname update
      this.server.to(`room:${data.conversationId}`).emit('conversation:nickname:updated', {
        conversation: updated,
        targetUserId: data.targetUserId,
        nickname: data.nickname,
      });

      // Send system message
      const userName = await this.getUserDisplayName(userId);
      const targetName = await this.getUserDisplayName(data.targetUserId);
      const nicknameText = data.nickname ? `thành "${data.nickname}"` : '(đã xóa biệt danh)';
      await this.sendSystemMessage(
        data.conversationId,
        `${userName} đã đổi biệt danh của ${targetName} ${nicknameText}`
      );

      return { success: true, conversation: updated };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Thay đổi tên nhóm
  @SubscribeMessage('conversation:name')
  async handleGroupNameChange(
    @MessageBody() data: { conversationId: string; name: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const updated = await this.conversationService.updateGroupName(
        data.conversationId,
        userId,
        data.name
      );

      // Emit specific event for name update
      this.server.to(`room:${data.conversationId}`).emit('conversation:name:updated', {
        conversation: updated,
        name: data.name,
      });

      // Send system message
      const userName = await this.getUserDisplayName(userId);
      await this.sendSystemMessage(
        data.conversationId,
        `${userName} đã đổi tên nhóm thành "${data.name}"`
      );

      return { success: true, conversation: updated };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Thay đổi avatar nhóm
  @SubscribeMessage('conversation:avatar')
  async handleGroupAvatarChange(
    @MessageBody() data: { conversationId: string; avatar: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const updated = await this.conversationService.updateGroupAvatar(
        data.conversationId,
        userId,
        data.avatar
      );

      // Tạo system message thông báo thay đổi avatar
      const userName = await this.getUserDisplayName(userId);
      await this.sendSystemMessage(
        data.conversationId,
        `${userName} đã thay đổi ảnh đại diện nhóm`
      );

      this.server.to(`room:${data.conversationId}`).emit('conversation:avatar:updated', {
        conversation: updated,
        updatedBy: userId,
      });
      return { success: true, conversation: updated };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Thêm thành viên
  @SubscribeMessage('conversation:member:add')
  async handleAddMember(
    @MessageBody() data: { conversationId: string; newUserId: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const updated = await this.conversationService.addMember(
        data.conversationId,
        userId,
        data.newUserId
      );

      // System message
      const adderName = await this.getUserDisplayName(userId);
      const addedName = await this.getUserDisplayName(data.newUserId);
      await this.sendSystemMessage(
        data.conversationId,
        `${adderName} đã thêm ${addedName} vào nhóm`
      );

      // Gửi cho tất cả members hiện tại
      this.server.to(`room:${data.conversationId}`).emit('conversation:member:added', {
        conversation: updated,
        newUserId: data.newUserId,
      });

      // Join new member vào room
      const newUserSockets = userSockets.get(data.newUserId);
      if (newUserSockets && newUserSockets.size > 0) {
        newUserSockets.forEach((socketId) => {
          const socket = this.server.sockets.sockets?.get(socketId);
          if (socket) {
            socket.join(`room:${data.conversationId}`);
          }
        });
      }

      return { success: true, conversation: updated };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Kick thành viên
  @SubscribeMessage('conversation:member:remove')
  async handleRemoveMember(
    @MessageBody() data: { conversationId: string; targetUserId: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      // Get names before removing
      const kickerName = await this.getUserDisplayName(userId);
      const kickedName = await this.getUserDisplayName(data.targetUserId);

      const updated = await this.conversationService.removeMember(
        data.conversationId,
        userId,
        data.targetUserId
      );

      // Send system message about the kick
      await this.sendSystemMessage(
        data.conversationId,
        `${kickerName} đã xóa ${kickedName} khỏi nhóm`
      );

      // Thông báo cho tất cả
      this.server.to(`room:${data.conversationId}`).emit('conversation:member:removed', {
        conversation: updated,
        removedUserId: data.targetUserId,
        removedByUserId: userId,
      });

      // Remove kicked member khỏi room
      const kickedUserSockets = userSockets.get(data.targetUserId);
      if (kickedUserSockets && kickedUserSockets.size > 0) {
        kickedUserSockets.forEach((socketId) => {
          const socket = this.server.sockets.sockets?.get(socketId);
          if (socket) {
            socket.leave(`room:${data.conversationId}`);
            // Notify the kicked user specifically
            socket.emit('conversation:kicked', {
              conversationId: data.conversationId,
              kickedByUserId: userId,
              kickedByName: kickerName,
            });
          }
        });
      }

      return { success: true, conversation: updated };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Phân quyền admin
  @SubscribeMessage('conversation:admin')
  async handleAdminChange(
    @MessageBody() data: { conversationId: string; targetUserId: string; isAdmin: boolean },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const updated = await this.conversationService.updateAdminStatus(
        data.conversationId,
        userId,
        data.targetUserId,
        data.isAdmin
      );
      this.server.to(`room:${data.conversationId}`).emit('conversation:admin:updated', updated);
      return { success: true, conversation: updated };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Rời nhóm
  @SubscribeMessage('conversation:leave')
  async handleLeaveGroup(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      // Lấy tên user trước khi rời
      const userName = await this.getUserDisplayName(userId);

      const updated = await this.conversationService.leaveGroup(data.conversationId, userId);

      // System message
      await this.sendSystemMessage(data.conversationId, `${userName} đã rời khỏi nhóm`);

      // Thông báo cho group
      this.server.to(`room:${data.conversationId}`).emit('conversation:member:left', {
        conversation: updated,
        leftUserId: userId,
      });

      // Leave room
      client.leave(`room:${data.conversationId}`);

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Cập nhật settings nhóm
  @SubscribeMessage('conversation:settings')
  async handleUpdateSettings(
    @MessageBody()
    data: {
      conversationId: string;
      settings: { allowMembersToAdd?: boolean; onlyAdminCanChat?: boolean };
    },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const updated = await this.conversationService.updateSettings(
        data.conversationId,
        userId,
        data.settings
      );

      // Tạo system message cho từng thay đổi
      const userName = await this.getUserDisplayName(userId);
      if (data.settings.allowMembersToAdd !== undefined) {
        const status = data.settings.allowMembersToAdd ? 'cho phép' : 'không cho phép';
        await this.sendSystemMessage(
          data.conversationId,
          `${userName} đã ${status} thành viên thêm người mới`
        );
      }
      if (data.settings.onlyAdminCanChat !== undefined) {
        const status = data.settings.onlyAdminCanChat ? 'bật' : 'tắt';
        await this.sendSystemMessage(
          data.conversationId,
          `${userName} đã ${status} chế độ chỉ quản trị viên được nhắn tin`
        );
      }

      // Thông báo cho tất cả thành viên
      this.server.to(`room:${data.conversationId}`).emit('conversation:settings:updated', {
        conversation: updated,
        settings: data.settings,
      });

      return { success: true, conversation: updated };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Tạo nhóm với nhiều thành viên (tối thiểu 3 người)
  @SubscribeMessage('conversation:create-group')
  async handleCreateGroup(
    @MessageBody() data: { memberIds: string[]; groupName?: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    // Validate memberIds
    if (!data.memberIds || !Array.isArray(data.memberIds) || data.memberIds.length < 2) {
      return { success: false, error: 'Cần ít nhất 2 thành viên khác để tạo nhóm' };
    }

    try {
      const newGroup = await this.conversationService.createGroup(
        userId,
        data.memberIds,
        data.groupName
      );

      // Join creator vào room mới
      client.join(`room:${newGroup._id.toString()}`);

      // Join all members vào room nếu online
      for (const memberId of data.memberIds) {
        const memberSockets = userSockets.get(memberId);
        if (memberSockets && memberSockets.size > 0) {
          memberSockets.forEach((socketId) => {
            const socket = this.server.sockets.sockets?.get(socketId);
            if (socket) {
              socket.join(`room:${newGroup._id.toString()}`);
            }
          });
        }
        // Emit conversation created to member
        this.server.to(`user:${memberId}`).emit('conversation:created', newGroup);
      }

      // Emit conversation created to creator
      this.server.to(`user:${userId}`).emit('conversation:created', newGroup);

      // Send system message
      const userName = await this.getUserDisplayName(userId);
      await this.sendSystemMessage(newGroup._id.toString(), `${userName} đã tạo nhóm`);

      return { success: true, conversation: newGroup };
    } catch (err) {
      this.logger.error('Failed to create group:', err);
      return { success: false, error: err.message };
    }
  }

  // ============ STATUS ============

  // Get online status of a specific user
  @SubscribeMessage('user:status')
  async handleGetUserStatus(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket
  ) {
    // Check if user allows showing activity status
    let user;
    try {
      user = await this.accountModel
        .findById(data.userId)
        .select('lastActive showActivityStatus')
        .lean();
    } catch (e) {
      this.logger.error('Failed to get user', e);
    }

    // If user has hidden activity status, return as HIDDEN
    if (user?.showActivityStatus === false) {
      return {
        userId: data.userId,
        isOnline: false,
        status: 'HIDDEN',
        lastActive: null,
      };
    }

    const isOnline = userSockets.has(data.userId) && userSockets.get(data.userId)!.size > 0;

    return {
      userId: data.userId,
      isOnline,
      status: isOnline ? 'ACTIVE' : 'DEACTIVE',
      lastActive: isOnline ? null : user?.lastActive || null,
    };
  }

  // Get list of online users (excludes users who hide activity status)
  @SubscribeMessage('users:online')
  async handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
    const onlineUserIds = Array.from(userSockets.keys());

    // Filter out users who have hidden activity status
    const users = await this.accountModel
      .find({
        _id: { $in: onlineUserIds },
        showActivityStatus: { $ne: false },
      })
      .select('_id')
      .lean();

    const visibleOnlineUsers = users.map((u) => u._id.toString());
    return { onlineUsers: visibleOnlineUsers };
  }

  // ============ MUTE NOTIFICATION ============

  // Toggle mute notification for a conversation
  @SubscribeMessage('conversation:toggle-mute')
  async handleToggleMute(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const result = await this.conversationService.toggleMuteNotification(
        data.conversationId,
        userId
      );

      // Notify ALL sockets of this user (so all open tabs update)
      this.server.to(`user:${userId}`).emit('conversation:mute:updated', {
        conversationId: data.conversationId,
        userId,
        isMuted: result.isMuted,
      });

      return { success: true, isMuted: result.isMuted };
    } catch (err) {
      this.logger.error('Failed to toggle mute', err);
      return { success: false, error: err.message };
    }
  }

  // ============ MESSAGE READ STATUS ============

  // Mark messages as read when user views conversation
  @SubscribeMessage('message:read')
  async handleMarkAsRead(@MessageBody() rawData: any, @ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    // Parse data manually to ensure messageId is captured correctly
    const data = {
      conversationId: rawData?.conversationId || rawData?.[0]?.conversationId,
      messageId: rawData?.messageId || rawData?.[0]?.messageId || undefined,
    };

    if (!data.conversationId) {
      return { success: false, error: 'conversationId is required' };
    }

    try {
      // Mark messages as read (with optional messageId for cursor)
      const result = await this.chatService.markAsRead(data.conversationId, userId, data.messageId);

      // Reset unread count for this user
      const conversationUpdated = await this.conversationService.resetUnreadCount(
        data.conversationId,
        userId
      );

      // Get user info for the reader
      const readerUser = await this.accountModel
        .findById(userId)
        .select('firstName lastName _id avatar');
      const readByUser = readerUser
        ? {
            _id: readerUser._id.toString(),
            firstName: readerUser.firstName,
            lastName: readerUser.lastName,
            avatar: readerUser.avatar,
          }
        : null;

      // CRITICAL: Only emit to OTHER users in the conversation, NOT to the user who updated their cursor
      // This prevents the user from seeing their own read status in the UI
      this.server.to(`room:${data.conversationId}`).except(client.id).emit('message:read:updated', {
        conversationId: data.conversationId,
        readBy: readByUser,
        readByUserId: userId, // Keep userId for backward compatibility
        modifiedCount: result.modifiedCount,
        lastReadMessageId: result.lastReadMessageId, // New field for cursor Logic
        readStatus: result.readStatus, // Full status object
      });

      // Also emit unread reset for conversation list update
      this.server.to(`room:${data.conversationId}`).emit('conversation:unread:reset', {
        conversationId: data.conversationId,
        unreadCount: conversationUpdated.unreadCount,
      });

      return { success: true, ...result };
    } catch (err) {
      this.logger.error('Failed to mark as read', err);
      return { success: false, error: err.message };
    }
  }

  // Get read status for conversation
  @SubscribeMessage('message:read:status')
  async handleGetReadStatus(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const result = await this.chatService.getReadStatus(data.conversationId);
      return { success: true, lastMessage: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}
