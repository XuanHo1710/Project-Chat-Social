import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument } from 'src/conversation/entities/conversation.entity';
import { Account, AccountDocument } from 'src/account/entities/account.entity';
import { InjectModel } from '@nestjs/mongoose';
import { RelationshipService } from 'src/relationship/relationship.service';

@Injectable()
export class ConversationService {
  constructor(
    @InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>,
    @Inject(forwardRef(() => RelationshipService))
    private readonly relationshipService: RelationshipService,
    @InjectModel(Account.name) private readonly accountModel: Model<AccountDocument>
  ) {}

  async unreadCountAllConversationByUserId(userId: string) {
    const result = await this.conversationModel.aggregate([
      {
        $match: {
          $and: [
            { 'participants.user': new Types.ObjectId(userId) },
            { mutedBy: { $ne: new Types.ObjectId(userId) } },
          ],
        },
      },
      {
        $project: {
          unread: {
            $ifNull: [
              {
                $getField: {
                  field: userId, // key của Map
                  input: '$unreadCount', // Map<string, number>
                },
              },
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalUnread: { $sum: '$unread' },
        },
      },
    ]);

    return {
      unreadCount: result[0]?.totalUnread ?? 0,
    };
  }

  async create(creatorId: string, createConversationDto: CreateConversationDto) {
    const memberIds = Array.from(
      new Set(
        (createConversationDto.participants || [])
          .map((participant) => participant.user?.toString())
          .filter((id): id is string => !!id && id !== creatorId)
      )
    );

    if (createConversationDto.type === 'DIRECT' && memberIds.length === 1) {
      return this.findOrCreateDirectConversation(creatorId, memberIds[0]);
    }
    if (createConversationDto.type === 'GROUP') {
      return this.createGroup(creatorId, memberIds);
    }

    throw new BadRequestException('Use DIRECT with one target or GROUP with at least two targets');
  }

  async findOrCreateDirectConversation(userId: string, targetUserId: string): Promise<any> {
    if (
      !Types.ObjectId.isValid(userId) ||
      !Types.ObjectId.isValid(targetUserId) ||
      userId === targetUserId
    ) {
      throw new BadRequestException('Invalid direct conversation participants');
    }

    const [targetExists, friendship, blockState] = await Promise.all([
      this.accountModel.exists({
        _id: targetUserId,
        isDeleted: { $ne: true },
        isActive: { $ne: false },
      }),
      this.relationshipService.checkFriendship(userId, targetUserId),
      this.relationshipService.getBlockState(userId, targetUserId),
    ]);
    if (!targetExists) {
      throw new NotFoundException('Target account was not found');
    }
    if (!friendship.isFriend || blockState.blocked) {
      throw new ForbiddenException('Direct conversations are only available between unblocked friends');
    }

    // Find existing DIRECT conversation between these two users (pairKey first,
    // then legacy participant-based lookup for rows created before pairKeys).
    const directPairKey = this.buildDirectPairKey(userId, targetUserId);
    const existing = await this.conversationModel
      .findOne({
        type: 'DIRECT',
        $or: [
          { directPairKey },
          {
            'participants.user': {
              $all: [new Types.ObjectId(userId), new Types.ObjectId(targetUserId)],
            },
            $expr: { $eq: [{ $size: '$participants' }, 2] },
          },
        ],
      })
      .select('_id')
      .lean();

    if (existing) {
      return this.findById(existing._id.toString(), userId);
    }

    // Create new DIRECT conversation. The unique partial index on
    // directPairKey makes concurrent creations fail with 11000 instead of
    // duplicating; the loser re-fetches the winner and continues.
    try {
      const saved = await this.conversationModel.create({
        type: 'DIRECT',
        directPairKey,
        participants: [
          { user: new Types.ObjectId(userId), joinedAt: new Date(), isAdmin: false, nickname: '' },
          {
            user: new Types.ObjectId(targetUserId),
            joinedAt: new Date(),
            isAdmin: false,
            nickname: '',
          },
        ],
      });
      return this.findById(saved._id.toString(), userId);
    } catch (error) {
      if (!this.isDuplicateKeyError(error)) throw error;

      const raced = await this.conversationModel
        .findOne({
          type: 'DIRECT',
          $or: [
            { directPairKey },
            {
              'participants.user': {
                $all: [new Types.ObjectId(userId), new Types.ObjectId(targetUserId)],
              },
              $expr: { $eq: [{ $size: '$participants' }, 2] },
            },
          ],
        })
        .select('_id')
        .lean();

      if (!raced) throw error;
      return this.findById(raced._id.toString(), userId);
    }
  }

  private buildDirectPairKey(userId: string, targetUserId: string): string {
    return [new Types.ObjectId(userId).toString(), new Types.ObjectId(targetUserId).toString()]
      .sort()
      .join('|');
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return !!error && typeof error === 'object' && 'code' in error && (error as any).code === 11000;
  }

  // Create a group chat with multiple members (minimum 3 people including creator)
  async createGroup(
    creatorId: string,
    memberIds: string[], // Array of user IDs to add to the group
    groupName?: string
  ): Promise<any> {
    if (!Types.ObjectId.isValid(creatorId)) {
      throw new BadRequestException('Invalid creator identifier');
    }

    const uniqueMemberIds = Array.from(new Set(memberIds)).filter((id) => id !== creatorId);
    if (
      uniqueMemberIds.length < 2 ||
      uniqueMemberIds.some((id) => !Types.ObjectId.isValid(id))
    ) {
      throw new BadRequestException('A group requires at least three valid, unique members');
    }

    const existingMemberCount = await this.accountModel.countDocuments({
      _id: { $in: uniqueMemberIds },
      isDeleted: { $ne: true },
      isActive: { $ne: false },
    });
    if (existingMemberCount !== uniqueMemberIds.length) {
      throw new BadRequestException('One or more group members are unavailable');
    }

    // Validate minimum 2 other members (total 3 including creator)
    if (!memberIds || memberIds.length < 2) {
      throw new BadRequestException('Nhóm cần ít nhất 3 thành viên (bao gồm bạn)');
    }

    // Create participants array with creator as admin
    const participants = [
      {
        user: new Types.ObjectId(creatorId),
        joinedAt: new Date(),
        isAdmin: true,
        nickname: '',
      },
      ...uniqueMemberIds.map((memberId) => ({
        user: new Types.ObjectId(memberId),
        joinedAt: new Date(),
        isAdmin: false,
        nickname: '',
      })),
    ];

    const group = new this.conversationModel({
      type: 'GROUP',
      nickname: groupName || 'Nhóm mới',
      creator: new Types.ObjectId(creatorId),
      participants,
    });

    const saved = await group.save();
    return this.findById(saved._id.toString(), creatorId);
  }

  async findAll() {
    return await this.conversationModel.find().exec();
  }

  async findById(id: string, currentUserId: string): Promise<any> {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(currentUserId)) {
      throw new BadRequestException('Invalid conversation identifier');
    }

    const conv = await this.conversationModel
      .findOne({
        _id: id,
        isDeleted: { $ne: true },
        participants: {
          $elemMatch: {
            user: new Types.ObjectId(currentUserId),
            kickedAt: null,
            leftAt: null,
          },
        },
      })
      .populate(
        'participants.user',
        'firstName lastName username avatar status lastActive showActivityStatus'
      )
      .lean()
      .exec();

    if (!conv) {
      throw new NotFoundException('Conversation was not found');
    }

    // Hide status and lastActive for users who have showActivityStatus = false
    const transformedParticipants = conv.participants.map((p: any) => {
      if (p.user && p.user.showActivityStatus === false) {
        return {
          ...p,
          user: {
            ...p.user,
            status: 'HIDDEN',
            lastActive: null,
          },
        };
      }
      return p;
    });

    // Check if current user has blocked the other user (only for DIRECT)
    let blockedByMe = false;
    let chatBlocked = false;
    const participants = conv.participants as any[];
    if (conv.type === 'DIRECT' && participants.length === 2) {
      const otherParticipant = conv.participants.find(
        (p: any) => p.user._id.toString() !== currentUserId
      ) as any;
      if (otherParticipant) {
        const otherUserId = otherParticipant.user._id.toString();
        const blockState = await this.relationshipService.getBlockState(
          currentUserId,
          otherUserId
        );
        chatBlocked = blockState.blocked;
        blockedByMe = blockState.blockedByMe;
      }
    }

    // Đảm bảo unreadCount luôn là object với giá trị cho mỗi participant
    let unreadCountObj: Record<string, number> = {};
    if (conv.unreadCount) {
      if (conv.unreadCount instanceof Map) {
        unreadCountObj = Object.fromEntries(conv.unreadCount);
      } else if (typeof conv.unreadCount === 'object') {
        unreadCountObj = conv.unreadCount as Record<string, number>;
      }
    }

    // Đảm bảo mỗi participant đều có entry trong unreadCount (mặc định = 0)
    transformedParticipants.forEach((p: any) => {
      const participantId = p.user._id.toString();
      if (typeof unreadCountObj[participantId] !== 'number') {
        unreadCountObj[participantId] = 0;
      }
    });

    return {
      ...conv,
      blockedByMe,
      chatBlocked: chatBlocked,
      participants: transformedParticipants,
      mutedBy: (conv.mutedBy || []).map((id: any) => id.toString()),
      unreadCount: unreadCountObj,
    };
  }

  async findConversationByUserId(userId: string): Promise<any> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user identifier');
    }

    const conversations = await this.conversationModel
      .find({
        isDeleted: { $ne: true },
        participants: {
          $elemMatch: {
            user: new Types.ObjectId(userId),
            kickedAt: null,
            leftAt: null,
          },
        },
      })
      .populate(
        'participants.user',
        'firstName lastName username avatar status lastActive showActivityStatus'
      )
      .populate('lastMessage', 'content type createdAt senderId attachments callData')
      .sort({ lastMessageAt: -1 })
      .lean()
      .exec();

    const { blockedUserIds, restrictedUserIds } =
      await this.relationshipService.getRelationshipFilters(userId);

    // Filter out DIRECT conversations where the other user is RESTRICTED by current user
    const filteredConversations = conversations.filter((conv: any) => {
      // Group conversations are always shown
      if (conv.type === 'GROUP') return true;

      // For DIRECT conversations, check if the other user is restricted by current user
      const otherParticipant = conv.participants.find((p: any) => p.user._id.toString() !== userId);
      if (!otherParticipant) return true;

      const otherUserId = otherParticipant.user._id.toString();

      // Hide conversation if current user RESTRICTED the other user
      return !restrictedUserIds.has(otherUserId);
    });

    // Transform Map to plain object for unreadCount
    // Hide status and lastActive for users who have showActivityStatus = false
    // Add blockedByMe flag for DIRECT conversations
    return filteredConversations.map((conv) => {
      // Check if current user has blocked the other user (only for DIRECT)
      let blockedByMe = false;
      conv['isRestricted'] = false;
      if (conv.type === 'DIRECT') {
        const otherParticipant = conv.participants.find(
          (p: any) => p.user._id.toString() !== userId
        ) as any;
        if (otherParticipant) {
          const otherUserId = otherParticipant.user._id.toString();
          blockedByMe = blockedUserIds.has(otherUserId);
          conv['isRestricted'] = restrictedUserIds.has(otherUserId);
        }
      }

      // Process unreadCount to ensure it's a plain object with entries for all participants
      let unreadCountObj: Record<string, number> = {};
      if (conv.unreadCount) {
        if (conv.unreadCount instanceof Map) {
          unreadCountObj = Object.fromEntries(conv.unreadCount);
        } else if (typeof conv.unreadCount === 'object') {
          unreadCountObj = conv.unreadCount as Record<string, number>;
        }
      }

      // Ensure each participant has an entry in unreadCount (default = 0)
      const transformedParticipants = conv.participants.map((p: any) => {
        const participantId = p.user._id.toString();
        if (typeof unreadCountObj[participantId] !== 'number') {
          unreadCountObj[participantId] = 0;
        }

        if (p.user && p.user.showActivityStatus === false) {
          return {
            ...p,
            user: {
              ...p.user,
              status: 'HIDDEN',
              lastActive: null,
            },
          };
        }
        return p;
      });

      return {
        ...conv,
        blockedByMe,
        mutedBy: (conv.mutedBy || []).map((id: any) => id.toString()),
        participants: transformedParticipants,
        unreadCount: unreadCountObj,
      };
    });
  }

  // ============ CHATBOT FEATURES ============
  async findOrCreateChatbotConversation(userId: string): Promise<any> {
    const BOT_USERNAME = 'ai_assistant';

    // 1. Find or Create Bot Account
    let botUser = await this.accountModel.findOne({ username: BOT_USERNAME });

    if (!botUser) {
      botUser = new this.accountModel({
        username: BOT_USERNAME,
        firstName: 'Cố vấn',
        lastName: 'AI',
        email: 'ai@system.local',
        password: '$2b$10$SomethingRandomHashForBotSecurity',
        role: 'USER',
        status: 'ACTIVE',
        avatar: 'https://cdn-icons-png.flaticon.com/512/4712/4712027.png', // Default AI avatar
        isActive: true,
      });
      await botUser.save();
    }

    // 2. Find existing CHATBOT conversation
    // Logic: type = CHATBOT and participants contains current user
    // Note: A user can only have one AI conversation
    const existing = await this.conversationModel.findOne({
      type: 'CHATBOT',
      'participants.user': new Types.ObjectId(userId),
    }).select('_id').lean();

    if (existing) {
      return this.findById(existing._id.toString(), userId);
    }

    // 3. Create new conversation
    const participants = [
      {
        user: new Types.ObjectId(userId),
        joinedAt: new Date(),
        isAdmin: true,
        nickname: '',
      },
      {
        user: botUser._id,
        joinedAt: new Date(),
        isAdmin: false,
        nickname: 'Cố vấn AI',
      },
    ];

    const newConv = new this.conversationModel({
      type: 'CHATBOT',
      participants,
      settings: {
        allowMembersToAdd: false,
        onlyAdminCanChat: false,
      },
      unreadCount: {
        [userId]: 0,
        [botUser._id.toString()]: 0,
      },
    });

    const saved = await newConv.save();
    return this.findById(saved._id.toString(), userId);
  }

  async updateLastMessage(id: string, lastMessage: string) {
    return await this.conversationModel
      .updateOne({ _id: id }, { $set: { lastMessage: lastMessage, lastMessageAt: new Date() } })
      .exec();
  }

  // Increment unread count for all participants except sender
  async incrementUnreadCount(conversationId: string, senderId: string): Promise<any> {
    const conversation = await this.conversationModel
      .findById(conversationId)
      .select('participants')
      .lean();
    if (!conversation) return null;

    const updateObj: Record<string, number> = {};
    conversation.participants.forEach((p) => {
      const participantId = p.user.toString();
      if (participantId !== senderId) {
        updateObj[`unreadCount.${participantId}`] = 1;
      }
    });

    if (Object.keys(updateObj).length > 0) {
      // Use updateOne then findById to ensure we get the absolute latest state
      // This avoids issues with findOneAndUpdate returning stale Map data in some Mongoose versions
      await this.conversationModel.updateOne({ _id: conversationId }, { $inc: updateObj });

      const updated = await this.conversationModel.findById(conversationId).lean();

      if (!updated) return null;

      // Convert Map/Object to plain object for socket emission
      let unreadCountObj: Record<string, number> = {};
      if (updated.unreadCount) {
        if (updated.unreadCount instanceof Map) {
          unreadCountObj = Object.fromEntries(updated.unreadCount);
        } else if (typeof updated.unreadCount === 'object') {
          // In lean(), it typically returns a plain object for Map types
          unreadCountObj = updated.unreadCount as unknown as Record<string, number>;
        }
      }

      return {
        ...updated,
        unreadCount: unreadCountObj,
      };
    }

    return null;
  }

  // Reset unread count for a specific user
  async resetUnreadCount(conversationId: string, userId: string): Promise<any> {
    await this.conversationModel.updateOne(
      { _id: conversationId },
      { $set: { [`unreadCount.${userId}`]: 0 } }
    );

    const updated = await this.conversationModel.findById(conversationId).lean();

    if (!updated) return null;

    // Convert Map to plain object for socket emission
    let unreadCountObj: Record<string, number> = {};
    if (updated.unreadCount) {
      if (updated.unreadCount instanceof Map) {
        unreadCountObj = Object.fromEntries(updated.unreadCount);
      } else if (typeof updated.unreadCount === 'object') {
        unreadCountObj = updated.unreadCount as unknown as Record<string, number>;
      }
    }

    return {
      ...updated,
      unreadCount: unreadCountObj,
    };
  }

  // Get unread count for a specific user
  async getUnreadCount(conversationId: string, userId: string): Promise<number> {
    const conversation = await this.conversationModel.findById(conversationId).lean();
    if (!conversation || !conversation.unreadCount) return 0;
    return (conversation.unreadCount as any)[userId] || 0;
  }

  async update(id: string, userId: string, updateConversationDto: UpdateConversationDto) {
    if (!(await this.isUserInConversation(id, userId))) {
      throw new ForbiddenException('You are not an active conversation member');
    }

    const safeUpdate: Record<string, unknown> = {};
    if (typeof (updateConversationDto as any).nickname === 'string') {
      safeUpdate.nickname = (updateConversationDto as any).nickname.trim().slice(0, 120);
    }
    if (typeof (updateConversationDto as any).avatar === 'string') {
      safeUpdate.avatar = (updateConversationDto as any).avatar.trim().slice(0, 2048);
    }
    if (typeof (updateConversationDto as any).quickReaction === 'string') {
      safeUpdate.quickReaction = (updateConversationDto as any).quickReaction.slice(0, 32);
    }
    if (typeof (updateConversationDto as any).theme === 'string') {
      safeUpdate.theme = (updateConversationDto as any).theme.slice(0, 64);
    }
    if ((updateConversationDto as any).settings) {
      const isAdmin = await this.isUserAdmin(id, userId);
      if (!isAdmin) {
        throw new ForbiddenException('Chỉ quản trị viên mới có thể thay đổi cài đặt nhóm');
      }
      const settings = (updateConversationDto as any).settings;
      safeUpdate.settings = {
        allowMembersToAdd: settings.allowMembersToAdd === true,
        onlyAdminCanChat: settings.onlyAdminCanChat === true,
      };
    }
    if (Object.keys(safeUpdate).length === 0) {
      throw new BadRequestException('No supported conversation fields were provided');
    }

    return this.conversationModel
      .findByIdAndUpdate(id, { $set: safeUpdate }, { new: true, runValidators: true })
      .exec();
  }

  async remove(id: string, userId: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid conversation identifier');
    }

    const conversation = await this.conversationModel
      .findOne({
        _id: id,
        type: 'GROUP',
        creator: new Types.ObjectId(userId),
        isDeleted: { $ne: true },
      })
      .select('_id');
    if (!conversation) {
      throw new ForbiddenException('Only the group creator can delete this conversation');
    }

    return this.conversationModel.findByIdAndUpdate(
      id,
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true }
    );
  }

  // ============ CHAT FEATURES ============

  // Kiểm tra user có phải admin không
  async isUserAdmin(conversationId: string, userId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(conversationId) || !Types.ObjectId.isValid(userId)) {
      return false;
    }
    const match = await this.conversationModel.exists({
      _id: conversationId,
      isDeleted: { $ne: true },
      participants: {
        $elemMatch: {
          user: new Types.ObjectId(userId),
          isAdmin: true,
          kickedAt: null,
          leftAt: null,
        },
      },
    });
    return !!match;
  }

  // Kiểm tra user có trong conversation không (và chưa bị kick/rời)
  async isUserInConversation(conversationId: string, userId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(conversationId) || !Types.ObjectId.isValid(userId)) {
      return false;
    }
    const match = await this.conversationModel.exists({
      _id: conversationId,
      isDeleted: { $ne: true },
      participants: {
        $elemMatch: {
          user: new Types.ObjectId(userId),
          kickedAt: null,
          leftAt: null,
        },
      },
    });
    return !!match;
  }

  async areUsersInConversation(conversationId: string, userIds: string[]): Promise<boolean> {
    const uniqueUserIds = Array.from(new Set(userIds));
    if (
      !Types.ObjectId.isValid(conversationId) ||
      uniqueUserIds.length === 0 ||
      uniqueUserIds.some((id) => !Types.ObjectId.isValid(id))
    ) {
      return false;
    }

    const match = await this.conversationModel.exists({
      _id: conversationId,
      isDeleted: { $ne: true },
      participants: {
        $all: uniqueUserIds.map((id) => ({
          $elemMatch: {
            user: new Types.ObjectId(id),
            kickedAt: null,
            leftAt: null,
          },
        })),
      },
    });
    return !!match;
  }

  // 1. Thay đổi Quick Reaction
  async updateQuickReaction(conversationId: string, userId: string, emoji: string) {
    const isInConversation = await this.isUserInConversation(conversationId, userId);
    if (!isInConversation) {
      throw new ForbiddenException('Bạn không phải thành viên của cuộc trò chuyện này');
    }

    return await this.conversationModel
      .findByIdAndUpdate(conversationId, { $set: { quickReaction: emoji } }, { new: true })
      .exec();
  }

  // 1.5. Thay đổi Theme Color
  async updateTheme(conversationId: string, userId: string, theme: string) {
    const isInConversation = await this.isUserInConversation(conversationId, userId);
    if (!isInConversation) {
      throw new ForbiddenException('Bạn không phải thành viên của cuộc trò chuyện này');
    }

    return await this.conversationModel
      .findByIdAndUpdate(conversationId, { $set: { theme: theme } }, { new: true })
      .exec();
  }

  // 2. Thay đổi Nickname của member trong conversation
  async updateMemberNickname(
    conversationId: string,
    userId: string,
    targetUserId: string,
    nickname: string
  ) {
    const isInConversation = await this.isUserInConversation(conversationId, userId);
    if (!isInConversation) {
      throw new ForbiddenException('Bạn không phải thành viên của cuộc trò chuyện này');
    }

    return await this.conversationModel
      .findOneAndUpdate(
        { _id: conversationId, 'participants.user': targetUserId },
        { $set: { 'participants.$.nickname': nickname } },
        { new: true }
      )
      .populate('participants.user', 'firstName lastName username avatar')
      .exec();
  }

  // 3. Thay đổi tên nhóm (nickname của conversation)
  async updateGroupName(conversationId: string, userId: string, name: string) {
    const conversation = await this.conversationModel.findById(conversationId).select('type');
    if (!conversation) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
    }

    if (conversation.type !== 'GROUP') {
      throw new BadRequestException('Chỉ có thể đổi tên cho nhóm chat');
    }

    const isInConversation = await this.isUserInConversation(conversationId, userId);
    if (!isInConversation) {
      throw new ForbiddenException('Bạn không phải thành viên của nhóm này');
    }

    return await this.conversationModel
      .findByIdAndUpdate(conversationId, { $set: { nickname: name } }, { new: true })
      .exec();
  }

  // 4. Thay đổi avatar nhóm
  async updateGroupAvatar(conversationId: string, userId: string, avatarUrl: string) {
    const conversation = await this.conversationModel.findById(conversationId).select('type');
    if (!conversation) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
    }

    if (conversation.type !== 'GROUP') {
      throw new BadRequestException('Chỉ có thể đổi avatar cho nhóm chat');
    }

    const isInConversation = await this.isUserInConversation(conversationId, userId);
    if (!isInConversation) {
      throw new ForbiddenException('Bạn không phải thành viên của nhóm này');
    }

    return await this.conversationModel
      .findByIdAndUpdate(conversationId, { $set: { avatar: avatarUrl } }, { new: true })
      .exec();
  }

  // 5. Thêm thành viên vào nhóm
  async addMember(conversationId: string, requestUserId: string, newUserId: string) {
    // Validate ObjectId
    if (!Types.ObjectId.isValid(newUserId)) {
      throw new BadRequestException('ID người dùng không hợp lệ');
    }

    const conversation = await this.conversationModel
      .findById(conversationId)
      .select('type settings participants');
    if (!conversation) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
    }

    if (conversation.type !== 'GROUP') {
      throw new BadRequestException('Chỉ có thể thêm thành viên vào nhóm chat');
    }

    // Kiểm tra quyền thêm thành viên
    const isAdmin = await this.isUserAdmin(conversationId, requestUserId);
    const allowMembersToAdd = conversation.settings?.allowMembersToAdd ?? true;

    // Nếu không cho phép thành viên thêm và user không phải admin -> từ chối
    if (!allowMembersToAdd && !isAdmin) {
      throw new ForbiddenException('Chỉ quản trị viên mới có thể thêm thành viên');
    }

    // Kiểm tra người request có trong nhóm không (không bị kick và không tự rời)
    const isMember = conversation.participants.some(
      (p) => p.user.toString() === requestUserId && !p.kickedAt && !p.leftAt
    );
    if (!isMember) {
      throw new ForbiddenException('Bạn không phải thành viên của nhóm này');
    }

    // Kiểm tra user đã trong nhóm chưa (và chưa bị kick hoặc rời đi)
    const existingMember = conversation.participants.find((p) => p.user.toString() === newUserId);

    if (existingMember && !existingMember.kickedAt && !existingMember.leftAt) {
      throw new BadRequestException('Người dùng đã là thành viên của nhóm');
    }

    const newUserObjectId = new Types.ObjectId(newUserId);

    // Nếu từng bị kick hoặc tự rời, cho phép thêm lại
    if (existingMember && (existingMember.kickedAt || existingMember.leftAt)) {
      const updated = await this.conversationModel
        .findByIdAndUpdate(
          conversationId,
          {
            $set: {
              'participants.$[elem].kickedAt': null,
              'participants.$[elem].leftAt': null,
              'participants.$[elem].joinedAt': new Date(),
            },
          },
          {
            new: true,
            arrayFilters: [{ 'elem.user': newUserObjectId }],
          }
        )
        .populate(
          'participants.user',
          'firstName lastName username avatar status lastActive showActivityStatus'
        )
        .exec();
      return updated;
    }

    // Thêm thành viên mới
    const updated = await this.conversationModel
      .findByIdAndUpdate(
        conversationId,
        {
          $push: {
            participants: {
              user: newUserObjectId,
              joinedAt: new Date(),
              isAdmin: false,
              nickname: '',
            },
          },
        },
        { new: true }
      )
      .populate(
        'participants.user',
        'firstName lastName username avatar status lastActive showActivityStatus'
      )
      .exec();

    return updated;
  }

  // 6. Kick thành viên khỏi nhóm
  async removeMember(conversationId: string, adminUserId: string, targetUserId: string) {
    const conversation = await this.conversationModel
      .findById(conversationId)
      .select('type creator participants isDeleted');
    if (!conversation) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
    }

    if (conversation.type !== 'GROUP') {
      throw new BadRequestException('Chỉ có thể kick thành viên từ nhóm chat');
    }

    if (conversation.isDeleted) {
      throw new BadRequestException('Nhóm này đã bị giải tán');
    }

    const isAdmin = await this.isUserAdmin(conversationId, adminUserId);
    if (!isAdmin) {
      throw new ForbiddenException('Chỉ admin mới có thể kick thành viên');
    }

    // Không thể kick creator
    if (conversation.creator?.toString() === targetUserId) {
      throw new ForbiddenException('Không thể kick người tạo nhóm');
    }

    const targetObjectId = new Types.ObjectId(targetUserId);
    const unreadCountKey = `unreadCount.${targetObjectId.toString()}`;

    // Đếm số thành viên active còn lại SAU khi kick (loại người bị kick,
    // người đã tự rời và người đã bị kick trước đó) — cùng cách đếm với leaveGroup
    const remainingMembers = conversation.participants.filter(
      (p) => !p.kickedAt && !p.leftAt && p.user.toString() !== targetUserId
    );

    // Nếu sau khi kick còn dưới 3 thành viên active thì giải tán nhóm
    if (remainingMembers.length < 3) {
      // Giải tán nhóm: set isDeleted = true và kickedAt cho người bị kick
      const kickedAt = new Date();

      await this.conversationModel.findOneAndUpdate(
        { _id: conversationId, 'participants.user': targetObjectId },
        {
          $set: {
            'participants.$.kickedAt': kickedAt,
            isDeleted: true,
            deletedAt: kickedAt,
          },
          $unset: { [unreadCountKey]: 1 },
        }
      );

      return await this.conversationModel
        .findById(conversationId)
        .populate('participants.user', 'firstName lastName username avatar')
        .exec();
    }

    // Kick thành viên bằng cách set kickedAt thay vì xóa khỏi array
    const kickedAt = new Date();

    return await this.conversationModel
      .findOneAndUpdate(
        { _id: conversationId, 'participants.user': targetObjectId },
        {
          $set: { 'participants.$.kickedAt': kickedAt },
          $unset: { [unreadCountKey]: 1 },
        },
        { new: true }
      )
      .populate('participants.user', 'firstName lastName username avatar')
      .exec();
  }

  // 7. Phân quyền admin (tối đa 3 người)
  async updateAdminStatus(
    conversationId: string,
    adminUserId: string,
    targetUserId: string,
    isAdmin: boolean
  ) {
    const conversation = await this.conversationModel
      .findById(conversationId)
      .select('type creator participants');
    if (!conversation) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
    }

    if (conversation.type !== 'GROUP') {
      throw new BadRequestException('Chỉ có thể phân quyền trong nhóm chat');
    }

    const currentUserIsAdmin = await this.isUserAdmin(conversationId, adminUserId);
    if (!currentUserIsAdmin) {
      throw new ForbiddenException('Chỉ admin mới có thể phân quyền');
    }

    // Đếm số admin hiện tại
    if (isAdmin) {
      const currentAdminCount = conversation.participants.filter((p) => p.isAdmin).length;
      if (currentAdminCount >= 3) {
        throw new BadRequestException('Đã đạt giới hạn tối đa 3 admin');
      }
    }

    // Không thể tự bỏ quyền admin của creator
    if (!isAdmin && conversation.creator?.toString() === targetUserId) {
      throw new ForbiddenException('Không thể bỏ quyền admin của người tạo nhóm');
    }

    return await this.conversationModel
      .findOneAndUpdate(
        { _id: conversationId, 'participants.user': targetUserId },
        { $set: { 'participants.$.isAdmin': isAdmin } },
        { new: true }
      )
      .populate('participants.user', 'firstName lastName username avatar')
      .exec();
  }

  // 8. Rời nhóm - User tự rời, giữ lại lịch sử tin nhắn
  async leaveGroup(conversationId: string, userId: string) {
    const conversation = await this.conversationModel
      .findById(conversationId)
      .select('type creator participants');
    if (!conversation) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
    }

    if (conversation.type !== 'GROUP') {
      throw new BadRequestException('Chỉ có thể rời khỏi nhóm chat');
    }

    // Kiểm tra user có trong nhóm không
    const participant = conversation.participants.find(
      (p: any) => p.user.toString() === userId && !p.kickedAt && !p.leftAt
    );
    if (!participant) {
      throw new BadRequestException('Bạn không phải thành viên của nhóm này');
    }

    const userObjectId = new Types.ObjectId(userId);
    const leftAt = new Date();

    // Đếm số thành viên active còn lại (trừ người đang rời)
    const activeMembers = conversation.participants.filter(
      (p: any) => !p.kickedAt && !p.leftAt && p.user.toString() !== userId
    );

    // Nếu sau khi rời còn dưới 3 người thì giải tán nhóm
    if (activeMembers.length < 3) {
      // Giải tán nhóm
      return await this.conversationModel
        .findOneAndUpdate(
          { _id: conversationId, 'participants.user': userObjectId },
          {
            $set: {
              'participants.$.leftAt': leftAt,
              isDeleted: true,
              deletedAt: leftAt,
            },
            $unset: { [`unreadCount.${userId}`]: 1 },
          },
          { new: true }
        )
        .populate(
          'participants.user',
          'firstName lastName username avatar status lastActive showActivityStatus'
        )
        .exec();
    }

    // Nếu là creator, chuyển quyền cho người khác
    if (conversation.creator?.toString() === userId) {
      const otherAdmins: { user: { _id: string } }[] = activeMembers.filter(
        (p) => p.isAdmin
      ) as any;

      if (otherAdmins.length > 0) {
        // Chuyển creator cho admin đầu tiên
        await this.conversationModel.findByIdAndUpdate(conversationId, {
          $set: { creator: otherAdmins[0].user._id },
        });
      } else {
        // Nếu không có admin khác, chuyển cho thành viên đầu tiên và set làm admin
        const newCreator: { user: { _id: string } } = activeMembers[0] as any;
        await this.conversationModel.findOneAndUpdate(
          { _id: conversationId, 'participants.user': newCreator.user._id },
          {
            $set: {
              creator: newCreator.user._id,
              'participants.$.isAdmin': true,
            },
          }
        );
      }
    }

    // Set leftAt cho user (không xóa khỏi array để giữ lịch sử)
    return await this.conversationModel
      .findOneAndUpdate(
        { _id: conversationId, 'participants.user': userObjectId },
        {
          $set: { 'participants.$.leftAt': leftAt },
          $unset: { [`unreadCount.${userId}`]: 1 },
        },
        { new: true }
      )
      .populate(
        'participants.user',
        'firstName lastName username avatar status lastActive showActivityStatus'
      )
      .exec();
  }

  async updateSettings(conversationId: string, userId: string, settings: Record<string, any>) {
    const isInConversation = await this.isUserInConversation(conversationId, userId);
    if (!isInConversation) {
      throw new ForbiddenException('Bạn không phải thành viên của cuộc trò chuyện này');
    }
    const isAdmin = await this.isUserAdmin(conversationId, userId);
    if (!isAdmin) {
      throw new ForbiddenException('Chỉ quản trị viên mới có thể thay đổi cài đặt nhóm');
    }

    // Coerce through a strict whitelist; raw client objects are never persisted.
    const safeSettings = {
      allowMembersToAdd: settings?.allowMembersToAdd === true,
      onlyAdminCanChat: settings?.onlyAdminCanChat === true,
    };

    return await this.conversationModel
      .findByIdAndUpdate(
        conversationId,
        { $set: { settings: safeSettings } },
        { new: true }
      )
      .exec();
  }

  // Toggle mute notification cho user
  async toggleMuteNotification(
    conversationId: string,
    userId: string
  ): Promise<{ isMuted: boolean }> {
    const userObjectId = new Types.ObjectId(userId);
    const conversation = await this.conversationModel
      .findById(conversationId)
      .select('mutedBy');

    if (!conversation) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
    }

    const isInConversation = await this.isUserInConversation(conversationId, userId);
    if (!isInConversation) {
      throw new ForbiddenException('Bạn không phải thành viên của cuộc trò chuyện này');
    }

    // Check if user is already in mutedBy array
    const isMuted = conversation.mutedBy?.some((id) => id.toString() === userId);

    if (isMuted) {
      // Remove from mutedBy (unmute)
      await this.conversationModel.findByIdAndUpdate(conversationId, {
        $pull: { mutedBy: userObjectId },
      });
      return { isMuted: false };
    } else {
      // Add to mutedBy (mute)
      await this.conversationModel.findByIdAndUpdate(conversationId, {
        $addToSet: { mutedBy: userObjectId },
      });
      return { isMuted: true };
    }
  }

  // Check if user has muted conversation
  async isConversationMuted(conversationId: string, userId: string): Promise<boolean> {
    const conversation = await this.conversationModel
      .findById(conversationId)
      .select('mutedBy')
      .lean();
    if (!conversation) return false;
    return conversation.mutedBy?.some((id) => id.toString() === userId) ?? false;
  }
}
