import { Injectable } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Conversation, ConversationDocument } from 'src/conversation/entities/conversation.entity';
import { Model } from 'mongoose';
import { Message } from 'src/chat/entities/message.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>
  ) {}

  async sendMessage(createMessageDto: CreateMessageDto) {
    const message = await this.messageModel.create(createMessageDto);
    return message.save();
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
    const query: any = { conversationId };

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
        .lean(),
      this.messageModel.countDocuments({ conversationId }),
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

  update(id: number, updateMessageDto: UpdateMessageDto) {
    return `This action updates a #${id} chat`;
  }

  remove(id: number) {
    return `This action removes a #${id} chat`;
  }
}
