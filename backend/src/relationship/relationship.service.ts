import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateRelationshipDto } from './dto/create-relationship.dto';
import { UpdateRelationshipDto } from './dto/update-relationship.dto';
import {
  Relationship,
  RelationshipDocument,
  RelationshipStatus,
} from 'src/relationship/entities/relationship.entity';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Conversation, ConversationDocument } from 'src/conversation/entities/conversation.entity';
import { Account, AccountDocument } from 'src/account/entities/account.entity';

@Injectable()
export class RelationshipService {
  constructor(
    @InjectModel(Relationship.name) private readonly relationshipModel: Model<RelationshipDocument>,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>
  ) {}

  // Tạo lời mời kết bạn
  async addFriend(createRelationshipDto: CreateRelationshipDto) {
    const isExistingRelationship = await this.relationshipModel.findOne({
      $or: [
        {
          $and: [
            { userId: createRelationshipDto.userId },
            { friendId: createRelationshipDto.friendId },
          ],
        },
        {
          $and: [
            { userId: createRelationshipDto.friendId },
            { friendId: createRelationshipDto.userId },
          ],
        },
      ],
    });

    if (isExistingRelationship) {
      if (isExistingRelationship.status === RelationshipStatus.PENDING)
        throw new ConflictException('Đã gửi lời mời kết bạn cho đối tượng này rồi');
      else {
        console.log('Chạy vô đây nè');
        return await this.relationshipModel
          .findByIdAndUpdate(isExistingRelationship._id, {
            status: RelationshipStatus.PENDING,
            sendRequestAt: new Date(),
          })
          .exec();
      }
    }

    createRelationshipDto.sendRequestAt = new Date();

    const relationship = new this.relationshipModel(createRelationshipDto);
    return await relationship.save();
  }

  // Chấp nhận lời mời kết bạn
  async acceptFriend(userId: string, friendId: string) {
    const relationship = await this.relationshipModel
      .findOne({
        $or: [
          { $and: [{ userId: userId }, { friendId: friendId }] },
          { $and: [{ userId: friendId }, { friendId: userId }] },
        ],
      })
      .exec();

    if (!relationship) {
      throw new NotFoundException('Không tìm thấy mối quan hệ kết bạn');
    }

    await this.relationshipModel.updateOne(
      { _id: relationship._id },
      { status: RelationshipStatus.ACCEPTED }
    );

    const dataConverstation = {
      type: 'DIRECT',
      participants: [
        {
          user: relationship.userId,
          nickname: '',
          joinedAt: new Date(),
          isAdmin: false,
        },
        {
          user: relationship.friendId,
          nickname: '',
          joinedAt: new Date(),
          isAdmin: false,
        },
      ],
    };

    const conversation = new this.conversationModel(dataConverstation);

    return await conversation.save();
  }

  // Dùng để cập nhật trạng thái kết bạn như REJECTED: quy chung là hủy kết bạn hoặc từ chối kết bạn, BLOCKED, CANCELED
  async updateStatusRelationship(userId: string, friendId: string, status: string) {
    return await this.relationshipModel
      .updateOne(
        {
          $or: [
            { $and: [{ userId: userId }, { friendId: friendId }] },
            { $and: [{ userId: friendId }, { friendId: userId }] },
          ],
        },
        { status: status }
      )
      .exec();
  }

  // Lấy danh sách mà người dùng gửi lời mời kết bạn
  async getSentFriendRequests(userId: string): Promise<any> {
    const friends = await this.relationshipModel
      .find({ userId: userId, status: RelationshipStatus.PENDING })
      .populate('friendId', '-password -email -createdAt -updatedAt -__v')
      .lean()
      .exec();
    // Loại bỏ _doc ??

    return friends.map((rel) => ({ ...rel.friendId, time: rel.sendRequestAt }));
  }

  // Lấy danh sách mà người dùng nhận được lời mời kết bạn
  async getReceivedFriendRequests(userId: string): Promise<any> {
    const users = await this.relationshipModel
      .find({ friendId: userId, status: RelationshipStatus.PENDING })
      .populate('userId', '-password -email -createdAt -updatedAt -__v')
      .lean()
      .exec();
    return users.map((rel) => ({ ...rel.userId, time: rel.sendRequestAt }));
  }

  // Lấy danh sách bạn bè hiện tại của người dùng
  async getFriendsList(userId: string) {
    const relationships = await this.relationshipModel
      .find({
        $or: [
          { userId: userId, status: RelationshipStatus.ACCEPTED },
          { friendId: userId, status: RelationshipStatus.ACCEPTED },
        ],
      })
      .populate('userId friendId', '-password -email -createdAt -updatedAt -__v')
      .lean()
      .exec();

    // Lọc trùng để chỉ trả về bạn bè
    return relationships.map((rel: any) =>
      rel.userId._id.toString() === userId
        ? { ...rel.friendId, time: rel.sendRequestAt }
        : { ...rel.userId, time: rel.sendRequestAt }
    );
  }
}
