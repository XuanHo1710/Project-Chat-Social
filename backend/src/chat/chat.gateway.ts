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
import { ChatService } from 'src/chat/chat.service';
import { CreateMessageDto } from 'src/chat/dto/create-message.dto';
import { ConversationService } from 'src/conversation/conversation.service';
import { InjectModel } from '@nestjs/mongoose';
import { Account, AccountDocument } from 'src/account/entities/account.entity';
import { Model } from 'mongoose';
import { EmotionType, MessageType } from './entities/message.entity';
import { RelationshipService } from 'src/relationship/relationship.service';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { Conversation } from 'src/conversation/entities/conversation.entity';
import { FirebaseService } from 'src/firebase/firebase.service';

// Map để lưu userId -> Set<socketId> (support multiple connections per user)
const userSockets = new Map<string, Set<string>>();

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
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>
  ) {}

  private readonly aiServerUrl = 'http://localhost:8000/api/v1';

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

      if (data.content && data.content.includes('@[chatbot:')) {
        const chatbotName = data.content.match(/@\[\w+:([^\]]+)\]/)?.[1];
        const chatMessage = data.content.replace(/@\[\w+:([^\]]+)\]/, '').trim(); // Remove mention tag from content
        this.logger.log(`Chatbot "${chatbotName}" mentioned with message: ${chatMessage}`);

        // Emit typing indicator for chatbot
        this.server.to(`room:${data.conversationId}`).emit('chatbot:typing', {
          conversationId: data.conversationId.toString(),
          isTyping: true,
        });

        try {
          // Fetch last 15 messages for chat history context
          const recentMessages = await this.chatService.getRecentMessagesForContext(
            data.conversationId.toString(),
            15
          );

          // Format chat history for AI context (oldest first)
          const chatHistory = recentMessages.reverse().map((msg: any) => ({
            role: msg.type === 'CHATBOT' ? 'assistant' : 'user',
            content: msg.content || '',
            senderName: msg.senderId
              ? `${msg.senderId.firstName} ${msg.senderId.lastName}`
              : 'User',
          }));

          // Extract image URLs from current message attachments
          const imageUrls: string[] = [];
          if (data.attachments && data.attachments.length > 0) {
            data.attachments.forEach((att) => {
              if (att.mediaType === 'IMAGE' && att.url) {
                imageUrls.push(att.url);
              }
            });
          }

          this.logger.log(
            `Chat context: ${chatHistory.length} messages, ${imageUrls.length} images`
          );

          // Call AI server chat bot endpoint with POST to send chat history
          const responseAPIAi: AxiosResponse<{
            message: string;
            response: string;
            postIds?: string[];
          }> = await firstValueFrom(
            this.httpService.post(
              `${this.aiServerUrl}/chat/bot`,
              {
                message: chatMessage,
                chatHistory: chatHistory,
                imageUrls: imageUrls,
              },
              { timeout: 120000 } // 2 min timeout for detailed vision analysis
            )
          );
          this.logger.log('AI server response received');

          // Stop typing indicator
          this.server.to(`room:${data.conversationId}`).emit('chatbot:typing', {
            conversationId: data.conversationId.toString(),
            isTyping: false,
          });

          // Prepare message data with optional postIds
          const chatbotMessageData: any = {
            conversationId: data.conversationId,
            senderId: userId as any, // User who triggered the bot
            content: responseAPIAi.data.response,
            type: MessageType.CHATBOT,
          };

          // Include postIdsRecommendationfromAI if AI suggested posts
          if (responseAPIAi.data.postIds && responseAPIAi.data.postIds.length > 0) {
            chatbotMessageData.postIdsRecommendationfromAI = responseAPIAi.data.postIds;
            this.logger.log(
              `Chatbot suggesting ${responseAPIAi.data.postIds.length} posts: ${responseAPIAi.data.postIds.join(', ')}`
            );
          }

          // Save chatbot message with userId as sender (type CHATBOT identifies it)
          const savedMessageChatBot = await this.chatService.sendMessage(chatbotMessageData);

          if (!savedMessageChatBot) {
            return { success: false, error: 'Failed to save chatbot message' };
          }

          await this.handleEmitMessageToClient(savedMessageChatBot, data, conversation, userId);
        } catch (aiError) {
          this.logger.error('AI server error:', aiError);
          // Stop typing indicator on error
          this.server.to(`room:${data.conversationId}`).emit('chatbot:typing', {
            conversationId: data.conversationId.toString(),
            isTyping: false,
          });

          // Send error message as chatbot
          const errorMessage = await this.chatService.sendMessage({
            conversationId: data.conversationId,
            senderId: userId as any,
            content: '⚠️ Xin lỗi, tôi đang gặp sự cố kỹ thuật. Vui lòng thử lại sau!',
            type: MessageType.CHATBOT,
          });
          if (errorMessage) {
            await this.handleEmitMessageToClient(errorMessage, data, conversation, userId);
          }
        }
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

    activeParticipants.forEach((participant) => {
      const participantId = participant.user._id.toString();
      const participantSockets = userSockets.get(participantId);

      if (participantSockets && participantSockets.size > 0) {
        participantSockets.forEach((socketId) => {
          this.server.to(socketId).emit('message:new', messageToEmit);
        });
      }
    });

    await this.conversationService.updateLastMessage(
      data.conversationId.toString(),
      savedMessage._id.toString()
    );

    // Increment unread count for active participants except sender
    await this.conversationService.incrementUnreadCount(data.conversationId.toString(), userId);

    // Emit unread update chỉ cho active participants
    activeParticipants.forEach((participant) => {
      const participantId = participant.user._id.toString();
      const participantSockets = userSockets.get(participantId);

      if (participantSockets && participantSockets.size > 0) {
        participantSockets.forEach((socketId) => {
          this.server.to(socketId).emit('conversation:unread:updated', {
            conversationId: data.conversationId.toString(),
            senderId: userId,
          });
        });
      }
    });

    // LOGIC FIREBASE: Chỉ gửi notification khi user OFFLINE
    // Khi user online, họ đã nhận được message:new qua socket rồi
    for (const participant of activeParticipants) {
      const participantId = participant.user._id.toString();

      // Không gửi cho chính người gửi
      if (participantId === userId) continue;

      // Kiểm tra user có online không (có socket kết nối)
      const participantSockets = userSockets.get(participantId);
      const isOnline = participantSockets && participantSockets.size > 0;

      // CHỈ gửi FCM khi user OFFLINE - tránh duplicate notification
      if (isOnline) {
        this.logger.log(`User ${participantId} is ONLINE, skipping FCM (will receive via socket)`);
        continue;
      }

      // Kiểm tra xem user có mute conversation không
      const isMuted = await this.conversationService.isConversationMuted(
        data.conversationId.toString(),
        participantId
      );
      if (isMuted) {
        this.logger.log(
          `User ${participantId} has muted conversation ${data.conversationId}, skipping FCM`
        );
        continue;
      }

      // User offline - gửi FCM notification
      const userAccount = await this.accountModel.findById(participantId).select('fcmTokens');
      if (userAccount && userAccount.fcmTokens && userAccount.fcmTokens.length > 0) {
        const senderProfile = await this.getSenderProfile(userId);
        const contentPreview = savedMessage.content || '[Hình ảnh/File]';

        await this.firebaseService.sendToDevice(
          userAccount.fcmTokens,
          senderProfile.name,
          contentPreview,
          {
            conversationId: data.conversationId.toString(),
            messageId: savedMessage._id.toString(),
            type: 'NEW_MESSAGE',
            avatar: senderProfile.avatar,
          }
        );
        this.logger.log(`FCM sent to offline user ${participantId}`);
      }
    }
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
    return profile.name;
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

      // Notify the user (only the user who toggled mute)
      client.emit('conversation:mute:updated', {
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
      await this.conversationService.resetUnreadCount(data.conversationId, userId);

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
        userId: userId,
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
