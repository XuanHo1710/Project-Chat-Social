import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Conversation, ConversationDocument } from 'src/conversation/entities/conversation.entity';
import { Model, Types } from 'mongoose';
import { Message, EmotionType, MessageType } from 'src/chat/entities/message.entity';
import {
  ConversationReadStatus,
  ConversationReadStatusDocument,
} from './entities/conversation-read-status.entity';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

export interface MessageHistoryPage {
  data: unknown[];
  readStatuses: Array<Record<string, unknown>>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export interface MarkAsReadResult {
  modifiedCount: number;
  conversationId?: string;
  readBy?: string;
  lastReadMessageId?: Types.ObjectId;
  readStatus?: Record<string, unknown> & { userId?: unknown };
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    @InjectModel(ConversationReadStatus.name)
    private readonly readStatusModel: Model<ConversationReadStatusDocument>,
    private readonly cloudinaryService: CloudinaryService
  ) {}

  private async assertActiveConversationMember(
    conversationId: string,
    userId: string
  ): Promise<void> {
    if (!Types.ObjectId.isValid(conversationId) || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid conversation or user identifier');
    }

    const membership = await this.conversationModel.exists({
      _id: conversationId,
      isDeleted: { $ne: true },
      participants: {
        $elemMatch: {
          user: new Types.ObjectId(userId),
          kickedAt: null,
          leftAt: null,
        },
      },
    });
    if (!membership) {
      throw new ForbiddenException('You are not an active member of this conversation');
    }
  }

  async sendMessage(createMessageDto: CreateMessageDto, userId: string) {
    const conversationId = createMessageDto.conversationId?.toString() || '';
    await this.assertActiveConversationMember(conversationId, userId);

    if (!Object.values(MessageType).includes(createMessageDto.type)) {
      throw new BadRequestException('Unsupported message type');
    }
    const content = (createMessageDto.content || '').trim().slice(0, 5000);
    const attachments = (createMessageDto.attachments || []).slice(0, 10).map((attachment) => ({
      url: attachment.url?.trim().slice(0, 2048),
      publicId: attachment.publicId?.trim().slice(0, 200),
      fileName: attachment.fileName?.trim().slice(0, 255),
      fileSize: Math.max(0, Math.min(Number(attachment.fileSize) || 0, 100 * 1024 * 1024)),
      mediaType: attachment.mediaType,
    }));
    if (!content && attachments.length === 0 && !createMessageDto.postId && !createMessageDto.callData) {
      throw new BadRequestException('Message content is required');
    }
    if (attachments.length > 0) {
      await this.cloudinaryService.assertOwnedMedia(userId, attachments);
    }

    if (createMessageDto.replyTo) {
      const validReplyTarget = await this.messageModel.exists({
        _id: createMessageDto.replyTo,
        conversationId: new Types.ObjectId(conversationId),
      });
      if (!validReplyTarget) {
        throw new BadRequestException('Reply target does not belong to this conversation');
      }
    }

    const message = await this.messageModel.create({
      ...createMessageDto,
      conversationId: new Types.ObjectId(conversationId),
      senderId: new Types.ObjectId(userId),
      content,
      attachments,
    });
    return await this.messageModel
      .findById(message._id)
      .populate('senderId', 'firstName lastName _id avatar')
      // .populate('readBy', 'firstName lastName _id avatar')
      .populate({
        path: 'replyTo',
        populate: { path: 'senderId', select: 'firstName lastName _id' },
      })
      .populate({
        path: 'postId',
        populate: { path: 'userId', select: 'firstName lastName _id avatar username' },
      })
      .populate({
        path: 'postIdsRecommendationfromAI',
        populate: { path: 'userId', select: 'firstName lastName _id avatar username' },
      })
      .exec();
  }

  // Create system message (for notifications like theme change, etc.)
  async createMessage(data: {
    conversationId: string;
    senderId: string;
    type: string;
    content: string;
  }) {
    // For SYSTEM messages, we use a placeholder senderId or null
    const messageData: any = {
      conversationId: new Types.ObjectId(data.conversationId),
      type: data.type,
      content: data.content,
    };

    // For SYSTEM messages, senderId can be 'system' - we handle it specially
    if (data.senderId === 'system' || data.type === 'SYSTEM') {
      // Use a dummy ObjectId for system or the first participant
      const conversation = await this.conversationModel
        .findById(data.conversationId)
        .select('participants')
        .lean();
      if (conversation && conversation.participants.length > 0) {
        messageData.senderId = conversation.participants[0].user;
      }
    } else {
      messageData.senderId = new Types.ObjectId(data.senderId);
    }

    const message = await this.messageModel.create(messageData);
    return message;
  }

  // Find the last ONGOING CALL message in a conversation (for group call finalization)
  async findLastCallMessage(conversationId: string) {
    return await this.messageModel
      .findOne({
        conversationId: new Types.ObjectId(conversationId),
        type: MessageType.CALL,
        isDeleted: { $ne: true },
        'callData.callStatus': 'ONGOING',
      })
      .sort({ createdAt: -1 });
  }

  // Get recent messages for AI chat context
  async getRecentMessagesForContext(conversationId: string, limit: number = 15) {
    return await this.messageModel
      .find({
        conversationId,
        isDeleted: { $ne: true },
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('senderId', 'firstName lastName')
      .lean();
  }

  async findAllMessagesByConversationId(
    conversationId: string,
    userId: string, // Add userId to check kicked/left status
    page: number = 1,
    limit: number = 15,
    before?: string // cursor: load messages before this messageId
  ): Promise<MessageHistoryPage> {
    if (!Types.ObjectId.isValid(conversationId) || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid conversation or user identifier');
    }
    page = Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1);
    limit = Math.min(50, Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 15));

    // Get conversation to check user's kicked/left status
    const conversation = await this.conversationModel
      .findOne({ _id: conversationId, 'participants.user': new Types.ObjectId(userId) })
      .select('participants isDeleted')
      .lean();
    if (!conversation) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
    }

    // Find user's participant record
    const participant = conversation.participants.find((p) => p.user.toString() === userId);
    if (!participant) {
      throw new ForbiddenException('You cannot access this conversation history');
    }

    const query: any = {
      conversationId: new Types.ObjectId(conversationId),
      aiProcessingStatus: { $nin: ['PENDING', 'FAILED', 'DEAD'] },
    };

    // If user was kicked, only show messages up to kickedAt time
    if (participant?.kickedAt) {
      query.createdAt = { ...query.createdAt, $lte: participant.kickedAt };
    }

    // If user left, only show messages up to leftAt time
    if (participant?.leftAt) {
      query.createdAt = { ...query.createdAt, $lte: participant.leftAt };
    }

    // If cursor provided, get messages before that message
    if (before && Types.ObjectId.isValid(before)) {
      const cursorMessage = await this.messageModel
        .findOne({ _id: before, conversationId: new Types.ObjectId(conversationId) })
        .select('createdAt')
        .lean();
      if (cursorMessage) {
        query.createdAt = { ...query.createdAt, $lt: cursorMessage.createdAt };
      }
    }

    // Calculate skip for offset-based pagination (only if not using cursor)
    const skip = !before && page > 1 ? (page - 1) * limit : 0;

    const [messages, total] = await Promise.all([
      this.messageModel
        .find(query)
        .sort({ createdAt: -1 }) // Newest first for pagination
        .skip(skip) // Apply skip
        .limit(limit)
        .populate('senderId', 'firstName lastName _id avatar')
        // .populate('readBy', 'firstName lastName _id avatar')
        .populate({
          path: 'emotions.userId',
          select: 'firstName lastName _id avatar',
        })
        .populate([
          {
            path: 'replyTo',
            populate: [{ path: 'senderId', select: 'firstName lastName _id' }],
          },
          {
            path: 'postId',
            populate: { path: 'userId', select: 'firstName lastName _id avatar username' },
          },
          {
            path: 'postIdsRecommendationfromAI',
            populate: { path: 'userId', select: 'firstName lastName _id avatar username' },
          },
        ])
        .lean(),
      this.messageModel.countDocuments(query),
    ]);

    // Reverse to show oldest first in UI
    const sortedMessages = messages.reverse();

    // Ensure readBy is removed or handled via separate API
    const normalizedMessages = sortedMessages;

    // Fetch read statuses (cursors) for this conversation
    const readStatuses = await this.readStatusModel
      .find({
        conversationId: new Types.ObjectId(conversationId),
      })
      .populate('userId', 'firstName lastName _id avatar')
      .populate('lastReadMessageId', 'createdAt')
      .lean();

    // Visualize data: Sanitize ObjectIds to Strings for Frontend
    const sanitizedReadStatuses = readStatuses
      .filter((status) => status.lastReadMessageId) // Exclude status without message pointer
      .map((status) => ({
        ...status,
        _id: status._id.toString(),
        conversationId: status.conversationId.toString(),
        userId: status.userId
          ? {
              ...status.userId,
              _id: (status.userId as any)._id?.toString() || status.userId.toString(),
            }
          : null,
        lastReadMessageId: status.lastReadMessageId
          ? {
              ...(status.lastReadMessageId as any),
              _id: (status.lastReadMessageId as any)._id?.toString(),
            }
          : status.lastReadMessageId,
      }));

    return {
      data: normalizedMessages,
      readStatuses: sanitizedReadStatuses, // Include read statuses in response
      pagination: {
        page,
        limit,
        total,
        hasMore: messages.length === limit,
      },
    };
  }

  // Get media messages (images/videos) for a conversation with pagination
  async findMediaMessages(
    conversationId: string,
    userId: string,
    page: number = 1,
    limit: number = 20
  ) {
    await this.assertActiveConversationMember(conversationId, userId);
    page = Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1);
    limit = Math.min(50, Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 20));
    const skip = (page - 1) * limit;

    const query = {
      conversationId,
      isDeleted: { $ne: true },
      $or: [
        { type: 'IMAGE' },
        { type: 'VIDEO' },
        { 'attachments.mediaType': { $in: ['IMAGE', 'VIDEO'] } },
      ],
    };

    const [messages, total] = await Promise.all([
      this.messageModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.messageModel.countDocuments(query),
    ]);

    return {
      data: messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    };
  }

  // Get file messages (documents/RAW files) for a conversation with pagination
  async findFileMessages(
    conversationId: string,
    userId: string,
    page: number = 1,
    limit: number = 20
  ) {
    await this.assertActiveConversationMember(conversationId, userId);
    page = Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1);
    limit = Math.min(50, Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 20));
    const skip = (page - 1) * limit;

    const query = {
      conversationId,
      isDeleted: { $ne: true },
      $or: [{ type: 'FILE' }, { 'attachments.mediaType': 'RAW' }],
    };

    const [messages, total] = await Promise.all([
      this.messageModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.messageModel.countDocuments(query),
    ]);

    return {
      data: messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    };
  }

  async findOne(id: string, userId: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid message identifier');
    }
    const message = await this.messageModel.findById(id).lean();
    if (!message) {
      throw new NotFoundException('Message was not found');
    }
    await this.assertActiveConversationMember(message.conversationId.toString(), userId);
    return message;
  }

  // Resolve only a persisted AI message that belongs to the broker-provided conversation.
  async findAiMessageForBroker(messageId: string, conversationId: string): Promise<any> {
    if (!Types.ObjectId.isValid(messageId) || !Types.ObjectId.isValid(conversationId)) {
      throw new BadRequestException('Invalid broker message identifiers');
    }
    const message = await this.messageModel
      .findOne({
        _id: new Types.ObjectId(messageId),
        conversationId: new Types.ObjectId(conversationId),
        type: MessageType.CHATBOT,
        isDeleted: { $ne: true },
      })
      .populate('senderId', 'firstName lastName _id avatar')
      .populate({
        path: 'replyTo',
        populate: { path: 'senderId', select: 'firstName lastName _id' },
      })
      .populate({
        path: 'postId',
        populate: { path: 'userId', select: 'firstName lastName _id avatar username' },
      })
      .populate({
        path: 'postIdsRecommendationfromAI',
        populate: { path: 'userId', select: 'firstName lastName _id avatar username' },
      })
      .exec();
    if (!message) {
      throw new NotFoundException('Broker AI message was not found');
    }
    return message;
  }

  async findMessageForConversation(messageId: string, conversationId: string): Promise<any> {
    if (!Types.ObjectId.isValid(messageId) || !Types.ObjectId.isValid(conversationId)) {
      throw new BadRequestException('Invalid message identifiers');
    }
    const message = await this.messageModel
      .findOne({
        _id: new Types.ObjectId(messageId),
        conversationId: new Types.ObjectId(conversationId),
        isDeleted: { $ne: true },
      })
      .populate('senderId', 'firstName lastName _id avatar')
      .populate({
        path: 'replyTo',
        populate: { path: 'senderId', select: 'firstName lastName _id' },
      })
      .populate({
        path: 'postId',
        populate: { path: 'userId', select: 'firstName lastName _id avatar username' },
      })
      .populate({
        path: 'postIdsRecommendationfromAI',
        populate: { path: 'userId', select: 'firstName lastName _id avatar username' },
      })
      .exec();
    if (!message) throw new NotFoundException('Message was not found');
    return message;
  }

  async brokerConversationExists(conversationId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(conversationId)) return false;
    return !!(await this.conversationModel.exists({
      _id: new Types.ObjectId(conversationId),
      isDeleted: { $ne: true },
    }));
  }

  // ============ MESSAGE FEATURES ============

  // 1. Chỉnh sửa tin nhắn (giới hạn 15 phút)
  async editMessage(messageId: string, userId: string, newContent: string) {
    if (!Types.ObjectId.isValid(messageId) || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid message or user identifier');
    }
    const message = await this.messageModel.findById(messageId).lean();
    if (!message) {
      throw new NotFoundException('Không tìm thấy tin nhắn');
    }

    // Kiểm tra người gửi
    if (message.senderId && message.senderId.toString() !== userId) {
      throw new ForbiddenException('Bạn chỉ có thể chỉnh sửa tin nhắn của mình');
    }

    // Kiểm tra thời gian (15 phút)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (message.createdAt < fifteenMinutesAgo) {
      throw new BadRequestException('Chỉ có thể chỉnh sửa tin nhắn trong vòng 15 phút');
    }

    // Kiểm tra tin nhắn đã bị xóa chưa
    if (message.isDeleted) {
      throw new BadRequestException('Tin nhắn đã bị xóa');
    }

    const content = (newContent || '').trim().slice(0, 5000);
    if (!content) {
      throw new BadRequestException('Message content is required');
    }

    return await this.messageModel
      .findByIdAndUpdate(
        messageId,
        {
          $set: {
            content,
            isEdited: true,
          },
        },
        { new: true }
      )
      .populate('senderId', 'firstName lastName _id avatar')
      // .populate('readBy', 'firstName lastName _id avatar')
      .populate({
        path: 'emotions.userId',
        select: 'firstName lastName _id avatar',
      })
      .populate([
        {
          path: 'replyTo',
          populate: [{ path: 'senderId', select: 'firstName lastName _id' }],
        },
        {
          path: 'postId',
          populate: { path: 'userId', select: 'firstName lastName _id avatar username' },
        },
        {
          path: 'postIdsRecommendationfromAI',
          populate: { path: 'userId', select: 'firstName lastName _id avatar username' },
        },
      ])
      .exec();
  }

  // 2. Thả cảm xúc tin nhắn
  async addReaction(messageId: string, userId: string, emotionType: EmotionType) {
    if (!Types.ObjectId.isValid(messageId) || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid message or user identifier');
    }
    const message = await this.messageModel.findById(messageId).lean();
    if (!message) {
      throw new NotFoundException('Không tìm thấy tin nhắn');
    }

    if (message.isDeleted) {
      throw new BadRequestException('Tin nhắn đã bị xóa');
    }

    await this.assertActiveConversationMember(message.conversationId.toString(), userId);

    // Update or add reaction in the array
    const userObjectId = new Types.ObjectId(userId);

    return await this.messageModel
      .findByIdAndUpdate(
        messageId,
        [
          {
            $set: {
              emotions: {
                $concatArrays: [
                  {
                    $filter: {
                      input: { $ifNull: ['$emotions', []] },
                      as: 'existingEmotion',
                      cond: { $ne: ['$$existingEmotion.userId', userObjectId] },
                    },
                  },
                  [{ userId: userObjectId, emotionType }],
                ],
              },
            },
          },
        ],
        { new: true }
      )
      .populate('senderId', 'firstName lastName _id avatar')
      // .populate('readBy', 'firstName lastName _id avatar')
      .populate({
        path: 'emotions.userId',
        select: 'firstName lastName _id avatar',
      })
      .populate([
        {
          path: 'replyTo',
          populate: [{ path: 'senderId', select: 'firstName lastName _id' }],
        },
        {
          path: 'postId',
          populate: { path: 'userId', select: 'firstName lastName _id avatar username' },
        },
        {
          path: 'postIdsRecommendationfromAI',
          populate: { path: 'userId', select: 'firstName lastName _id avatar username' },
        },
      ])
      .exec();
  }

  // 3. Xóa cảm xúc tin nhắn
  async removeReaction(messageId: string, userId: string) {
    if (!Types.ObjectId.isValid(messageId) || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid message or user identifier');
    }
    const message = await this.messageModel.findById(messageId).lean();
    if (!message) {
      throw new NotFoundException('Không tìm thấy tin nhắn');
    }

    await this.assertActiveConversationMember(message.conversationId.toString(), userId);

    return await this.messageModel
      .findByIdAndUpdate(
        messageId,
        { $pull: { emotions: { userId: new Types.ObjectId(userId) } } },
        { new: true }
      )
      .populate('senderId', 'firstName lastName _id avatar')
      // .populate('readBy', 'firstName lastName _id avatar')
      .populate({
        path: 'emotions.userId',
        select: 'firstName lastName _id avatar',
      })
      .populate([
        {
          path: 'replyTo',
          populate: [{ path: 'senderId', select: 'firstName lastName _id' }],
        },
        {
          path: 'postId',
          populate: { path: 'userId', select: 'firstName lastName _id avatar username' },
        },
        {
          path: 'postIdsRecommendationfromAI',
          populate: { path: 'userId', select: 'firstName lastName _id avatar username' },
        },
      ])
      .exec();
  }

  // 4. Xóa tin nhắn (soft delete) + xóa media trên Cloudinary
  async deleteMessage(messageId: string, userId: string) {
    if (!Types.ObjectId.isValid(messageId) || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid message or user identifier');
    }
    const message = await this.messageModel.findById(messageId).lean();
    if (!message) {
      throw new NotFoundException('Không tìm thấy tin nhắn');
    }

    // Kiểm tra người gửi
    if (message.senderId && message.senderId.toString() !== userId) {
      throw new ForbiddenException('Bạn chỉ có thể xóa tin nhắn của mình');
    }

    // Xóa media trên Cloudinary nếu có attachments
    if (message.attachments && message.attachments.length > 0) {
      const mediaToDelete = message.attachments
        .filter((attachment) => attachment.publicId)
        .map((attachment) => ({
          publicId: attachment.publicId,
          mediaType: attachment.mediaType as 'IMAGE' | 'VIDEO' | 'RAW',
        }));

      // Xóa media song song (không block response)
      this.cloudinaryService.deleteOwnedMedia(userId, mediaToDelete).catch((err) => {
        this.logger.error(`Failed to delete media from Cloudinary: ${err?.message || err}`);
      });
    }

    return await this.messageModel
      .findByIdAndUpdate(
        messageId,
        {
          $set: {
            isDeleted: true,
            deletedAt: new Date(),
            content: 'Tin nhắn đã bị xóa',
            attachments: [], // Clear attachments
          },
        },
        { new: true }
      )
      .populate('senderId', 'firstName lastName _id avatar')
      // .populate('readBy', 'firstName lastName _id avatar')
      .populate({
        path: 'emotions.userId',
        select: 'firstName lastName _id avatar',
      })
      .populate([
        {
          path: 'replyTo',
          populate: [{ path: 'senderId', select: 'firstName lastName _id' }],
        },
        {
          path: 'postId',
          populate: { path: 'userId', select: 'firstName lastName _id avatar username' },
        },
        {
          path: 'postIdsRecommendationfromAI',
          populate: { path: 'userId', select: 'firstName lastName _id avatar username' },
        },
      ])
      .exec();
  }

  // 5. Parse mentions từ content (@userId hoặc @all)
  parseMentions(
    content: string,
    participants: string[]
  ): { mentions: string[]; hasMentionAll: boolean } {
    const mentionRegex = /@([a-fA-F0-9]{24}|all)/g;
    const matches: string[] = content.match(mentionRegex) || [];

    const mentions: string[] = [];
    let hasMentionAll = false;

    for (const match of matches) {
      const id = match.substring(1); // Remove @
      if (id === 'all') {
        hasMentionAll = true;
      } else if (participants.includes(id)) {
        mentions.push(id);
      }
    }

    return { mentions, hasMentionAll };
  }

  // 6. Mark message as read - NEW LOGIC using ConversationReadStatus
  // Optional messageId parameter: if provided, use it as cursor; otherwise use latest message
  async markAsRead(
    conversationId: string,
    userId: string,
    messageId?: string
  ): Promise<MarkAsReadResult> {
    // Validate IDs
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new BadRequestException('Invalid conversationId');
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid userId');
    }
    await this.assertActiveConversationMember(conversationId, userId);

    const userObjectId = new Types.ObjectId(userId);
    const convObjectId = new Types.ObjectId(conversationId);

    let targetMessage: { _id: Types.ObjectId; createdAt: Date } | null = null;

    if (messageId && Types.ObjectId.isValid(messageId)) {
      targetMessage = await this.messageModel
        .findOne({
          _id: new Types.ObjectId(messageId),
          conversationId: convObjectId,
          isDeleted: { $ne: true },
        })
        .select('_id createdAt')
        .lean<{ _id: Types.ObjectId; createdAt: Date }>();
    }

    // STRICT MODE: If no specific message ID provided or found, DO NOT Mark All As Read.
    // This prevents the cursor from jumping to the end when opening the chat or switching tabs.
    // The frontend must explicitly send the message ID it wants to mark as read.
    if (!targetMessage) {
      return { modifiedCount: 0 };
    }

    // Lazily backfill the sortable cursor for records created before this field existed.
    const legacyStatus = await this.readStatusModel
      .findOne({
        conversationId: convObjectId,
        userId: userObjectId,
        lastReadMessageId: { $ne: null },
        lastReadMessageCreatedAt: { $exists: false },
      })
      .select('_id lastReadMessageId')
      .lean();
    if (legacyStatus?.lastReadMessageId) {
      const legacyMessage = await this.messageModel
        .findById(legacyStatus.lastReadMessageId)
        .select('createdAt')
        .lean<{ createdAt: Date }>();
      if (legacyMessage?.createdAt) {
        await this.readStatusModel.updateOne(
          { _id: legacyStatus._id, lastReadMessageCreatedAt: { $exists: false } },
          { $set: { lastReadMessageCreatedAt: legacyMessage.createdAt } }
        );
      }
    }

    const now = new Date();
    const advanceFilter = {
      conversationId: convObjectId,
      userId: userObjectId,
      $or: [
        { lastReadMessageCreatedAt: { $exists: false } },
        { lastReadMessageCreatedAt: { $lte: targetMessage.createdAt } },
      ],
    };
    const advanceUpdate = {
      $set: {
        lastReadMessageId: targetMessage._id,
        lastReadMessageCreatedAt: targetMessage.createdAt,
        lastReadAt: now,
      },
    };

    let advanced = Boolean(
      await this.readStatusModel
        .findOneAndUpdate(advanceFilter, advanceUpdate, { new: true })
        .select('_id')
        .lean()
    );

    if (!advanced) {
      try {
        await this.readStatusModel.create({
          conversationId: convObjectId,
          userId: userObjectId,
          lastReadMessageId: targetMessage._id,
          lastReadMessageCreatedAt: targetMessage.createdAt,
          lastReadAt: now,
        });
        advanced = true;
      } catch (error: unknown) {
        if ((error as { code?: number }).code !== 11000) {
          throw error;
        }
        advanced = Boolean(
          await this.readStatusModel
            .findOneAndUpdate(advanceFilter, advanceUpdate, { new: true })
            .select('_id')
            .lean()
        );
      }
    }

    if (!advanced) {
      return { modifiedCount: 0 };
    }

    const result = await this.readStatusModel
      .findOne({ conversationId: convObjectId, userId: userObjectId })
      .populate('userId', 'firstName lastName _id avatar')
      .populate('lastReadMessageId', 'createdAt')
      .lean();

    // Serialize check
    if (!result) return { modifiedCount: 0 };

    // Normalize readStatus to ensure consistent format (same as findAllMessagesByConversationId)
    const normalizedReadStatus = {
      ...result,
      _id: result._id.toString(),
      conversationId: result.conversationId.toString(),
      userId: result.userId
        ? {
            ...(result.userId as any),
            _id: (result.userId as any)._id?.toString() || (result.userId as any).toString(),
          }
        : null,
      lastReadMessageId: result.lastReadMessageId
        ? {
            ...(result.lastReadMessageId as any),
            _id: (result.lastReadMessageId as any)._id?.toString(),
          }
        : null,
    };

    return {
      modifiedCount: 1,
      conversationId,
      readBy: userId,
      lastReadMessageId: targetMessage._id,
      readStatus: normalizedReadStatus,
    };
  }

  // 7. Update message status to delivered when user connects
  async markAsDelivered(conversationId: string, userId: string) {
    await this.assertActiveConversationMember(conversationId, userId);
    const userObjectId = new Types.ObjectId(userId);

    await this.messageModel.updateMany(
      {
        conversationId: new Types.ObjectId(conversationId),
        senderId: { $ne: userObjectId },
        status: 'SENT',
        isDeleted: { $ne: true },
      },
      {
        $set: { status: 'DELIVERED' },
      }
    );
  }

  // Get latest read status for conversation (who read what)
  async getReadStatus(
    conversationId: string,
    userId: string
  ): Promise<Array<Record<string, unknown>>> {
    await this.assertActiveConversationMember(conversationId, userId);
    // Return list of ReadStatus for all users in this conversation
    const readStatuses = await this.readStatusModel
      .find({
        conversationId: new Types.ObjectId(conversationId),
      })
      .populate('userId', 'firstName lastName _id avatar')
      .populate('lastReadMessageId', 'createdAt') // Populate message to get createdAt for comparison
      .lean();

    // Normalize readStatuses to ensure consistent format (same as findAllMessagesByConversationId)
    const normalizedReadStatuses = readStatuses
      .filter((status) => status.lastReadMessageId)
      .map((status) => ({
        ...status,
        _id: status._id.toString(),
        conversationId: status.conversationId.toString(),
        userId: status.userId
          ? {
              ...(status.userId as any),
              _id: (status.userId as any)._id?.toString() || (status.userId as any).toString(),
            }
          : null,
        lastReadMessageId: status.lastReadMessageId
          ? {
              ...(status.lastReadMessageId as any),
              _id: (status.lastReadMessageId as any)._id?.toString(),
            }
          : null,
      }));

    return normalizedReadStatuses;
  }

}
