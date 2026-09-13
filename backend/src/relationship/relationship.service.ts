import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { UserBlock, UserBlockDocument } from './entities/user-block.entity';
import {
  UserRestriction,
  UserRestrictionDocument,
} from './entities/user-restriction.entity';

@Injectable()
export class RelationshipService {
  constructor(
    @InjectModel(Relationship.name) private readonly relationshipModel: Model<RelationshipDocument>,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Account.name) private readonly accountModel: Model<AccountDocument>,
    @InjectModel(UserBlock.name) private readonly userBlockModel: Model<UserBlockDocument>,
    @InjectModel(UserRestriction.name)
    private readonly userRestrictionModel: Model<UserRestrictionDocument>,
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

    const friendIds = relationships.map((rel) =>
      rel.userId.toString() === me.toString()
        ? new Types.ObjectId(rel.friendId.toString())
        : new Types.ObjectId(rel.userId.toString())
    );
    if (friendIds.length === 0) return [];
    const blockedRows = await this.userBlockModel
      .find({
        $or: [
          { blockerId: me, blockedId: { $in: friendIds } },
          { blockedId: me, blockerId: { $in: friendIds } },
        ],
      })
      .select('blockerId blockedId')
      .lean();
    const blockedIds = new Set(
      blockedRows.map((block) =>
        block.blockerId.toString() === userId
          ? block.blockedId.toString()
          : block.blockerId.toString(),
      ),
    );
    return friendIds.filter((friendId) => !blockedIds.has(friendId.toString()));
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
  async addFriend(
    createRelationshipDto: CreateRelationshipDto & {
      userId: Types.ObjectId | string | import('mongoose').Schema.Types.ObjectId;
    }
  ) {
    const userId = createRelationshipDto.userId.toString();
    const friendId = createRelationshipDto.friendId?.toString();
    if (!Types.ObjectId.isValid(userId) || !friendId || !Types.ObjectId.isValid(friendId)) {
      throw new BadRequestException('Invalid user identifier');
    }
    if (userId === friendId) {
      throw new BadRequestException('You cannot send a friend request to yourself');
    }

    const targetExists = await this.accountModel.exists({
      _id: friendId,
      isDeleted: { $ne: true },
      isActive: { $ne: false },
    });
    if (!targetExists) {
      throw new NotFoundException('Target account was not found');
    }

    const [isExistingRelationship, directionalBlock] = await Promise.all([
      this.relationshipModel.findOne({
        $or: [
          { userId: createRelationshipDto.userId, friendId: createRelationshipDto.friendId },
          { userId: createRelationshipDto.friendId, friendId: createRelationshipDto.userId },
        ],
      }),
      this.userBlockModel.exists({
        $or: [
          { blockerId: userId, blockedId: friendId },
          { blockerId: friendId, blockedId: userId },
        ],
      }),
    ]);

    if (directionalBlock) {
      throw new ConflictException('A blocked relationship cannot receive a friend request');
    }

    if (
      isExistingRelationship &&
      [RelationshipStatus.ACCEPTED, RelationshipStatus.BLOCKED].includes(
        isExistingRelationship.status
      )
    ) {
      throw new ConflictException('The relationship cannot be replaced by a friend request');
    }

    if (isExistingRelationship) {
      if (isExistingRelationship.status === RelationshipStatus.PENDING)
        throw new ConflictException('Đã gửi lời mời kết bạn cho đối tượng này rồi');
      else {
        const pairKey = [userId, friendId].sort().join(':');
        return await this.relationshipModel
          .findByIdAndUpdate(isExistingRelationship._id, {
            status: RelationshipStatus.PENDING,
            sendRequestAt: new Date(),
            userId: createRelationshipDto.userId,
            friendId: createRelationshipDto.friendId,
            pairKey,
          }, { new: true })
          .exec();
      }
    }

    createRelationshipDto.sendRequestAt = new Date();

    const relationship = new this.relationshipModel(createRelationshipDto);
    try {
      await relationship.save();
    } catch (error) {
      const duplicatePair =
        !!error && typeof error === 'object' && 'code' in error && error.code === 11000;
      if (duplicatePair) throw new ConflictException('A relationship already exists');
      throw error;
    }

    // Send notification to friend via RabbitMQ
    const user = await this.accountModel.findById(createRelationshipDto.userId);
    if (user) {
      const requesterName =
        `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Ai đó';
      await this.notificationEmitter.emitFriendRequest(
        createRelationshipDto.friendId.toString(),
        createRelationshipDto.userId.toString(),
        requesterName
      );
    }

    return relationship;
  }

  // Chấp nhận lời mời kết bạn
  async acceptFriend(acceptorId: string, requesterId: string) {
    if (
      !Types.ObjectId.isValid(acceptorId) ||
      !Types.ObjectId.isValid(requesterId) ||
      acceptorId === requesterId
    ) {
      throw new BadRequestException('Invalid friend request');
    }

    const relationship = await this.relationshipModel.findOneAndUpdate(
      {
        userId: requesterId,
        friendId: acceptorId,
        status: RelationshipStatus.PENDING,
      },
      { $set: { status: RelationshipStatus.ACCEPTED } },
      { new: true }
    );

    if (!relationship) {
      throw new NotFoundException('Không tìm thấy mối quan hệ kết bạn');
    }

    const directPairKey = [acceptorId, requesterId]
      .map((id) => new Types.ObjectId(id).toString())
      .sort()
      .join('|');

    // Fast path: pairKey first, then legacy participant-based lookup for
    // conversations created before directPairKey existed.
    const converstationExists = await this.conversationModel.findOne({
      type: 'DIRECT',
      $or: [
        { directPairKey },
        {
          participants: {
            $all: [{ $elemMatch: { user: acceptorId } }, { $elemMatch: { user: requesterId } }],
          },
        },
      ],
    });

    if (converstationExists) {
      return converstationExists;
    }

    const dataConverstation = {
      type: 'DIRECT',
      directPairKey,
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

    // Race-safe creation: the unique partial index on directPairKey turns a
    // concurrent duplicate insert into error code 11000; the loser re-fetches
    // the winner instead of creating a second conversation.
    let conversation;
    try {
      conversation = await this.conversationModel.create(dataConverstation);
    } catch (error) {
      const duplicatePair =
        !!error && typeof error === 'object' && 'code' in error && error.code === 11000;
      if (!duplicatePair) throw error;

      const raced = await this.conversationModel.findOne({
        type: 'DIRECT',
        $or: [
          { directPairKey },
          {
            participants: {
              $all: [{ $elemMatch: { user: acceptorId } }, { $elemMatch: { user: requesterId } }],
            },
          },
        ],
      });
      if (!raced) throw error;
      return raced;
    }

    // Send notification to requester via RabbitMQ (only when we created the
    // conversation — same semantics as the previous find-then-create flow).
    const acceptor = await this.accountModel
      .findById(acceptorId)
      .select('firstName lastName')
      .lean();
    if (acceptor) {
      const accepterName =
        `${acceptor.firstName || ''} ${acceptor.lastName || ''}`.trim() || 'Ai đó';
      await this.notificationEmitter.emitFriendAccepted(
        requesterId,
        acceptorId,
        accepterName
      );
    }

    return conversation;
  }

  // Dùng để cập nhật trạng thái kết bạn như REJECTED: quy chung là hủy kết bạn hoặc từ chối kết bạn, BLOCKED, CANCELED
  async updateStatusRelationship(userId: string, friendId: string, status: string) {
    if (
      !Types.ObjectId.isValid(userId) ||
      !Types.ObjectId.isValid(friendId) ||
      userId === friendId
    ) {
      throw new BadRequestException('Invalid relationship');
    }

    if (
      ![RelationshipStatus.CANCELED, RelationshipStatus.REJECTED].includes(
        status as RelationshipStatus
      )
    ) {
      throw new BadRequestException('Unsupported relationship status transition');
    }

    const relationship = await this.relationshipModel.findOne({
      $or: [
        { userId, friendId },
        { userId: friendId, friendId: userId },
      ],
    });
    if (!relationship) {
      throw new NotFoundException('Relationship was not found');
    }
    if (relationship.status === RelationshipStatus.BLOCKED) {
      throw new ForbiddenException('A blocked relationship cannot be changed here');
    }

    if (relationship.status === RelationshipStatus.PENDING) {
      const isRequester = relationship.userId.toString() === userId;
      const permittedStatus = isRequester
        ? RelationshipStatus.CANCELED
        : RelationshipStatus.REJECTED;
      if (status !== permittedStatus) {
        throw new ForbiddenException('Invalid pending request transition');
      }
    } else if (relationship.status !== RelationshipStatus.ACCEPTED) {
      throw new ConflictException('Relationship is already closed');
    }

    relationship.status = status as RelationshipStatus;
    return relationship.save();
  }

  async getAcceptedFriendIdStrings(userId: string): Promise<string[]> {
    if (!Types.ObjectId.isValid(userId)) return [];
    const ids = await this.getAcceptedFriendIds(userId);
    return ids.map((id) => id.toString());
  }

  // Lấy danh sách mà người dùng gửi lời mời kết bạn
  async getSentFriendRequests(userId: string): Promise<any> {
    if (!Types.ObjectId.isValid(userId)) throw new BadRequestException('Invalid user identifier');
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
    if (!Types.ObjectId.isValid(userId)) throw new BadRequestException('Invalid user identifier');
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
    if (!Types.ObjectId.isValid(userId)) throw new BadRequestException('Invalid user identifier');
    if (mutualBaseUserId && !Types.ObjectId.isValid(mutualBaseUserId)) {
      throw new BadRequestException('Invalid user identifier');
    }
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
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(targetUserId)) {
      return { isFriend: false, status: null };
    }
    const [relationship, directionalBlock] = await Promise.all([
      this.relationshipModel.findOne({
        $or: [
          { userId: userId, friendId: targetUserId },
          { userId: targetUserId, friendId: userId },
        ],
      })
      .lean()
      .exec(),
      this.userBlockModel.exists({
        $or: [
          { blockerId: userId, blockedId: targetUserId },
          { blockerId: targetUserId, blockedId: userId },
        ],
      }),
    ]);

    if (directionalBlock) {
      return { isFriend: false, status: RelationshipStatus.BLOCKED };
    }
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
    if (
      !Types.ObjectId.isValid(userId) ||
      !Types.ObjectId.isValid(targetUserId) ||
      userId === targetUserId
    ) {
      throw new BadRequestException('Invalid block target');
    }
    const blockerId = new Types.ObjectId(userId);
    const blockedId = new Types.ObjectId(targetUserId);
    const targetExists = await this.accountModel.exists({
      _id: blockedId,
      isDeleted: { $ne: true },
      isActive: { $ne: false },
    });
    if (!targetExists) throw new NotFoundException('Target account was not found');

    const pairFilter = {
      $or: [
        { userId: blockerId, friendId: blockedId },
        { userId: blockedId, friendId: blockerId },
      ],
    };
    const relationship = await this.relationshipModel.findOne(pairFilter);

    // Preserve a pre-refactor directional block before touching the shared relation row.
    const legacyBlockerId = relationship?.block?.isBlocked
      ? relationship.block.userBlockedId
      : null;
    const writes: Promise<unknown>[] = [
      this.userBlockModel.updateOne(
        { blockerId, blockedId },
        { $setOnInsert: { blockerId, blockedId } },
        { upsert: true },
      ),
    ];
    if (legacyBlockerId) {
      const legacyBlockedId =
        legacyBlockerId.toString() === relationship!.userId.toString()
          ? relationship!.friendId
          : relationship!.userId;
      writes.push(
        this.userBlockModel.updateOne(
          { blockerId: legacyBlockerId, blockedId: legacyBlockedId },
          { $setOnInsert: { blockerId: legacyBlockerId, blockedId: legacyBlockedId } },
          { upsert: true },
        ),
      );
    }
    await Promise.all(writes);

    const pairKey = [userId, targetUserId].sort().join(':');
    if (relationship) {
      await this.relationshipModel.updateOne(
        { _id: relationship._id },
        { $set: { status: RelationshipStatus.BLOCKED, pairKey } },
      );
    } else {
      const [firstId, secondId] = [userId, targetUserId].sort();
      await this.relationshipModel.findOneAndUpdate(
        { pairKey },
        {
          $setOnInsert: {
            pairKey,
            userId: new Types.ObjectId(firstId),
            friendId: new Types.ObjectId(secondId),
          },
          $set: { status: RelationshipStatus.BLOCKED },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }

    return { message: 'Đã chặn người dùng thành công' };
  }

  // Unblock a user
  async unblockUser(userId: string, targetUserId: string) {
    if (
      !Types.ObjectId.isValid(userId) ||
      !Types.ObjectId.isValid(targetUserId) ||
      userId === targetUserId
    ) {
      throw new BadRequestException('Invalid unblock target');
    }
    const blockerId = new Types.ObjectId(userId);
    const blockedId = new Types.ObjectId(targetUserId);
    const relationship = await this.relationshipModel.findOne({
      $or: [
        { userId: blockerId, friendId: blockedId },
        { userId: blockedId, friendId: blockerId },
      ],
      status: RelationshipStatus.BLOCKED,
    });
    const deleted = await this.userBlockModel.deleteOne({ blockerId, blockedId });
    const ownsLegacyBlock =
      relationship?.block?.isBlocked &&
      relationship.block.userBlockedId?.toString() === userId;
    if (ownsLegacyBlock && relationship) {
      relationship.block = {
        isBlocked: false,
        blockedAt: null,
        userBlockedId: null,
      };
      await relationship.save();
    }

    if (deleted.deletedCount === 0 && !ownsLegacyBlock) {
      throw new NotFoundException('Không tìm thấy người dùng bị chặn');
    }

    if (relationship) {
      const [remainingBlock, legacyStillActive] = await Promise.all([
        this.userBlockModel.exists({
          $or: [
            { blockerId, blockedId },
            { blockerId: blockedId, blockedId: blockerId },
          ],
        }),
        this.relationshipModel.exists({
          _id: relationship._id,
          'block.isBlocked': true,
        }),
      ]);
      if (!remainingBlock && !legacyStillActive) {
        await this.relationshipModel.deleteOne({
          _id: relationship._id,
          status: RelationshipStatus.BLOCKED,
        });
      }
    }

    return { message: 'Đã bỏ chặn người dùng thành công' };
  }

  // Get blocked users list
  async getBlockedUsers(userId: string) {
    if (!Types.ObjectId.isValid(userId)) throw new BadRequestException('Invalid user identifier');
    const me = new Types.ObjectId(userId);
    const [blocks, legacyBlocks] = await Promise.all([
      this.userBlockModel.find({ blockerId: me }).select('blockedId createdAt').lean(),
      this.relationshipModel
        .find({
          status: RelationshipStatus.BLOCKED,
          'block.userBlockedId': me,
          'block.isBlocked': true,
        })
        .select('userId friendId block.blockedAt')
        .lean(),
    ]);
    const blockedAtById = new Map<string, Date | null | undefined>();
    blocks.forEach((block) => blockedAtById.set(block.blockedId.toString(), block.createdAt));
    legacyBlocks.forEach((relationship) => {
      const otherId =
        relationship.userId.toString() === userId
          ? relationship.friendId.toString()
          : relationship.userId.toString();
      if (!blockedAtById.has(otherId)) blockedAtById.set(otherId, relationship.block?.blockedAt);
    });
    const blockedAccounts = await this.accountModel
      .find({
        _id: { $in: [...blockedAtById.keys()].map((id) => new Types.ObjectId(id)) },
        isDeleted: { $ne: true },
      })
      .select('firstName lastName avatar username')
      .lean();
    const blockedUsers = blockedAccounts.map((account) => ({
      ...account,
      blockedAt: blockedAtById.get(account._id.toString()),
    }));

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
    return (await this.getBlockState(userId, targetUserId)).blocked;
  }

  async getBlockState(
    userId: string,
    targetUserId: string
  ): Promise<{ blocked: boolean; blockedByMe: boolean }> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(targetUserId)) {
      return { blocked: false, blockedByMe: false };
    }

    const userObjectId = new Types.ObjectId(userId);
    const targetObjectId = new Types.ObjectId(targetUserId);
    const [blocks, relationship] = await Promise.all([
      this.userBlockModel
        .find({
          $or: [
            { blockerId: userObjectId, blockedId: targetObjectId },
            { blockerId: targetObjectId, blockedId: userObjectId },
          ],
        })
        .select('blockerId')
        .lean(),
      this.relationshipModel.findOne({
        $or: [
          { userId, friendId: targetUserId },
          { userId: targetUserId, friendId: userId },
        ],
        status: RelationshipStatus.BLOCKED,
      })
      .select('block.isBlocked block.userBlockedId')
      .lean(),
    ]);

    const legacyBlocked = relationship?.block?.isBlocked === true;
    return {
      blocked: blocks.length > 0 || legacyBlocked,
      blockedByMe:
        blocks.some((block) => block.blockerId.toString() === userId) ||
        (legacyBlocked && relationship?.block?.userBlockedId?.toString() === userId),
    };
  }

  async getRelationshipFilters(userId: string): Promise<{
    blockedUserIds: Set<string>;
    restrictedUserIds: Set<string>;
  }> {
    if (!Types.ObjectId.isValid(userId)) {
      return { blockedUserIds: new Set(), restrictedUserIds: new Set() };
    }

    const [relationships, blockRows] = await Promise.all([this.relationshipModel
      .find({
        $and: [
          { $or: [{ userId }, { friendId: userId }] },
          {
            $or: [
              { status: RelationshipStatus.BLOCKED },
              { 'restrict.isRestricted': true },
            ],
          },
        ],
      })
      .select('userId friendId status block restrict')
      .lean(),
      this.userBlockModel
        .find({ $or: [{ blockerId: userId }, { blockedId: userId }] })
        .select('blockerId blockedId')
        .lean(),
    ]);

    const blockedUserIds = new Set<string>();
    const restrictedUserIds = new Set<string>();
    for (const block of blockRows) {
      blockedUserIds.add(
        block.blockerId.toString() === userId
          ? block.blockedId.toString()
          : block.blockerId.toString(),
      );
    }
    for (const relationship of relationships) {
      const otherUserId =
        relationship.userId.toString() === userId
          ? relationship.friendId.toString()
          : relationship.userId.toString();
      if (
        relationship.status === RelationshipStatus.BLOCKED &&
        relationship.block?.isBlocked
      ) {
        blockedUserIds.add(otherUserId);
      }
      if (
        relationship.restrict?.isRestricted &&
        relationship.restrict.userRestrictedId?.toString() === userId
      ) {
        restrictedUserIds.add(otherUserId);
      }
    }

    return { blockedUserIds, restrictedUserIds };
  }

  // Restrict a user (hide conversation but still friends)
  async restrictUser(userId: string, targetUserId: string) {
    if (
      !Types.ObjectId.isValid(userId) ||
      !Types.ObjectId.isValid(targetUserId) ||
      userId === targetUserId
    ) {
      throw new BadRequestException('Invalid restrict target');
    }
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
    if (
      !Types.ObjectId.isValid(userId) ||
      !Types.ObjectId.isValid(targetUserId) ||
      userId === targetUserId
    ) {
      throw new BadRequestException('Invalid unrestrict target');
    }
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
    if (!Types.ObjectId.isValid(userId)) throw new BadRequestException('Invalid user identifier');
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
