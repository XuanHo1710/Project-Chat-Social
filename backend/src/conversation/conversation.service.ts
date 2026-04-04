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

  async create(createConversationDto: CreateConversationDto) {
    const converstation = await this.conversationModel.create(createConversationDto);
    return await converstation.save();
  }

  async findOrCreateDirectConversation(userId: string, targetUserId: string): Promise<any> {
    // Find existing DIRECT conversation between these two users
    const existing = await this.conversationModel.findOne({
      type: 'DIRECT',
      'participants.user': { $all: [new Types.ObjectId(userId), new Types.ObjectId(targetUserId)] },
      $expr: { $eq: [{ $size: '$participants' }, 2] },
    });

    if (existing) {
      return this.findById(existing._id.toString(), userId);
    }

    // Create new DIRECT conversation
    const newConv = new this.conversationModel({
      type: 'DIRECT',
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

    const saved = await newConv.save();
    return this.findById(saved._id.toString(), userId);
  }

  // Create a group chat with multiple members (minimum 3 people including creator)
  async createGroup(
    creatorId: string,
    memberIds: string[], // Array of user IDs to add to the group
    groupName?: string
  ): Promise<any> {
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
      ...memberIds.map((memberId) => ({
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
    return this.findById(saved._id.toString());
  }

  async findAll() {
    return await this.conversationModel.find().exec();
  }

  async findById(id: string, currentUserId?: string): Promise<any> {
    const conv = await this.conversationModel
      .findById(id)
      .populate(
        'participants.user',
        'firstName lastName username avatar status lastActive showActivityStatus'
      )
      .lean()
      .exec();

    if (!conv) return null;

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
    if (currentUserId && conv && conv.type === 'DIRECT' && participants.length === 2) {
      const blockedUsers = await this.relationshipService.getBlockedUsers(currentUserId);
      chatBlocked = await this.relationshipService.isUserBlocked(
        participants[0].user._id.toString(),
        participants[1].user._id.toString()
      );
      const blockedUserIds = blockedUsers.map((u: any) => u._id.toString());
      const otherParticipant = conv.participants.find(
        (p: any) => p.user._id.toString() !== currentUserId
      ) as any;
      if (otherParticipant) {
        const otherUserId = otherParticipant.user._id.toString();
        blockedByMe = blockedUserIds.includes(otherUserId);
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
    const conversations = await this.conversationModel
      .find({
        'participants.user': userId,
      })
      .populate(
        'participants.user',
        'firstName lastName username avatar status lastActive showActivityStatus'
      )
      .populate('lastMessage', 'content type createdAt senderId attachments callData')
      .sort({ lastMessageAt: -1 })
      .lean()
      .exec();

    // Remove duplicates by _id (in case of any DB issues)
    const uniqueConversations = conversations.filter(
      (conv, index, self) =>
        index === self.findIndex((c) => c._id.toString() === conv._id.toString())
    );

    // Get list of users blocked and restricted by current user
    const [blockedUsers, restrictedUsers] = await Promise.all([
      this.relationshipService.getBlockedUsers(userId),
      this.relationshipService.getRestrictedUsers(userId),
    ]);
    const blockedUserIds = blockedUsers.map((u: any) => u._id.toString());
    const restrictedUserIds = restrictedUsers.map((u: any) => u._id.toString());

    // Filter out DIRECT conversations where the other user is RESTRICTED by current user
    const filteredConversations = uniqueConversations.filter((conv: any) => {
      // Group conversations are always shown
      if (conv.type === 'GROUP') return true;

      // For DIRECT conversations, check if the other user is restricted by current user
      const otherParticipant = conv.participants.find((p: any) => p.user._id.toString() !== userId);
      if (!otherParticipant) return true;

      const otherUserId = otherParticipant.user._id.toString();

      // Hide conversation if current user RESTRICTED the other user
      return !restrictedUserIds.includes(otherUserId);
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
          blockedByMe = blockedUserIds.includes(otherUserId);
          conv['isRestricted'] = restrictedUsers.length > 0;
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
    });

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
    const conversation = await this.conversationModel.findById(conversationId);
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

  async update(id: string, updateConversationDto: UpdateConversationDto) {
    return await this.conversationModel
      .findByIdAndUpdate(id, updateConversationDto, { new: true })
      .exec();
  }

  async remove(id: string) {
    return await this.conversationModel.findByIdAndDelete(id).exec();
  }

  // ============ CHAT FEATURES ============

  // Kiểm tra user có phải admin không
  async isUserAdmin(conversationId: string, userId: string): Promise<boolean> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) return false;

    const participant = conversation.participants.find(
      (p) => p.user.toString() === userId && !p.kickedAt && !p.leftAt
    );
    return participant?.isAdmin ?? false;
  }

  // Kiểm tra user có trong conversation không (và chưa bị kick/rời)
  async isUserInConversation(conversationId: string, userId: string): Promise<boolean> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) return false;

    return conversation.participants.some(
      (p) => p.user.toString() === userId && !p.kickedAt && !p.leftAt
    );
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
    const conversation = await this.conversationModel.findById(conversationId);
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
    const conversation = await this.conversationModel.findById(conversationId);
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

    const conversation = await this.conversationModel.findById(conversationId);
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
    const conversation = await this.conversationModel.findById(conversationId);
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

    // Đếm số thành viên active (chưa bị kick)
    const activeMembers = conversation.participants.filter((p) => !p.kickedAt);

    // Nếu sau khi kick còn dưới 3 người thì giải tán nhóm
    if (activeMembers.length <= 3) {
      // Giải tán nhóm: set isDeleted = true và kickedAt cho tất cả thành viên còn lại (trừ admin kick)
      const kickedAt = new Date();

      // Set kickedAt cho người bị kick
      await this.conversationModel.findOneAndUpdate(
        { _id: conversationId, 'participants.user': new Types.ObjectId(targetUserId) },
        {
          $set: {
            'participants.$.kickedAt': kickedAt,
            isDeleted: true,
            deletedAt: kickedAt,
          },
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
        { _id: conversationId, 'participants.user': new Types.ObjectId(targetUserId) },
        { $set: { 'participants.$.kickedAt': kickedAt } },
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
    const conversation = await this.conversationModel.findById(conversationId);
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
      .populate('participants.user', 'firstName lastName');
    if (!conversation) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
    }

    if (conversation.type !== 'GROUP') {
      throw new BadRequestException('Chỉ có thể rời khỏi nhóm chat');
    }

    // Kiểm tra user có trong nhóm không
    const participant = conversation.participants.find(
      (p: any) => p.user._id.toString() === userId && !p.kickedAt && !p.leftAt
    );
    if (!participant) {
      throw new BadRequestException('Bạn không phải thành viên của nhóm này');
    }

    const userObjectId = new Types.ObjectId(userId);
    const leftAt = new Date();

    // Đếm số thành viên active còn lại (trừ người đang rời)
    const activeMembers = conversation.participants.filter(
      (p: any) => !p.kickedAt && !p.leftAt && p.user._id.toString() !== userId
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
        { $set: { 'participants.$.leftAt': leftAt } },
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
    return await this.conversationModel
      .findByIdAndUpdate(conversationId, { $set: { settings: { ...settings } } }, { new: true })
      .exec();
  }

  // Toggle mute notification cho user
  async toggleMuteNotification(
    conversationId: string,
    userId: string
  ): Promise<{ isMuted: boolean }> {
    const userObjectId = new Types.ObjectId(userId);
    const conversation = await this.conversationModel.findById(conversationId);

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
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) return false;
    return conversation.mutedBy?.some((id) => id.toString() === userId) ?? false;
  }
}
