import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { ClientProxy } from '@nestjs/microservices';
import { Model, Types } from 'mongoose';
import { lastValueFrom } from 'rxjs';
import { MessageCreatedEventDto } from './dto/message.dto';
import { PermanentEventError } from './common/event-validation';
import { Account, AccountDocument } from './schemas/account.schema';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';
import { Message, MessageDocument, MessageType } from './schemas/message.schema';
import { AiService } from './services/ai.service';
import { EventInboxService, EventLeaseBusyError } from './services/event-inbox.service';
import { FirebaseService } from './services/firebase.service';

interface VerifiedMessageContext {
  messageId: string;
  conversationId: string;
  senderId: string;
  content: string;
  chatMessage: string;
  isChatbotConversation: boolean;
  isChatbotMentioned: boolean;
  participantIds: string[];
  mutedParticipantIds: Set<string>;
  senderName: string;
  senderAvatar: string;
  imageUrls: string[];
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private readonly allowedImageHosts: Set<string>;

  constructor(
    @InjectModel(Account.name) private readonly accountModel: Model<AccountDocument>,
    @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @Inject('BACKEND_SERVICE') private readonly backendService: ClientProxy,
    private readonly firebaseService: FirebaseService,
    private readonly aiService: AiService,
    private readonly eventInbox: EventInboxService,
    config: ConfigService
  ) {
    this.allowedImageHosts = new Set(
      (config.get<string>('AI_IMAGE_ALLOWED_HOSTS') || 'res.cloudinary.com')
        .split(',')
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean)
    );
  }

  async handleMessageCreated(payload: MessageCreatedEventDto, eventId: string): Promise<void> {
    const state = await this.eventInbox.begin(eventId, 'chat.message.created');
    if (state.completed || state.deadLettered) return;
    if (!state.claimed) throw new EventLeaseBusyError(eventId);

    const context = await this.verifyMessageEvent(payload);
    const jobs: Promise<void>[] = [];

    if (!state.aiCompleted) {
      jobs.push(
        this.processAiChatbot(context).then(() =>
          this.eventInbox.completeStep(eventId, 'aiCompleted')
        )
      );
    }
    if (!state.fcmCompleted) {
      jobs.push(
        this.processFcmNotification(context).then(() =>
          this.eventInbox.completeStep(eventId, 'fcmCompleted')
        )
      );
    }

    const results = await Promise.allSettled(jobs);
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    );
    if (failure) {
      await this.eventInbox.recordFailure(eventId, failure.reason);
      throw failure.reason;
    }
    await this.eventInbox.complete(eventId);
  }

  async handleMessageExhausted(
    payload: MessageCreatedEventDto,
    eventId: string,
    error: unknown
  ): Promise<void> {
    const aiCompleted = await this.eventInbox.isStepCompleted(eventId, 'aiCompleted');
    if (!aiCompleted) {
      const chatbotMessage = await this.messageModel.findOne({
        sourceMessageId: new Types.ObjectId(payload.messageId),
      });
      if (chatbotMessage) {
        chatbotMessage.content =
          'Xin lỗi, trợ lý AI đang tạm thời gặp sự cố. Vui lòng thử lại sau.';
        chatbotMessage.aiProcessingStatus = 'DEAD';
        chatbotMessage.aiProcessingError = this.errorMessage(error).slice(0, 2_000);
        await chatbotMessage.save();
        await this.conversationModel.updateOne(
          { _id: chatbotMessage.conversationId },
          { $set: { lastMessage: chatbotMessage._id } }
        );
        await this.safeEmitBackend('chat.ai.stream.done', {
          conversationId: payload.conversationId,
          messageId: chatbotMessage._id.toString(),
          senderId: chatbotMessage.senderId.toString(),
          content: chatbotMessage.content,
          postIdsRecommendation: (chatbotMessage.postIdsRecommendationfromAI || []).map((postId) =>
            postId.toString()
          ),
          originalSenderId: payload.senderId,
          success: false,
        });
      }
      await this.safeEmitBackend('chat.typing', {
        conversationId: payload.conversationId,
        isTyping: false,
      });
    }
  }

  private async verifyMessageEvent(
    payload: MessageCreatedEventDto
  ): Promise<VerifiedMessageContext> {
    const [sourceMessage, conversation, sender] = await Promise.all([
      this.messageModel
        .findOne({ _id: payload.messageId, isDeleted: { $ne: true } })
        .select('conversationId senderId content attachments type')
        .lean(),
      this.conversationModel
        .findOne({ _id: payload.conversationId, isDeleted: { $ne: true } })
        .select('type participants mutedBy')
        .lean(),
      this.accountModel
        .findOne({
          _id: payload.senderId,
          status: 'ACTIVE',
          isActive: { $ne: false },
          isDeleted: { $ne: true },
          isBlocked: { $ne: true },
        })
        .select('firstName lastName avatar status isActive isDeleted isBlocked')
        .lean(),
    ]);

    if (!sourceMessage || !conversation || !sender) {
      throw new PermanentEventError('Message, conversation or sender no longer exists');
    }
    if (!sourceMessage.senderId || !sourceMessage.conversationId) {
      throw new PermanentEventError('Persisted message is missing ownership fields');
    }
    if (
      sourceMessage.type === MessageType.CHATBOT ||
      sourceMessage.type === MessageType.SYSTEM ||
      sourceMessage.type === MessageType.CALL
    ) {
      throw new PermanentEventError('This message type cannot trigger worker side effects');
    }
    if (
      sourceMessage.conversationId.toString() !== payload.conversationId ||
      sourceMessage.senderId.toString() !== payload.senderId
    ) {
      throw new PermanentEventError('Message event does not match persisted ownership');
    }

    const activeParticipantIds = new Set(
      (conversation.participants || [])
        .filter((participant) => !participant.kickedAt && !participant.leftAt)
        .map((participant) => participant.user.toString())
    );
    if (!activeParticipantIds.has(payload.senderId)) {
      throw new PermanentEventError('Sender is not an active conversation participant');
    }

    const requestedRecipients = new Set(payload.participantIds || []);
    const participantIds = [...activeParticipantIds].filter(
      (participantId) =>
        participantId !== payload.senderId && requestedRecipients.has(participantId)
    );
    const mutedParticipantIds = new Set((conversation.mutedBy || []).map((id) => id.toString()));
    const content = (sourceMessage.content || '').slice(0, 5_000);
    const mentionPattern = /@\[chatbot:([^\]]{1,80})\]/i;
    const isChatbotConversation = conversation.type === 'CHATBOT';
    const isChatbotMentioned = !isChatbotConversation && mentionPattern.test(content);
    const chatMessage = isChatbotMentioned ? content.replace(mentionPattern, '').trim() : content;
    const imageUrls = (sourceMessage.attachments || [])
      .filter(
        (attachment) => attachment.mediaType === 'IMAGE' && this.isSafeImageUrl(attachment.url)
      )
      .map((attachment) => attachment.url)
      .slice(0, 4);

    return {
      messageId: payload.messageId,
      conversationId: payload.conversationId,
      senderId: payload.senderId,
      content,
      chatMessage,
      isChatbotConversation,
      isChatbotMentioned,
      participantIds,
      mutedParticipantIds,
      senderName: `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || 'Người dùng',
      senderAvatar: sender.avatar || '',
      imageUrls,
    };
  }

  private async processAiChatbot(context: VerifiedMessageContext): Promise<void> {
    if (!context.isChatbotConversation && !context.isChatbotMentioned) return;

    let chatbotMessage: MessageDocument | null = null;
    try {
      const historyLimit = context.isChatbotConversation ? 6 : 10;
      const [botUser, recentMessages] = await Promise.all([
        this.accountModel
          .findOne({
            username: 'ai_assistant',
            status: 'ACTIVE',
            isActive: { $ne: false },
            isDeleted: { $ne: true },
            isBlocked: { $ne: true },
          })
          .select('_id')
          .lean(),
        this.messageModel
          .find({
            conversationId: new Types.ObjectId(context.conversationId),
            _id: { $ne: new Types.ObjectId(context.messageId) },
            isDeleted: { $ne: true },
          })
          .sort({ createdAt: -1 })
          .limit(historyLimit)
          .populate('senderId', 'firstName lastName')
          .lean(),
      ]);
      if (!botUser) throw new PermanentEventError('Active ai_assistant account is missing');

      const existingResponse = await this.messageModel
        .findOne({ sourceMessageId: new Types.ObjectId(context.messageId) })
        .select('aiProcessingStatus content postIdsRecommendationfromAI senderId conversationId')
        .lean();
      if (existingResponse?.aiProcessingStatus === 'COMPLETED') {
        if (existingResponse.senderId) {
          await this.safeEmitBackend('chat.ai.stream.done', {
            conversationId: context.conversationId,
            messageId: existingResponse._id.toString(),
            senderId: existingResponse.senderId.toString(),
            content: existingResponse.content || '',
            postIdsRecommendation: (existingResponse.postIdsRecommendationfromAI || []).map(
              (postId) => postId.toString()
            ),
            originalSenderId: context.senderId,
            success: true,
          });
        }
        return;
      }
      if (existingResponse?.aiProcessingStatus === 'CONTENT_READY') {
        if (!existingResponse.senderId) {
          throw new Error('Stored AI response is missing its sender');
        }
        const existingPostIds = (existingResponse.postIdsRecommendationfromAI || []).map((id) =>
          id.toString()
        );
        await this.conversationModel.updateOne(
          { _id: new Types.ObjectId(context.conversationId) },
          { $set: { lastMessage: existingResponse._id } }
        );
        const recoveryCompletion = await this.messageModel.updateOne(
          { _id: existingResponse._id, aiProcessingStatus: 'CONTENT_READY' },
          { $set: { aiProcessingStatus: 'COMPLETED' } }
        );
        if (recoveryCompletion.matchedCount > 0) {
          await this.emitBackend('chat.ai.stream.done', {
            conversationId: context.conversationId,
            messageId: existingResponse._id.toString(),
            senderId: existingResponse.senderId.toString(),
            content: existingResponse.content || '',
            postIdsRecommendation: existingPostIds,
            originalSenderId: context.senderId,
            success: true,
          });
          await this.emitBackend('chat.typing', {
            conversationId: context.conversationId,
            isTyping: false,
          });
        }
        return;
      }

      chatbotMessage = await this.messageModel.findOneAndUpdate(
        { sourceMessageId: new Types.ObjectId(context.messageId) },
        {
          $setOnInsert: {
            conversationId: new Types.ObjectId(context.conversationId),
            senderId: botUser._id,
            sourceMessageId: new Types.ObjectId(context.messageId),
            type: MessageType.CHATBOT,
          },
          $set: {
            content: '',
            postIdsRecommendationfromAI: [],
            aiProcessingStatus: 'PENDING',
          },
          $unset: { aiProcessingError: 1 },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      if (!chatbotMessage) throw new Error('Unable to create AI response placeholder');

      const messageId = chatbotMessage._id.toString();
      const chatHistory: Array<{
        role: 'user' | 'assistant';
        content: string;
        senderName: string;
      }> = recentMessages.reverse().map((message) => {
        const sender = message.senderId as unknown as { firstName?: string; lastName?: string };
        return {
          role: message.type === MessageType.CHATBOT ? 'assistant' : 'user',
          content: (message.content || '').slice(0, 500),
          senderName: sender
            ? `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || 'User'
            : 'User',
        };
      });

      await this.emitBackend('chat.typing', {
        conversationId: context.conversationId,
        isTyping: true,
      });
      await this.emitBackend('chat.ai.stream.start', {
        conversationId: context.conversationId,
        messageId,
        senderId: botUser._id.toString(),
      });

      let postIds: string[] = [];
      let tokenBuffer = '';
      let lastFlushAt = Date.now();
      let publishChain = Promise.resolve();
      const enqueueTokenFlush = () => {
        if (!tokenBuffer) return;
        const token = tokenBuffer;
        tokenBuffer = '';
        lastFlushAt = Date.now();
        publishChain = publishChain.then(() =>
          this.emitBackend('chat.ai.token', {
            conversationId: context.conversationId,
            messageId,
            token,
          })
        );
        void publishChain.catch(() => undefined);
      };

      await this.aiService.getChatBotResponseStream(
        context.chatMessage || context.content,
        chatHistory,
        context.imageUrls,
        context.senderId,
        {
          onToken: (token) => {
            tokenBuffer += token;
            if (tokenBuffer.length >= 256 || Date.now() - lastFlushAt >= 80) enqueueTokenFlush();
          },
          onPostIds: (ids) => {
            postIds = ids;
          },
          onDone: async (fullText) => {
            enqueueTokenFlush();
            await publishChain;
            const postObjectIds = postIds.map((id) => new Types.ObjectId(id));
            await this.messageModel.updateOne(
              { _id: chatbotMessage!._id },
              {
                $set: {
                  content: fullText,
                  postIdsRecommendationfromAI: postObjectIds,
                  aiProcessingStatus: 'CONTENT_READY',
                },
                $unset: { aiProcessingError: 1 },
              }
            );
            await this.conversationModel.updateOne(
              { _id: new Types.ObjectId(context.conversationId) },
              { $set: { lastMessage: chatbotMessage!._id } }
            );
            const completion = await this.messageModel.updateOne(
              { _id: chatbotMessage!._id, aiProcessingStatus: 'CONTENT_READY' },
              { $set: { aiProcessingStatus: 'COMPLETED' } }
            );
            if (completion.matchedCount > 0) {
              await this.emitBackend('chat.ai.stream.done', {
                conversationId: context.conversationId,
                messageId,
                senderId: botUser._id.toString(),
                content: fullText,
                postIdsRecommendation: postIds,
                originalSenderId: context.senderId,
                success: true,
              });
              await this.emitBackend('chat.typing', {
                conversationId: context.conversationId,
                isTyping: false,
              });
            }
          },
          onError: (error) => {
            this.logger.warn(`AI stream failed for ${context.messageId}: ${error}`);
          },
        }
      );
    } catch (error) {
      if (chatbotMessage) {
        await this.messageModel.updateOne(
          { _id: chatbotMessage._id, aiProcessingStatus: { $nin: ['CONTENT_READY', 'COMPLETED'] } },
          {
            $set: {
              aiProcessingStatus: 'FAILED',
              aiProcessingError: this.errorMessage(error).slice(0, 2_000),
            },
          }
        );
      }
      await this.safeEmitBackend('chat.typing', {
        conversationId: context.conversationId,
        isTyping: false,
      });
      throw error;
    }
  }

  private async processFcmNotification(context: VerifiedMessageContext): Promise<void> {
    const recipientIds = context.participantIds.filter(
      (participantId) => !context.mutedParticipantIds.has(participantId)
    );
    if (recipientIds.length === 0) return;

    const recipients = await this.accountModel
      .find({
        _id: { $in: recipientIds.map((id) => new Types.ObjectId(id)) },
        status: 'ACTIVE',
        isActive: { $ne: false },
        isDeleted: { $ne: true },
        isBlocked: { $ne: true },
      })
      .select('fcmTokens')
      .lean();
    const allTokens = [...new Set(recipients.flatMap((recipient) => recipient.fcmTokens || []))];
    const tokens = allTokens.slice(0, 10_000);
    if (allTokens.length > tokens.length) {
      this.logger.warn(`Capped FCM fanout at ${tokens.length} unique tokens`);
    }
    if (tokens.length === 0) return;

    const invalidTokens = await this.firebaseService.sendToDevice(
      tokens,
      context.senderName,
      context.content || '[Hình ảnh/Tệp]',
      {
        conversationId: context.conversationId,
        messageId: context.messageId,
        type: 'NEW_MESSAGE',
        avatar: context.senderAvatar,
      }
    );
    if (invalidTokens.length > 0) {
      await this.accountModel.updateMany(
        { fcmTokens: { $in: invalidTokens } },
        { $pull: { fcmTokens: { $in: invalidTokens } } }
      );
    }
  }

  private isSafeImageUrl(rawUrl: string): boolean {
    try {
      if (!rawUrl || rawUrl.length > 2_048) return false;
      const url = new URL(rawUrl);
      if (url.protocol !== 'https:' || url.username || url.password) return false;
      const hostname = url.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname === '0.0.0.0' ||
        hostname === '::1' ||
        /^127\./.test(hostname) ||
        /^10\./.test(hostname) ||
        /^192\.168\./.test(hostname) ||
        /^169\.254\./.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
      ) {
        return false;
      }
      return this.allowedImageHosts.has(hostname);
    } catch {
      return false;
    }
  }

  private async emitBackend(pattern: string, payload: Record<string, unknown>): Promise<void> {
    await lastValueFrom(this.backendService.emit(pattern, payload), { defaultValue: undefined });
  }

  private async safeEmitBackend(pattern: string, payload: Record<string, unknown>): Promise<void> {
    try {
      await this.emitBackend(pattern, payload);
    } catch (error) {
      this.logger.warn(`Could not emit ${pattern}: ${this.errorMessage(error)}`);
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (typeof error === 'number' || typeof error === 'boolean') return String(error);
    return 'Unknown worker error';
  }
}
