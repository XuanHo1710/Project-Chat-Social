import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Conversation, ConversationDocument } from 'src/conversation/entities/conversation.entity';
import { Model, Types } from 'mongoose';
import { Message, EmotionType } from 'src/chat/entities/message.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>
  ) { }

  async sendMessage(createMessageDto: CreateMessageDto) {
    const message = await this.messageModel.create(createMessageDto);
    return await this.messageModel.findById(message._id)
      .populate({ path: 'replyTo', populate: { path: 'senderId', select: 'firstName lastName' } })
      .exec();
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
        .populate({ path: 'replyTo', populate: { path: 'senderId', select: 'firstName lastName' } })
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

    return await this.messageModel.findByIdAndUpdate(
      messageId,
      {
        $set: {
          content: newContent,
          isEdited: true
        }
      },
      { new: true }
    ).populate({ path: 'replyTo', populate: { path: 'senderId', select: 'firstName lastName' } }).exec();
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
    return await this.messageModel.findByIdAndUpdate(
      messageId,
      {
        $push: {
          emotions: {
            userId: userObjectId,
            emotionType
          }
        }
      },
      { new: true }
    ).populate({ path: 'replyTo', populate: { path: 'senderId', select: 'firstName lastName' } }).exec();
  }

  // 3. Xóa cảm xúc tin nhắn
  async removeReaction(messageId: string, userId: string) {
    const message = await this.messageModel.findById(messageId);
    if (!message) {
      throw new NotFoundException('Không tìm thấy tin nhắn');
    }

    return await this.messageModel.findByIdAndUpdate(
      messageId,
      { $pull: { emotions: { userId: new Types.ObjectId(userId) } } },
      { new: true }
    ).populate({ path: 'replyTo', populate: { path: 'senderId', select: 'firstName lastName' } }).exec();
  }

  // 4. Xóa tin nhắn (soft delete)
  async deleteMessage(messageId: string, userId: string) {
    const message = await this.messageModel.findById(messageId);
    if (!message) {
      throw new NotFoundException('Không tìm thấy tin nhắn');
    }

    // Kiểm tra người gửi
    if (message.senderId.toString() !== userId) {
      throw new ForbiddenException('Bạn chỉ có thể xóa tin nhắn của mình');
    }

    return await this.messageModel.findByIdAndUpdate(
      messageId,
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          content: 'Tin nhắn đã bị xóa'
        }
      },
      { new: true }
    ).populate({ path: 'replyTo', populate: { path: 'senderId', select: 'firstName lastName' } }).exec();
  }

  // 5. Parse mentions từ content (@userId hoặc @all)
  parseMentions(content: string, participants: string[]): { mentions: string[], hasMentionAll: boolean } {
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

  // Legacy methods
  update(id: number, updateMessageDto: UpdateMessageDto) {
    return `This action updates a #${id} chat`;
  }

  remove(id: number) {
    return `This action removes a #${id} chat`;
  }
}
