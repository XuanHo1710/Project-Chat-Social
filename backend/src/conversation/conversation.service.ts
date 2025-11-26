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
    }).populate('participants.user', '-password').exec();
    return conversation;
  }

  async update(id: string, updateConversationDto: UpdateConversationDto) {
    return await this.conversationModel.findByIdAndUpdate(id, updateConversationDto, { new: true }).exec();
  }

  async remove(id: string) {
    return await this.conversationModel.findByIdAndDelete(id).exec();
  }
}
