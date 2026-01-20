import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Conversation, ConversationDocument } from 'src/conversation/entities/conversation.entity';
import { Model, Types } from 'mongoose';
import { Message, EmotionType, MessageType } from 'src/chat/entities/message.entity';
import {
  ConversationReadStatus,
  ConversationReadStatusDocument,
} from './entities/conversation-read-status.entity';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    @InjectModel(ConversationReadStatus.name)
    private readonly readStatusModel: Model<ConversationReadStatusDocument>,
    private readonly cloudinaryService: CloudinaryService
  ) { }

  async sendMessage(createMessageDto: CreateMessageDto) {
    const message = await this.messageModel.create(createMessageDto);
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
      const conversation = await this.conversationModel.findById(data.conversationId);
      if (conversation && conversation.participants.length > 0) {
        messageData.senderId = conversation.participants[0].user;
      }
    } else {
      messageData.senderId = new Types.ObjectId(data.senderId);
    }

    const message = await this.messageModel.create(messageData);
    return message;
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
  ) {
    // Get conversation to check user's kicked/left status
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
    }

    // Find user's participant record
    const participant = conversation.participants.find((p) => p.user.toString() === userId);

    const query: any = {
      $or: [
        { conversationId: conversationId },
        { conversationId: new Types.ObjectId(conversationId) },
      ],
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
    if (before) {
      const cursorMessage = await this.messageModel.findById(before);
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
  async findMediaMessages(conversationId: string, page: number = 1, limit: number = 20) {
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
  async findFileMessages(conversationId: string, page: number = 1, limit: number = 20) {
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

  async findOne(id: string) {
    return await this.messageModel.findById(id).exec();
  }

  // ============ MESSAGE FEATURES ============

  // 1. Chỉnh sửa tin nhắn (giới hạn 15 phút)
  async editMessage(messageId: string, userId: string, newContent: string) {
    const message = await this.messageModel.findById(messageId);
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

    return await this.messageModel
      .findByIdAndUpdate(
        messageId,
        {
          $set: {
            content: newContent,
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
    const message = await this.messageModel.findById(messageId);
    if (!message) {
      throw new NotFoundException('Không tìm thấy tin nhắn');
    }

    if (message.isDeleted) {
      throw new BadRequestException('Tin nhắn đã bị xóa');
    }

    // Update or add reaction in the array
    const userObjectId = new Types.ObjectId(userId);

    // First remove any existing reaction from this user to ensure uniqueness per user
    await this.messageModel.updateOne(
      { _id: messageId },
      { $pull: { emotions: { userId: userObjectId } } }
    );

    // Then add the new reaction
    return await this.messageModel
      .findByIdAndUpdate(
        messageId,
        {
          $push: {
            emotions: {
              userId: userObjectId,
              emotionType,
            },
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

  // 3. Xóa cảm xúc tin nhắn
  async removeReaction(messageId: string, userId: string) {
    const message = await this.messageModel.findById(messageId);
    if (!message) {
      throw new NotFoundException('Không tìm thấy tin nhắn');
    }

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
    const message = await this.messageModel.findById(messageId);
    if (!message) {
      throw new NotFoundException('Không tìm thấy tin nhắn');
    }

    // Kiểm tra người gửi
    if (message.senderId && message.senderId.toString() !== userId) {
      throw new ForbiddenException('Bạn chỉ có thể xóa tin nhắn của mình');
    }

    // Xóa media trên Cloudinary nếu có attachments
    if (message.attachments && message.attachments.length > 0) {
      const mediaToDelete = message.attachments.map((attachment) => {
        // Extract publicId from URL: chat_attachments/xxxxx
        const urlParts = attachment.url.split('/');
        const fileNameWithExt = urlParts[urlParts.length - 1];
        const folderName = urlParts[urlParts.length - 2];
        const publicId = `${folderName}/${fileNameWithExt.split('.')[0]}`;

        return {
          publicId,
          mediaType: attachment.mediaType as 'IMAGE' | 'VIDEO' | 'RAW',
        };
      });

      // Xóa media song song (không block response)
      this.cloudinaryService.deleteMultipleMedia(mediaToDelete).catch((err) => {
        console.error('Failed to delete media from Cloudinary:', err);
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
  async markAsRead(conversationId: string, userId: string, messageId?: string) {
    // Validate IDs
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new BadRequestException('Invalid conversationId');
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid userId');
    }

    const userObjectId = new Types.ObjectId(userId);
    const convObjectId = new Types.ObjectId(conversationId);

    let targetMessageId: Types.ObjectId;
    let foundMessage = false;

    if (messageId && Types.ObjectId.isValid(messageId)) {
      // Use provided messageId as cursor
      const messageExists = await this.messageModel.findOne({
        _id: new Types.ObjectId(messageId),
        isDeleted: { $ne: true },
      });

      if (messageExists && messageExists.conversationId.toString() === conversationId) {
        targetMessageId = messageExists._id;
        foundMessage = true;
      }
    }

    // STRICT MODE: If no specific message ID provided or found, DO NOT Mark All As Read.
    // This prevents the cursor from jumping to the end when opening the chat or switching tabs.
    // The frontend must explicitly send the message ID it wants to mark as read.
    if (!foundMessage) {
      console.warn('[Service] markAsRead skipped: No valid messageId provided or found.');
      return { modifiedCount: 0 };
    }

    // 2. Upsert ConversationReadStatus for this user
    const result = await this.readStatusModel
      .findOneAndUpdate(
        { conversationId: convObjectId, userId: userObjectId },
        {
          $set: {
            lastReadMessageId: targetMessageId!, // Assert non-null because we checked foundMessage
            lastReadAt: new Date(),
          },
        },
        { upsert: true, new: true }
      )
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
      lastReadMessageId: targetMessageId!,
      readStatus: normalizedReadStatus,
    };
  }

  // 7. Update message status to delivered when user connects
  async markAsDelivered(conversationId: string, userId: string) {
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
  async getReadStatus(conversationId: string) {
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

  // Legacy methods
  async update(id: string, updateMessageDto: UpdateMessageDto) {
    return await this.messageModel.updateOne({ _id: id }, updateMessageDto).exec();
  }

  remove(id: number) {
    return `This action removes a #${id} chat`;
  }
}
