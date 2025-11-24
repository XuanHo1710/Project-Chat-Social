import { Injectable } from '@nestjs/common';
import { CreateRelationshipDto } from './dto/create-relationship.dto';
import { UpdateRelationshipDto } from './dto/update-relationship.dto';
import { Relationship, RelationshipDocument } from 'src/relationship/entities/relationship.entity';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class RelationshipService {
  constructor(@InjectModel(Relationship.name) private readonly relationshipModel: Model<RelationshipDocument>) { }

  async create(createRelationshipDto: CreateRelationshipDto) {
    const relationship = new this.relationshipModel(createRelationshipDto);
    return relationship.save();
  }

  async findAll() {
    return await this.relationshipModel.find().exec();
  }

  findOne(id: number) {
    return `This action returns a #${id} relationship`;
  }

  update(id: number, updateRelationshipDto: UpdateRelationshipDto) {
    return `This action updates a #${id} relationship`;
  }

  remove(id: number) {
    return `This action removes a #${id} relationship`;
  }
}
