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
    private readonly aiService: AiService
  ) {}

  /**
   * Handle chat.message.created event
   * Process AI chatbot and FCM notifications
   */
  async handleMessageCreated(payload: MessageCreatedEventDto): Promise<void> {
    this.logger.log(`Processing message: ${payload.messageId}`);

    // Process in parallel for better performance
    await Promise.all([this.processAiChatbot(payload), this.processFcmNotification(payload)]);
  }

  /**
   * Process AI chatbot response — streaming tokens via Socket.io
   */
  private async processAiChatbot(payload: MessageCreatedEventDto): Promise<void> {
    const { isChatbotConversation, isChatbotMentioned } = payload;

    if (!isChatbotConversation && !isChatbotMentioned) {
      return;
    }

    this.logger.log(`AI Chatbot triggered for conversation: ${payload.conversationId}`);

    // Determine bot senderId early
    let botSenderId = payload.senderId;

    // Emit typing indicator to Backend immediately
    this.backendService.emit('chat.typing', {
      conversationId: payload.conversationId,
      isTyping: true,
    });

    try {
      // Run bot user lookup and chat history fetch in parallel
      const [botUser, recentMessages] = await Promise.all([
        isChatbotConversation
          ? this.accountModel.findOne({ username: 'ai_assistant' }).lean()
          : Promise.resolve(null),
        this.messageModel
          .find({ conversationId: new Types.ObjectId(payload.conversationId) })
          .sort({ createdAt: -1 })
          .limit(10)
          .populate('senderId', 'firstName lastName')
          .lean(),
      ]);

      if (botUser) botSenderId = (botUser as any)._id.toString();

      const chatHistory = recentMessages.reverse().map((msg: any) => ({
        role: (msg.type === MessageType.CHATBOT ? 'assistant' : 'user') as 'user' | 'assistant',
        content: msg.content || '',
        senderName: msg.senderId ? `${msg.senderId.firstName} ${msg.senderId.lastName}` : 'User',
      }));

      const imageUrls =
        payload.attachments
          ?.filter((att) => att.mediaType === 'IMAGE' && att.url)
          .map((att) => att.url) || [];

      this.logger.log(`Chat context: ${chatHistory.length} messages, ${imageUrls.length} images`);

      // Create placeholder message in DB to get the _id
      const chatbotMessage = new this.messageModel({
        conversationId: new Types.ObjectId(payload.conversationId),
        senderId: new Types.ObjectId(botSenderId),
        content: '',
        type: MessageType.CHATBOT,
        postIdsRecommendationfromAI: [],
      });
      const savedMessage = await chatbotMessage.save();
      const messageId = savedMessage._id.toString();

      // Notify frontend that streaming has started (with messageId)
      this.backendService.emit('chat.ai.stream.start', {
        conversationId: payload.conversationId,
        messageId,
        senderId: botSenderId,
      });

      // Don't stop typing dots here — frontend will hide them when first token arrives

      let postIds: string[] = [];

      // Buffer tokens and flush in batches to reduce RabbitMQ message overhead
      let tokenBuffer = '';
      let flushTimer: ReturnType<typeof setTimeout> | null = null;
      const FLUSH_INTERVAL = 80; // ms

      const flushTokens = () => {
        if (tokenBuffer) {
          const batch = tokenBuffer;
          tokenBuffer = '';
          this.backendService.emit('chat.ai.token', {
            conversationId: payload.conversationId,
            messageId,
            token: batch,
          });
        }
        flushTimer = null;
      };

      // Stream tokens from AI server
      await this.aiService.getChatBotResponseStream(
        payload.chatMessage || payload.content,
        chatHistory,
        imageUrls,
        {
          onToken: (token: string) => {
            tokenBuffer += token;
            // Schedule a flush if not already pending
            if (!flushTimer) {
              flushTimer = setTimeout(flushTokens, FLUSH_INTERVAL);
            }
          },
          onPostIds: (ids: string[]) => {
            postIds = ids;
          },
          onDone: async (fullText: string) => {
            // Flush any remaining buffered tokens
            if (flushTimer) {
              clearTimeout(flushTimer);
              flushTimer = null;
            }
            flushTokens();

            // Update the message in DB with full text
            await this.messageModel.findByIdAndUpdate(messageId, {
              content: fullText,
              postIdsRecommendationfromAI: postIds,
            });

            // Update conversation lastMessage
            await this.conversationModel.findByIdAndUpdate(payload.conversationId, {
              lastMessage: savedMessage._id,
            });

            this.logger.log(`AI stream complete, saved: ${messageId}`);

            // Emit final done event
            this.backendService.emit('chat.ai.stream.done', {
              conversationId: payload.conversationId,
              messageId,
              senderId: botSenderId,
              content: fullText,
              postIdsRecommendation: postIds,
              originalSenderId: payload.senderId,
              success: true,
            });
          },
          onError: (error: string) => {
            this.logger.error(`AI stream error: ${error}`);
          },
        }
      );
    } catch (error) {
      this.logger.error('AI processing error:', error);

      // Stop typing indicator on error
      this.backendService.emit('chat.typing', {
        conversationId: payload.conversationId,
        isTyping: false,
      });

      // Save error message
      const errorMessage = new this.messageModel({
        conversationId: new Types.ObjectId(payload.conversationId),
        senderId: new Types.ObjectId(botSenderId),
        content: '⚠️ Xin lỗi, tôi đang gặp sự cố kỹ thuật. Vui lòng thử lại sau!',
        type: MessageType.CHATBOT,
      });

      const savedError = await errorMessage.save();

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
        const isMuted = conversation.mutedBy?.some((id) => id.toString() === participantId);
        if (isMuted) {
          this.logger.log(`User ${participantId} has muted conversation, skipping FCM`);
          continue;
        }

        // Get user's FCM tokens
        const user = await this.accountModel.findById(participantId).select('fcmTokens').lean();

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
          }
        );

        this.logger.log(`FCM sent to user ${participantId}`);
      } catch (error) {
        this.logger.error(`FCM error for user ${participantId}:`, error);
      }
    }
  }
}
