import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ClientProxy } from '@nestjs/microservices';
import { Account, AccountDocument } from './schemas/account.schema';
import { Message, MessageDocument, MessageType } from './schemas/message.schema';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';
import { FirebaseService } from './services/firebase.service';
import { AiService } from './services/ai.service';
import { MessageCreatedEventDto } from './dto/message.dto';

@Injectable()
export class AppService {
  private logger = new Logger('AppService');

  constructor(
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    @Inject('BACKEND_SERVICE') private readonly backendService: ClientProxy,
    private readonly firebaseService: FirebaseService,
    private readonly aiService: AiService,
  ) { }

  /**
   * Handle chat.message.created event
   * Process AI chatbot and FCM notifications
   */
  async handleMessageCreated(payload: MessageCreatedEventDto): Promise<void> {
    this.logger.log(`Processing message: ${payload.messageId}`);

    // Process in parallel for better performance
    await Promise.all([
      this.processAiChatbot(payload),
      this.processFcmNotification(payload),
    ]);
  }

  /**
   * Process AI chatbot response
   */
  private async processAiChatbot(payload: MessageCreatedEventDto): Promise<void> {
    const { isChatbotConversation, isChatbotMentioned } = payload;

    if (!isChatbotConversation && !isChatbotMentioned) {
      return; // Skip if not chatbot related
    }

    this.logger.log(`AI Chatbot triggered for conversation: ${payload.conversationId}`);

    // Emit typing indicator to Backend
    this.backendService.emit('chat.typing', {
      conversationId: payload.conversationId,
      isTyping: true,
    });

    try {
      // Get chat history from DB
      const recentMessages = await this.messageModel
        .find({ conversationId: new Types.ObjectId(payload.conversationId) })
        .sort({ createdAt: -1 })
        .limit(15)
        .populate('senderId', 'firstName lastName')
        .lean();

      // Format chat history for AI context (oldest first)
      const chatHistory = recentMessages.reverse().map((msg: any) => ({
        role: (msg.type === MessageType.CHATBOT ? 'assistant' : 'user') as 'user' | 'assistant',
        content: msg.content || '',
        senderName: msg.senderId
          ? `${msg.senderId.firstName} ${msg.senderId.lastName}`
          : 'User',
      }));

      // Extract image URLs
      const imageUrls = payload.attachments
        ?.filter((att) => att.mediaType === 'IMAGE' && att.url)
        .map((att) => att.url) || [];

      this.logger.log(
        `Chat context: ${chatHistory.length} messages, ${imageUrls.length} images`,
      );

      // Call AI server
      const aiResponse = await this.aiService.getChatBotResponse(
        payload.chatMessage || payload.content,
        chatHistory,
        imageUrls,
      );

      // Stop typing indicator
      this.backendService.emit('chat.typing', {
        conversationId: payload.conversationId,
        isTyping: false,
      });

      // Determine senderId for the bot message
      let botSenderId = payload.senderId; // Default fallback
      if (isChatbotConversation) {
        const botUser = await this.accountModel.findOne({ username: 'ai_assistant' });
        if (botUser) botSenderId = botUser._id.toString();
      }

      // Save chatbot message to DB
      const chatbotMessage = new this.messageModel({
        conversationId: new Types.ObjectId(payload.conversationId),
        senderId: new Types.ObjectId(botSenderId),
        content: aiResponse.response,
        type: MessageType.CHATBOT,
        postIdsRecommendationfromAI: aiResponse.postIds || [],
      });

      const savedMessage = await chatbotMessage.save();

      // Update conversation lastMessage
      await this.conversationModel.findByIdAndUpdate(payload.conversationId, {
        lastMessage: savedMessage._id,
      });

      this.logger.log(`AI message saved: ${savedMessage._id}`);

      // Emit response back to Backend for socket broadcast
      this.backendService.emit('chat.ai.response', {
        conversationId: payload.conversationId,
        messageId: savedMessage._id.toString(),
        senderId: botSenderId,
        content: aiResponse.response,
        postIdsRecommendation: aiResponse.postIds || [],
        originalSenderId: payload.senderId,
        success: true,
      });
    } catch (error) {
      this.logger.error('AI processing error:', error);

      // Stop typing indicator on error
      this.backendService.emit('chat.typing', {
        conversationId: payload.conversationId,
        isTyping: false,
      });

      // Determine bot senderId for error message
      let botSenderId = payload.senderId;
      if (isChatbotConversation) {
        const botUser = await this.accountModel.findOne({ username: 'ai_assistant' });
        if (botUser) botSenderId = botUser._id.toString();
      }

      // Save error message
      const errorMessage = new this.messageModel({
        conversationId: new Types.ObjectId(payload.conversationId),
        senderId: new Types.ObjectId(botSenderId),
        content: '⚠️ Xin lỗi, tôi đang gặp sự cố kỹ thuật. Vui lòng thử lại sau!',
        type: MessageType.CHATBOT,
      });

      const savedError = await errorMessage.save();

      // Emit error response back to Backend
      this.backendService.emit('chat.ai.response', {
        conversationId: payload.conversationId,
        messageId: savedError._id.toString(),
        senderId: botSenderId,
        content: savedError.content,
        originalSenderId: payload.senderId,
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Process FCM push notifications
   */
  private async processFcmNotification(payload: MessageCreatedEventDto): Promise<void> {
    const { participantIds, senderId, conversationId, content } = payload;

    if (!participantIds || participantIds.length === 0) {
      return;
    }

    this.logger.log(`Processing FCM for ${participantIds.length} participants`);

    // Get conversation to check mute status
    const conversation = await this.conversationModel.findById(conversationId).lean();
    if (!conversation) {
      this.logger.warn(`Conversation not found: ${conversationId}`);
      return;
    }

    for (const participantId of participantIds) {
      // Skip sender
      if (participantId === senderId) continue;

      try {
        // Check if user has muted conversation
        const isMuted = conversation.mutedBy?.some(
          (id) => id.toString() === participantId,
        );
        if (isMuted) {
          this.logger.log(`User ${participantId} has muted conversation, skipping FCM`);
          continue;
        }

        // Get user's FCM tokens
        const user = await this.accountModel
          .findById(participantId)
          .select('fcmTokens')
          .lean();

        if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
          continue;
        }

        const contentPreview = content || '[Hình ảnh/File]';

        await this.firebaseService.sendToDevice(
          user.fcmTokens,
          payload.senderName || 'Người dùng',
          contentPreview,
          {
            conversationId: conversationId,
            messageId: payload.messageId,
            type: 'NEW_MESSAGE',
            avatar: payload.senderAvatar || '',
          },
        );

        this.logger.log(`FCM sent to user ${participantId}`);
      } catch (error) {
        this.logger.error(`FCM error for user ${participantId}:`, error);
      }
    }
  }
}
