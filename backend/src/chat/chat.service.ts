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
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    private readonly cloudinaryService: CloudinaryService
  ) {}

  async sendMessage(createMessageDto: CreateMessageDto) {
    const message = await this.messageModel.create(createMessageDto);
    return await this.messageModel
      .findById(message._id)
      .populate('senderId', 'firstName lastName _id avatar')
      .populate({
        path: 'replyTo',
        populate: { path: 'senderId', select: 'firstName lastName _id' },
      })
      .populate({
        path: 'postId',
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

  findAll() {
    return `This action returns all chat`;
  }

  async findAllMessagesByConversationId(
    conversationId: string,
    page: number = 1,
    limit: number = 15,
    before?: string // cursor: load messages before this messageId
  ) {
    const query: any = { conversationId, isDeleted: { $ne: true } };

    // If cursor provided, get messages before that message
    if (before) {
      const cursorMessage = await this.messageModel.findById(before);
      if (cursorMessage) {
        query.createdAt = { $lt: cursorMessage.createdAt };
      }
    }

    const [messages, total] = await Promise.all([
      this.messageModel
        .find(query)
        .sort({ createdAt: -1 }) // Newest first for pagination
        .limit(limit)
        .populate('senderId', 'firstName lastName _id avatar')
        .populate([
          {
            path: 'replyTo',
            populate: [{ path: 'senderId', select: 'firstName lastName _id' }],
          },
          {
            path: 'postId',
            populate: { path: 'userId', select: 'firstName lastName _id avatar username' },
          },
        ])
        .lean(),
      this.messageModel.countDocuments({ conversationId, isDeleted: { $ne: true } }),
    ]);

    // Reverse to show oldest first in UI
    const sortedMessages = messages.reverse();

    return {
      data: sortedMessages,
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
    if (message.senderId.toString() !== userId) {
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
      .populate({ path: 'replyTo', populate: { path: 'senderId', select: 'firstName lastName' } })
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
      .populate({ path: 'replyTo', populate: { path: 'senderId', select: 'firstName lastName' } })
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
      .populate({ path: 'replyTo', populate: { path: 'senderId', select: 'firstName lastName' } })
      .exec();
  }

  // 4. Xóa tin nhắn (soft delete) + xóa media trên Cloudinary
  async deleteMessage(messageId: string, userId: string) {
    const message = await this.messageModel.findById(messageId);
    if (!message) {
      throw new NotFoundException('Không tìm thấy tin nhắn');
    }

    // Kiểm tra người gửi
    if (message.senderId.toString() !== userId) {
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
      .populate({ path: 'replyTo', populate: { path: 'senderId', select: 'firstName lastName' } })
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

  // 6. Mark message as read
  async markAsRead(conversationId: string, userId: string) {
    const userObjectId = new Types.ObjectId(userId);

    // Update all unread messages in this conversation (not sent by this user)
    const result = await this.messageModel.updateMany(
      {
        conversationId: new Types.ObjectId(conversationId),
        senderId: { $ne: userObjectId },
        readBy: { $ne: userObjectId },
        isDeleted: { $ne: true },
      },
      {
        $addToSet: { readBy: userObjectId },
        $set: { status: 'READ' },
      }
    );

    return {
      modifiedCount: result.modifiedCount,
      conversationId,
      readBy: userId,
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
    // Get the last message read by each participant
    const lastMessage = await this.messageModel
      .findOne({ conversationId, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .select('_id status readBy senderId')
      .lean();

    return lastMessage;
  }

  // Legacy methods
  async update(id: string, updateMessageDto: UpdateMessageDto) {
    return await this.messageModel.updateOne({ _id: id }, updateMessageDto).exec();
  }

  remove(id: number) {
    return `This action removes a #${id} chat`;
  }
}
