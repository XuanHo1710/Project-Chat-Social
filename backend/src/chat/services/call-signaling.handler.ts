import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Server, Socket } from 'socket.io';
import { Model } from 'mongoose';
import { Account, AccountDocument } from 'src/account/entities/account.entity';
import { ConversationService } from 'src/conversation/conversation.service';
import { RelationshipService } from 'src/relationship/relationship.service';
import { PresenceService } from 'src/common/presence/presence.service';
import { GroupCallStateService } from 'src/chat/services/group-call-state.service';

export interface CallPayload {
  toUserId: string;
  offer: any;
  conversationId: string;
  callType?: 'AUDIO' | 'VIDEO';
}

export interface AnswerPayload {
  toUserId: string;
  answer: any;
  conversationId: string;
}

export interface IceCandidatePayload {
  toUserId: string;
  candidate: any;
  conversationId: string;
}

// Store pending calls for persistence on reload (recipientId -> CallData)
export interface PendingCallEntry {
  fromUserId: string;
  offer: any;
  conversationId: string;
  timestamp: number;
  callType: 'AUDIO' | 'VIDEO';
  answered: boolean;
}

@Injectable()
export class CallSignalingHandler {
  private logger = new Logger('CallSignalingHandler');

  // Store pending calls for persistence on reload (recipientId -> CallData)
  private readonly pendingCalls = new Map<string, PendingCallEntry>();

  constructor(
    private readonly conversationService: ConversationService,
    private readonly relationshipService: RelationshipService,
    private readonly presenceService: PresenceService,
    private readonly groupCallState: GroupCallStateService,
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>
  ) {}

  // Accessor used by ChatGateway on reconnect (pending call re-emit / expiry cleanup)
  getPendingCall(recipientId: string): PendingCallEntry | undefined {
    return this.pendingCalls.get(recipientId);
  }

  deletePendingCall(recipientId: string): void {
    this.pendingCalls.delete(recipientId);
  }

  async handleCallStart(server: Server, client: Socket, data: CallPayload) {
    const fromUserId = client.data.userId;

    if (!fromUserId) {
      return { success: false, reason: 'User not authenticated' };
    }

    if (await this.isRealtimeAccessDenied(fromUserId)) {
      return { success: false, reason: 'Tài khoản đã bị khóa hoặc vô hiệu hóa' };
    }

    if (
      !(await this.conversationService.areUsersInConversation(data.conversationId, [
        fromUserId,
        data.toUserId,
      ]))
    ) {
      return { success: false, reason: 'Forbidden' };
    }

    const blocked = await this.relationshipService.isUserBlocked(fromUserId, data.toUserId);
    if (blocked) {
      return {
        success: false,
        reason: 'Không thể gọi vì một trong hai bên đã chặn nhau',
      };
    }

    // Tìm socket của người nhận
    const recipientSockets = this.presenceService.getSockets(data.toUserId);

    // Lấy thông tin người gọi
    const callerProfile = await this.getSenderProfile(fromUserId);

    // Save pending call for reliability/refresh
    this.pendingCalls.set(data.toUserId, {
      fromUserId,
      offer: data.offer,
      conversationId: data.conversationId,
      timestamp: Date.now(),
      callType: data.callType || 'VIDEO',
      answered: false,
    });

    if (recipientSockets.size > 0) {
      recipientSockets.forEach((socketId) => {
        server.to(socketId).emit('call:incoming', {
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

  async handleCallAnswer(server: Server, client: Socket, data: AnswerPayload) {
    const fromUserId = client.data.userId; // Người nhận (Callee) trả lời

    // Mark call as answered (keep pending for duration tracking)
    const pending = this.pendingCalls.get(fromUserId);
    if (
      !fromUserId ||
      !(await this.conversationService.areUsersInConversation(data.conversationId, [
        fromUserId,
        data.toUserId,
      ])) ||
      !pending ||
      pending.fromUserId !== data.toUserId ||
      pending.conversationId !== data.conversationId
    ) {
      return { success: false, reason: 'Forbidden' };
    }

    if (pending) {
      pending.answered = true;
      pending.timestamp = Date.now(); // Reset timestamp to track call duration from answer
    }

    // Gửi answer lại cho người gọi (Caller)
    const callerSockets = this.presenceService.getSockets(data.toUserId);
    callerSockets.forEach((socketId) => {
      server.to(socketId).emit('call:accepted', {
        fromUserId, // ID của người nhận
        answer: data.answer,
      });
    });
  }

  async handleIceCandidate(server: Server, client: Socket, data: IceCandidatePayload) {
    const fromUserId = client.data.userId;

    if (
      !fromUserId ||
      !(await this.conversationService.areUsersInConversation(data.conversationId, [
        fromUserId,
        data.toUserId,
      ]))
    ) {
      return { success: false, reason: 'Forbidden' };
    }

    const targetSockets = this.presenceService.getSockets(data.toUserId);
    targetSockets.forEach((socketId) => {
      server.to(socketId).emit('call:ice-candidate', {
        fromUserId,
        candidate: data.candidate,
      });
    });
  }

  async handleCallEnd(
    server: Server,
    client: Socket,
    data: { toUserId: string; conversationId?: string }
  ) {
    const fromUserId = client.data.userId;
    if (!fromUserId) {
      return { success: false, reason: 'Forbidden' };
    }

    const pendingRecipientId = this.pendingCalls.has(fromUserId)
      ? fromUserId
      : this.pendingCalls.has(data.toUserId)
        ? data.toUserId
        : undefined;
    const pendingForValidation = pendingRecipientId
      ? this.pendingCalls.get(pendingRecipientId)
      : undefined;
    const validatedConversationId = data.conversationId || pendingForValidation?.conversationId;
    const expectedCallerId = pendingRecipientId === fromUserId ? data.toUserId : fromUserId;
    if (
      !validatedConversationId ||
      (pendingForValidation && pendingForValidation.fromUserId !== expectedCallerId) ||
      !(await this.conversationService.areUsersInConversation(validatedConversationId, [
        fromUserId,
        data.toUserId,
      ]))
    ) {
      return { success: false, reason: 'Forbidden' };
    }

    const targetSockets = this.presenceService.getSockets(data.toUserId);

    // Find the pending call to determine status and duration
    const pendingAsCallee = this.pendingCalls.get(fromUserId); // callee rejects/ends
    const pendingAsCaller = this.pendingCalls.get(data.toUserId); // caller cancels/ends
    const pending = pendingAsCallee || pendingAsCaller;

    // Remove pending calls
    this.pendingCalls.delete(data.toUserId);
    this.pendingCalls.delete(fromUserId);

    targetSockets.forEach((socketId) => {
      server.to(socketId).emit('call:ended', { fromUserId });
    });

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

        await this.groupCallState.createCallMessage(
          server,
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
}
