import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Server, Socket } from 'socket.io';
import { Model, Types } from 'mongoose';
import { Account, AccountDocument } from 'src/account/entities/account.entity';
import { ChatService } from 'src/chat/chat.service';
import { ConversationService } from 'src/conversation/conversation.service';
import { MessageType } from 'src/chat/entities/message.entity';
import { PresenceService } from 'src/common/presence/presence.service';

@Injectable()
export class GroupCallStateService {
  private logger = new Logger('GroupCallStateService');

  // Map conversationId -> Set<userId> for active group calls
  private readonly activeGroupCalls = new Map<string, Set<string>>();

  // Map socketId -> Set<conversationId> that this socket joined for group calls
  private readonly socketGroupCalls = new Map<string, Set<string>>();

  constructor(
    private readonly presenceService: PresenceService,
    private readonly chatService: ChatService,
    private readonly conversationService: ConversationService,
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>
  ) {}

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

  ensureSocketGroupCalls(socketId: string) {
    if (!this.socketGroupCalls.has(socketId)) {
      this.socketGroupCalls.set(socketId, new Set());
    }
  }

  trackSocketGroupCall(socketId: string, conversationId: string) {
    this.ensureSocketGroupCalls(socketId);
    this.socketGroupCalls.get(socketId)!.add(conversationId);
  }

  untrackSocketGroupCall(socketId: string, conversationId: string) {
    const calls = this.socketGroupCalls.get(socketId);
    if (!calls) return;

    calls.delete(conversationId);
    if (calls.size === 0) {
      this.socketGroupCalls.delete(socketId);
    }
  }

  getJoinedGroupCalls(socketId: string): Set<string> {
    return new Set(this.socketGroupCalls.get(socketId) || []);
  }

  clearSocketGroupCalls(socketId: string) {
    this.socketGroupCalls.delete(socketId);
  }

  deleteActiveGroupCall(conversationId: string) {
    this.activeGroupCalls.delete(conversationId);
  }

  hasAnotherSocketInGroupCall(
    userId: string,
    conversationId: string,
    currentSocketId: string
  ): boolean {
    const sockets = this.presenceService.getSockets(userId);
    if (sockets.size === 0) return false;

    for (const socketId of sockets) {
      if (socketId === currentSocketId) continue;
      if (this.socketGroupCalls.get(socketId)?.has(conversationId)) {
        return true;
      }
    }

    return false;
  }

  cleanupStaleGroupParticipants(conversationId: string): Set<string> {
    if (!this.activeGroupCalls.has(conversationId)) {
      this.activeGroupCalls.set(conversationId, new Set());
    }

    const participants = this.activeGroupCalls.get(conversationId)!;

    Array.from(participants).forEach((participantId) => {
      const sockets = this.presenceService.getSockets(participantId);
      const hasJoinedSocket = Array.from(sockets).some((socketId) =>
        this.socketGroupCalls.get(socketId)?.has(conversationId)
      );

      if (!hasJoinedSocket) {
        participants.delete(participantId);
      }
    });

    if (participants.size === 0) {
      this.activeGroupCalls.delete(conversationId);
      this.activeGroupCalls.set(conversationId, new Set());
    }

    return this.activeGroupCalls.get(conversationId)!;
  }

  async removeUserFromGroupCall(
    server: Server,
    conversationId: string,
    userId: string,
    userName?: string
  ) {
    const currentParticipants = this.activeGroupCalls.get(conversationId);
    if (!currentParticipants || !currentParticipants.has(userId)) {
      return;
    }

    currentParticipants.delete(userId);

    const name = userName || (await this.getUserDisplayName(userId)) || 'Someone';

    currentParticipants.forEach((pId) => {
      this.presenceService.getSockets(pId).forEach((sId) => {
        server.to(sId).emit('group-call:user-left', { userId, userName: name });
      });
    });

    if (currentParticipants.size === 0) {
      this.activeGroupCalls.delete(conversationId);
      try {
        await this.finalizeGroupCallMessage(server, conversationId);
      } catch (err) {
        this.logger.error('Failed to finalize group call message:', err);
      }
    }
  }

  async handleGroupCallStart(
    server: Server,
    client: Socket,
    data: { conversationId: string; callType?: 'AUDIO' | 'VIDEO' }
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, error: 'User not authenticated', users: [] };
    }

    if (await this.isRealtimeAccessDenied(userId)) {
      return { success: false, error: 'Tài khoản đã bị khóa hoặc vô hiệu hóa', users: [] };
    }

    const conversation = await this.conversationService.findById(data.conversationId, userId);
    if (!conversation) {
      return { success: false, error: 'Conversation not found', users: [] };
    }

    const callerProfile = await this.getSenderProfile(userId);

    const activeParticipants = this.cleanupStaleGroupParticipants(data.conversationId);
    const starterAlreadyInCall = activeParticipants.has(userId);

    // Track starter immediately so we can correctly finalize call history on leave/disconnect.
    this.trackSocketGroupCall(client.id, data.conversationId);
    activeParticipants.add(userId);

    this.logger.log(
      `[CALL] group-call:start conv=${data.conversationId}, user=${userId}, alreadyInCall=${starterAlreadyInCall}, participants=${Array.from(activeParticipants).join(',')}`
    );

    // Create a CALL message whenever starter is not currently in the active call set.
    // This avoids stale participant states blocking new joinable call messages.
    if (!starterAlreadyInCall) {
      try {
        await this.createCallMessage(
          server,
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

      const sockets = this.presenceService.getSockets(pId);
      if (sockets) {
        sockets.forEach((sId) => {
          server.to(sId).emit('group-call:incoming', {
            conversationId: data.conversationId,
            callerName: callerProfile.name,
            callerAvatar: callerProfile.avatar,
            fromUserId: userId,
            isGroup: true,
          });
        });
      }
    });

    // Return existing participants so starter can immediately create peers (merged start+join)
    const participantsList = Array.from(activeParticipants).filter((id) => id !== userId);
    return { success: true, users: participantsList };
  }

  async handleGroupCallJoin(
    server: Server,
    client: Socket,
    data: { conversationId: string }
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { success: false, users: [] };
    }

    if (await this.isRealtimeAccessDenied(userId)) {
      return { success: false, users: [] };
    }

    if (!(await this.conversationService.isUserInConversation(data.conversationId, userId))) {
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
          const sockets = this.presenceService.getSockets(pId);
          if (sockets) {
            sockets.forEach((sId) => {
              server.to(sId).emit('group-call:user-joined', { userId });
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

  async handleGroupCallLeave(server: Server, client: Socket, data: { conversationId: string }) {
    const userId = client.data.userId;
    if (!userId) return;

    this.untrackSocketGroupCall(client.id, data.conversationId);

    if (this.hasAnotherSocketInGroupCall(userId, data.conversationId, client.id)) {
      return;
    }

    try {
      const userName = await this.getUserDisplayName(userId);
      await this.removeUserFromGroupCall(server, data.conversationId, userId, userName);
    } catch (err) {
      this.logger.error('Failed to process group call leave:', err);
    }
  }

  async handleGroupCallCheck(server: Server, client: Socket, data: { conversationId: string }) {
    const userId = client.data.userId as string | undefined;
    if (
      !userId ||
      !(await this.conversationService.isUserInConversation(data.conversationId, userId))
    ) {
      return { active: false, participantCount: 0 };
    }
    const participants = this.cleanupStaleGroupParticipants(data.conversationId);
    if (participants && participants.size > 0) {
      return { active: true, participantCount: participants.size };
    }

    this.activeGroupCalls.delete(data.conversationId);
    return { active: false, participantCount: 0 };
  }

  // Helper: Create a CALL type message and emit to room
  async createCallMessage(
    server: Server,
    conversationId: string,
    senderId: string,
    callType: 'AUDIO' | 'VIDEO',
    callStatus: 'ANSWERED' | 'MISSED' | 'CANCELLED' | 'ONGOING',
    duration: number,
    isGroup: boolean
  ) {
    const senderName = await this.getUserDisplayName(senderId);
    this.logger.log(
      `[CALL] Creating call message: conv=${conversationId}, sender=${senderId}, type=${callType}, status=${callStatus}, isGroup=${isGroup}`
    );

    const savedMessage = await this.chatService.sendMessage(
      {
        conversationId: new Types.ObjectId(conversationId) as any,
        senderId: new Types.ObjectId(senderId) as any,
        type: MessageType.CALL,
        content: `${senderName} đã gọi 1 cuộc gọi`,
        callData: { callType, callStatus, duration, isGroup },
      },
      senderId
    );

    if (!savedMessage) {
      this.logger.error(`[CALL] sendMessage returned null for conv=${conversationId}`);
      return;
    }

    this.logger.log(`[CALL] Message saved: id=${savedMessage._id}, conv=${conversationId}`);

    const messageToEmit = {
      ...savedMessage.toObject(),
      conversationId: conversationId,
    };

    // Try to increment unread count (non-blocking for emit)
    let unreadCount: Record<string, number> | undefined;
    try {
      const updatedUnreadCount = await this.conversationService.incrementUnreadCount(
        conversationId,
        senderId
      );
      unreadCount = updatedUnreadCount?.unreadCount;
    } catch (err) {
      this.logger.error(`[CALL] incrementUnreadCount failed: ${err.message}`);
    }

    const messageWithUnread = {
      ...messageToEmit,
      _unreadCount: unreadCount,
    };

    // Emit to individual sockets of all active participants
    try {
      const conversation = await this.conversationService.findById(conversationId, senderId);
      if (conversation && conversation.participants) {
        const activeParticipants = conversation.participants.filter(
          (p) => !p.kickedAt && !p.leftAt
        );
        this.logger.log(`[CALL] Emitting message:new to ${activeParticipants.length} participants`);

        activeParticipants.forEach((participant) => {
          const participantId = participant.user?._id?.toString();
          if (!participantId) return;
          const participantSockets = this.presenceService.getSockets(participantId);
          if (participantSockets.size > 0) {
            participantSockets.forEach((socketId) => {
              server.to(socketId).emit('message:new', messageWithUnread);
            });
          }
        });
      } else {
        this.logger.warn(
          `[CALL] Conversation not found or no participants, falling back to room emit`
        );
      }
    } catch (err) {
      this.logger.error(`[CALL] Error emitting to individual sockets: ${err.message}`);
    }

    // Always also emit to Socket.IO room as a reliable fallback
    server.to(`room:${conversationId}`).emit('message:new', messageWithUnread);

    // Update lastMessage (non-blocking)
    try {
      await this.conversationService.updateLastMessage(conversationId, savedMessage._id.toString());
    } catch (err) {
      this.logger.error(`[CALL] updateLastMessage failed: ${err.message}`);
    }
  }

  // Helper: Update ONGOING group call message to ANSWERED with duration
  private async finalizeGroupCallMessage(server: Server, conversationId: string) {
    try {
      const lastCallMsg = await this.chatService.findLastCallMessage(conversationId);
      if (!lastCallMsg) {
        this.logger.log(`[CALL] No ONGOING call message to finalize for conv=${conversationId}`);
        return;
      }

      if (!lastCallMsg.callData) {
        this.logger.log(`[CALL] lastCallMsg has no callData for conv=${conversationId}`);
        return;
      }

      const duration = Math.round((Date.now() - new Date(lastCallMsg.createdAt).getTime()) / 1000);
      lastCallMsg.callData.callStatus = 'ANSWERED';
      lastCallMsg.callData.duration = duration;
      await lastCallMsg.save();
      this.logger.log(
        `[CALL] Finalized call message: id=${lastCallMsg._id}, duration=${duration}s`
      );

      // Fetch populated message for emit
      const updatedMessage = await this.chatService.findMessageForConversation(
        lastCallMsg._id.toString(),
        conversationId
      );
      if (updatedMessage) {
        const messageToEmit = {
          ...updatedMessage.toObject(),
          conversationId: conversationId,
        };

        // Emit to room so all clients in the conversation see the update
        server.to(`room:${conversationId}`).emit('message:call:updated', messageToEmit);

        // Also emit to individual sockets for clients that might not be in the room
        try {
          const conversation = await this.conversationService.findById(
            conversationId,
            lastCallMsg.senderId.toString()
          );
          if (conversation && conversation.participants) {
            const activeParticipants = conversation.participants.filter(
              (p) => !p.kickedAt && !p.leftAt
            );
            activeParticipants.forEach((participant) => {
              const participantId = participant.user?._id?.toString();
              if (!participantId) return;
              const participantSockets = this.presenceService.getSockets(participantId);
              if (participantSockets.size > 0) {
                participantSockets.forEach((socketId) => {
                  server.to(socketId).emit('message:call:updated', messageToEmit);
                });
              }
            });
          }
        } catch (err) {
          this.logger.error(`[CALL] Error emitting finalize to individual sockets: ${err.message}`);
        }
      }
    } catch (err) {
      this.logger.error(`[CALL] finalizeGroupCallMessage error: ${err.message}`);
    }
  }
}
