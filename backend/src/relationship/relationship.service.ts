import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateRelationshipDto } from './dto/create-relationship.dto';
import { UpdateRelationshipDto } from './dto/update-relationship.dto';
import {
  Relationship,
  RelationshipDocument,
  RelationshipStatus,
} from 'src/relationship/entities/relationship.entity';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Conversation, ConversationDocument } from 'src/conversation/entities/conversation.entity';
import { NotificationEmitterService } from 'src/notification/notification-emitter.service';
import { Account, AccountDocument } from 'src/account/entities/account.entity';

@Injectable()
export class RelationshipService {
  constructor(
    @InjectModel(Relationship.name) private readonly relationshipModel: Model<RelationshipDocument>,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Account.name) private readonly accountModel: Model<AccountDocument>,
    private readonly notificationEmitter: NotificationEmitterService
  ) {}

  private async getAcceptedFriendIds(userId: string): Promise<Types.ObjectId[]> {
    const me = new Types.ObjectId(userId);
    const relationships = await this.relationshipModel
      .find(
        {
          status: RelationshipStatus.ACCEPTED,
          $or: [{ userId: me }, { friendId: me }],
        },
        { userId: 1, friendId: 1 }
      )
      .lean();

    return relationships.map((rel) =>
      rel.userId.toString() === me.toString()
        ? new Types.ObjectId(rel.friendId.toString())
        : new Types.ObjectId(rel.userId.toString())
    );
  }

  private async getMutualFriendsMap(
    userId: string,
    candidateIdsInput: Array<string | Types.ObjectId>
  ): Promise<
    Map<
      string,
      {
        count: number;
        mutualFriendPreview: {
          _id: string;
          firstName: string;
          lastName: string;
          avatar?: string;
          username?: string;
        }[];
      }
    >
  > {
    const me = new Types.ObjectId(userId);
    const candidateIds = Array.from(
      new Set(candidateIdsInput.map((id) => id.toString()).filter((id) => id !== me.toString()))
    ).map((id) => new Types.ObjectId(id));

    const mutualFriendsMap = new Map<
      string,
      {
        count: number;
        mutualFriendPreview: {
          _id: string;
          firstName: string;
          lastName: string;
          avatar?: string;
          username?: string;
        }[];
      }
    >();
    if (candidateIds.length === 0) return mutualFriendsMap;

    const myFriendIds = await this.getAcceptedFriendIds(userId);
    if (myFriendIds.length === 0) return mutualFriendsMap;

    const mutualRows = await this.relationshipModel.aggregate<{
      _id: Types.ObjectId;
      count: number;
      mutualFriendIds: Types.ObjectId[];
    }>([
      {
        $match: {
          status: RelationshipStatus.ACCEPTED,
          $or: [
            {
              userId: { $in: candidateIds },
              friendId: { $in: myFriendIds },
            },
            {
              friendId: { $in: candidateIds },
              userId: { $in: myFriendIds },
            },
          ],
        },
      },
      {
        $project: {
          candidateId: {
            $cond: [{ $in: ['$userId', candidateIds] }, '$userId', '$friendId'],
          },
          mutualFriendId: {
            $cond: [{ $in: ['$userId', candidateIds] }, '$friendId', '$userId'],
          },
        },
      },
      {
        $group: {
          _id: '$candidateId',
          count: { $sum: 1 },
          mutualFriendIds: { $addToSet: '$mutualFriendId' },
        },
      },
    ]);

    const previewMutualIds = Array.from(
      new Set(mutualRows.flatMap((row) => row.mutualFriendIds || []).map((id) => id.toString()))
    ).map((id) => new Types.ObjectId(id));

    const previewUsers = previewMutualIds.length
      ? await this.accountModel
          .find({ _id: { $in: previewMutualIds } })
          .select('_id firstName lastName avatar username')
          .lean()
      : [];

    const previewUsersById = new Map(
      previewUsers.map((u) => [
        u._id.toString(),
        {
          _id: u._id.toString(),
          firstName: u.firstName,
          lastName: u.lastName,
          avatar: u.avatar,
          username: u.username,
        },
      ])
    );

    mutualRows.forEach((row) => {
      const preview = (row.mutualFriendIds || [])
        .map((id) => previewUsersById.get(id.toString()))
        .filter(Boolean)
        .slice(0, 3) as {
        _id: string;
        firstName: string;
        lastName: string;
        avatar?: string;
        username?: string;
      }[];

      mutualFriendsMap.set(row._id.toString(), {
        count: row.count,
        mutualFriendPreview: preview,
      });
    });

    return mutualFriendsMap;
  }

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
        return await this.relationshipModel
          .findByIdAndUpdate(isExistingRelationship._id, {
            status: RelationshipStatus.PENDING,
            sendRequestAt: new Date(),
            userId: createRelationshipDto.userId,
            friendId: createRelationshipDto.friendId,
          })
          .exec();
      }
    }

    createRelationshipDto.sendRequestAt = new Date();

    const relationship = new this.relationshipModel(createRelationshipDto);
    await relationship.save();

    // Send notification to friend via RabbitMQ
    const user = await this.accountModel.findById(createRelationshipDto.userId);
    if (user) {
      await this.notificationEmitter.emitFriendRequest(
        createRelationshipDto.friendId.toString(),
        createRelationshipDto.userId.toString(),
        `${user.firstName} ${user.lastName} đã gửi lời mời kết bạn`
      );
    }

    return relationship;
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

    const converstationExists = await this.conversationModel.findOne({
      type: 'DIRECT',
      participants: {
        $all: [{ $elemMatch: { user: userId } }, { $elemMatch: { user: friendId } }],
      },
    });

    if (converstationExists) {
      return converstationExists;
    }

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

    // Send notification to requester via RabbitMQ
    const acceptor = await this.accountModel.findById(friendId);
    if (acceptor) {
      await this.notificationEmitter.emitFriendAccepted(
        userId, // Requester
        friendId, // Accepter
        `${acceptor.firstName} ${acceptor.lastName} đã chấp nhận lời mời kết bạn`
      );
    }

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

    const mappedFriends = friends.map((rel) => ({ ...rel.friendId, time: rel.sendRequestAt }));
    const mutualFriendsMap = await this.getMutualFriendsMap(
      userId,
      mappedFriends.map((friend: any) => friend._id)
    );

    return mappedFriends.map((friend: any) => ({
      ...friend,
      mutualFriends: mutualFriendsMap.get(friend._id.toString())?.count ?? 0,
      mutualFriendPreview: mutualFriendsMap.get(friend._id.toString())?.mutualFriendPreview ?? [],
    }));
  }

  // Lấy danh sách mà người dùng nhận được lời mời kết bạn
  async getReceivedFriendRequests(userId: string): Promise<any> {
    const users = await this.relationshipModel
      .find({ friendId: userId, status: RelationshipStatus.PENDING })
      .populate('userId', '-password -email -createdAt -updatedAt -__v')
      .lean()
      .exec();

    const mappedUsers = users.map((rel) => ({ ...rel.userId, time: rel.sendRequestAt }));
    const mutualFriendsMap = await this.getMutualFriendsMap(
      userId,
      mappedUsers.map((friend: any) => friend._id)
    );

    return mappedUsers.map((friend: any) => ({
      ...friend,
      mutualFriends: mutualFriendsMap.get(friend._id.toString())?.count ?? 0,
      mutualFriendPreview: mutualFriendsMap.get(friend._id.toString())?.mutualFriendPreview ?? [],
    }));
  }

  // Lấy danh sách bạn bè hiện tại của người dùng
  async getFriendsList(userId: string, mutualBaseUserId?: string) {
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

    const mappedFriends = relationships.map((rel: any) => {
      const friend =
        rel.userId._id.toString() === userId
          ? { ...rel.friendId, time: rel.sendRequestAt }
          : { ...rel.userId, time: rel.sendRequestAt };

      // If user has hidden activity status, mask their status info
      if (friend.showActivityStatus === false) {
        return {
          ...friend,
          status: 'HIDDEN',
          lastActive: null,
        };
      }

      return friend;
    });

    const mutualSourceUserId = mutualBaseUserId || userId;
    const mutualFriendsMap = await this.getMutualFriendsMap(
      mutualSourceUserId,
      mappedFriends.map((friend: any) => friend._id)
    );

    return mappedFriends.map((friend: any) => ({
      ...friend,
      mutualFriends: mutualFriendsMap.get(friend._id.toString())?.count ?? 0,
      mutualFriendPreview: mutualFriendsMap.get(friend._id.toString())?.mutualFriendPreview ?? [],
    }));
  }

  // Kiểm tra xem 2 người dùng có phải là bạn bè không
  async checkFriendship(
    userId: string,
    targetUserId: string
  ): Promise<{ isFriend: boolean; status: string | null }> {
    const relationship = await this.relationshipModel
      .findOne({
        $or: [
          { userId: userId, friendId: targetUserId },
          { userId: targetUserId, friendId: userId },
        ],
      })
      .lean()
      .exec();

    if (!relationship) {
      return { isFriend: false, status: null };
    }

    return {
      isFriend: relationship.status === RelationshipStatus.ACCEPTED,
      status: relationship.status,
    };
  }

  // Block a user
  async blockUser(userId: string, targetUserId: string) {
    // Check for existing relationship
    let relationship = await this.relationshipModel.findOne({
      $or: [
        { userId: userId, friendId: targetUserId },
        { userId: targetUserId, friendId: userId },
      ],
    });

    if (relationship) {
      // Update existing relationship to blocked
      relationship.status = RelationshipStatus.BLOCKED;
      relationship.block = {
        isBlocked: true,
        blockedAt: new Date(),
        userBlockedId: new Types.ObjectId(userId),
      };
      await relationship.save();
    } else {
      // Create new blocked relationship
      relationship = new this.relationshipModel({
        userId: userId,
        friendId: targetUserId,
        status: RelationshipStatus.BLOCKED,
        block: {
          isBlocked: true,
          blockedAt: new Date(),
          userBlockedId: new Types.ObjectId(userId),
        },
      });
      await relationship.save();
    }

    return { message: 'Đã chặn người dùng thành công' };
  }

  // Unblock a user
  async unblockUser(userId: string, targetUserId: string) {
    const relationship = await this.relationshipModel.findOne({
      $or: [
        { userId: userId, friendId: targetUserId },
        { userId: targetUserId, friendId: userId },
      ],
      status: RelationshipStatus.BLOCKED,
      'block.userBlockedId': new Types.ObjectId(userId),
    });

    if (!relationship) {
      throw new NotFoundException('Không tìm thấy người dùng bị chặn');
    }

    // Remove the relationship entirely when unblocking
    await this.relationshipModel.deleteOne({ _id: relationship._id });

    return { message: 'Đã bỏ chặn người dùng thành công' };
  }

  // Get blocked users list
  async getBlockedUsers(userId: string) {
    const blockedRelationships = await this.relationshipModel
      .find({
        status: RelationshipStatus.BLOCKED,
        'block.userBlockedId': new Types.ObjectId(userId),
      })
      .populate('userId friendId', 'firstName lastName avatar username')
      .lean();

    // Return the blocked users (not the current user)
    const blockedUsers = blockedRelationships.map((rel: any) => {
      const blockedUser = rel.userId._id.toString() === userId ? rel.friendId : rel.userId;
      return {
        ...blockedUser,
        blockedAt: rel.block?.blockedAt,
      };
    });

    const mutualFriendsMap = await this.getMutualFriendsMap(
      userId,
      blockedUsers.map((user: any) => user._id)
    );

    return blockedUsers.map((blockedUser: any) => ({
      ...blockedUser,
      mutualFriends: mutualFriendsMap.get(blockedUser._id.toString())?.count ?? 0,
      mutualFriendPreview:
        mutualFriendsMap.get(blockedUser._id.toString())?.mutualFriendPreview ?? [],
    }));
  }

  // Check if a user is blocked
  async isUserBlocked(userId: string, targetUserId: string): Promise<boolean> {
    const relationship = await this.relationshipModel.findOne({
      $or: [
        { userId: userId, friendId: targetUserId },
        { userId: targetUserId, friendId: userId },
      ],
      status: RelationshipStatus.BLOCKED,
    });

    return !!relationship;
  }

  // Restrict a user (hide conversation but still friends)
  async restrictUser(userId: string, targetUserId: string) {
    const relationship = await this.relationshipModel.findOne({
      $or: [
        { userId: new Types.ObjectId(userId), friendId: new Types.ObjectId(targetUserId) },
        { userId: new Types.ObjectId(targetUserId), friendId: new Types.ObjectId(userId) },
      ],
    });

    if (!relationship) {
      throw new NotFoundException('Không tìm thấy mối quan hệ');
    }

    // Set restrict flag (keep friendship status)
    relationship.restrict = {
      isRestricted: true,
      restrictedAt: new Date(),
      userRestrictedId: new Types.ObjectId(userId),
    };
    await relationship.save();

    return { message: 'Đã hạn chế người dùng này' };
  }

  // Unrestrict a user
  async unrestrictUser(userId: string, targetUserId: string) {
    const relationship = await this.relationshipModel.findOne({
      $or: [
        { userId: userId, friendId: targetUserId },
        { userId: targetUserId, friendId: userId },
      ],
      'restrict.userRestrictedId': new Types.ObjectId(userId),
    });

    if (!relationship) {
      throw new NotFoundException('Không tìm thấy người dùng bị hạn chế');
    }

    relationship.restrict = {
      isRestricted: false,
      restrictedAt: null,
      userRestrictedId: null,
    };
    await relationship.save();

    return { message: 'Đã bỏ hạn chế người dùng' };
  }

  // Get restricted users (users you've restricted)
  async getRestrictedUsers(userId: string) {
    const restrictedRelationships = await this.relationshipModel
      .find({
        'restrict.isRestricted': true,
        'restrict.userRestrictedId': new Types.ObjectId(userId),
      })
      .populate('userId friendId', 'firstName lastName avatar username')
      .lean();

    const restrictedUsers = restrictedRelationships.map((rel: any) => {
      // Return the OTHER user (the one being restricted)
      // After populate, userId and friendId are objects with _id
      const restrictedUser = rel.userId._id.toString() === userId ? rel.friendId : rel.userId;
      return {
        ...restrictedUser,
        restrictedAt: rel.restrict?.restrictedAt,
      };
    });

    const mutualFriendsMap = await this.getMutualFriendsMap(
      userId,
      restrictedUsers.map((user: any) => user._id)
    );

    return restrictedUsers.map((restrictedUser: any) => ({
      ...restrictedUser,
      mutualFriends: mutualFriendsMap.get(restrictedUser._id.toString())?.count ?? 0,
      mutualFriendPreview:
        mutualFriendsMap.get(restrictedUser._id.toString())?.mutualFriendPreview ?? [],
    }));
  }
}
