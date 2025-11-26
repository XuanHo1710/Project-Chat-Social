import { Injectable } from '@nestjs/common';
import { CreateRelationshipDto } from './dto/create-relationship.dto';
import { UpdateRelationshipDto } from './dto/update-relationship.dto';
import { Relationship, RelationshipDocument } from 'src/relationship/entities/relationship.entity';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Conversation, ConversationDocument } from 'src/conversation/entities/conversation.entity';
import { Account, AccountDocument } from 'src/account/entities/account.entity';

@Injectable()
export class RelationshipService {
  constructor(
    @InjectModel(Relationship.name) private readonly relationshipModel: Model<RelationshipDocument>,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>,
  ) { }

  async create(createRelationshipDto: CreateRelationshipDto) {
    const relationship = new this.relationshipModel(createRelationshipDto);
    await relationship.save();

    const dataConverstation = {
      type: 'DIRECT',
      participants: [{
        user: createRelationshipDto.userId,
        nickname: "",
        joinedAt: new Date(),
        isAdmin: false,
      },
      {
        user: createRelationshipDto.friendId,
        nickname: "",
        joinedAt: new Date(),
        isAdmin: false
      }]
    }

    const conversation = new this.conversationModel(dataConverstation);

    return await conversation.save();
  }

  async findAll() {
    return await this.relationshipModel.find().exec();
  }

  async findOne(id: string) {
    return await this.relationshipModel.findById(id).exec();
  }

  async update(id: string, updateRelationshipDto: UpdateRelationshipDto) {
    return await this.relationshipModel.findByIdAndUpdate(id, updateRelationshipDto, { new: true }).exec();
  }

  async remove(id: string) {
    return await this.relationshipModel.findByIdAndDelete(id).exec();
  }
}
