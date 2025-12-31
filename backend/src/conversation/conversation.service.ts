import { Injectable } from '@nestjs/common';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { Model } from 'mongoose';
import { Conversation, ConversationDocument } from 'src/conversation/entities/conversation.entity';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class ConversationService {
  constructor(@InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>) { }

  async create(createConversationDto: CreateConversationDto) {
    const converstation = await this.conversationModel.create(createConversationDto);
    return await converstation.save();
  }

  async findAll() {
    return await this.conversationModel.find().exec();
  }

  async findConversationByUserId(userId: string) {
    const conversation = await this.conversationModel.find({
      "participants.user": userId
    })
      .populate('participants.user', 'firstName lastName username avatar status lastActive')
      .populate('lastMessage', 'content type createdAt')
      .exec();
    return conversation;
  }


  async updateLastMessage(id: string, lastMessage: string) {
    return await this.conversationModel.updateOne({ _id: id }, { $set: { lastMessage: lastMessage, lastMessageAt: new Date() } }).exec();
  }

  async update(id: string, updateConversationDto: UpdateConversationDto) {
    return await this.conversationModel.findByIdAndUpdate(id, updateConversationDto).exec();
  }

  async remove(id: string) {
    return await this.conversationModel.findByIdAndDelete(id).exec();
  }
}
