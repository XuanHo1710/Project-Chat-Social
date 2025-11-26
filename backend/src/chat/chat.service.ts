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
  ) { }


  async sendMessage(createMessageDto: CreateMessageDto) {
    const message = await this.messageModel.create(createMessageDto);
    return message.save();
  }

  findAll() {
    return `This action returns all chat`;
  }

  async findAllMessagesByConversationId(conversationId: string) {
    return await this.messageModel.find({ conversationId: conversationId }).sort({ createdAt: 1 }).exec();
  }

  update(id: number, updateMessageDto: UpdateMessageDto) {
    return `This action updates a #${id} chat`;
  }

  remove(id: number) {
    return `This action removes a #${id} chat`;
  }
}
