import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Group, GroupDocument, GroupPrivacy, GroupVisibility } from './entities/group.entity';
import {
  GroupMember,
  GroupMemberDocument,
  GroupRole,
  MemberStatus,
} from './entities/group-member.entity';
import { CreateGroupDto, UpdateGroupDto } from './dto/group.dto';
import { NotificationService } from 'src/notification/notification.service';
import { NotificationEmitterService } from 'src/notification/notification-emitter.service';
import { Account, AccountDocument } from 'src/account/entities/account.entity';
import { GroupGateway } from './group.gateway';

export interface GroupAccountSummary {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  avatar?: string | null;
  username?: string;
  status?: string;
  lastActive?: Date;
}

type PopulatedGroup = Omit<Group, 'createdBy'> & {
  _id: Types.ObjectId;
  createdBy: GroupAccountSummary;
};

interface PopulatedGroupMembership {
  groupId: PopulatedGroup | null;
  role: GroupRole;
  joinedAt?: Date;
}

interface PopulatedAccountMembership {
  userId: GroupAccountSummary | null;
  role: GroupRole;
  joinedAt?: Date;
  createdAt?: Date;
}

@Injectable()
export class GroupService {
  constructor(
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(GroupMember.name) private groupMemberModel: Model<GroupMemberDocument>,
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    @Inject(forwardRef(() => NotificationService))
    private notificationService: NotificationService,
    private notificationEmitter: NotificationEmitterService,
    private groupGateway: GroupGateway
  ) {}

  private toObjectId(value: string, fieldName: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`${fieldName} is invalid`);
    }
    return new Types.ObjectId(value);
  }

  private normalizePagination(page: number, limit: number, maxLimit = 100) {
    const normalizedPage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
    const normalizedLimit = Number.isFinite(limit)
      ? Math.min(maxLimit, Math.max(1, Math.floor(limit)))
      : Math.min(20, maxLimit);
    return {
      page: normalizedPage,
      limit: normalizedLimit,
      skip: (normalizedPage - 1) * normalizedLimit,
    };
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 11000
    );
  }

  private async updateMemberCount(groupId: Types.ObjectId, delta: 1 | -1) {
    return this.groupModel
      .findOneAndUpdate(
        { _id: groupId, isActive: true },
        [
          {
            $set: {
              memberCount: {
                $max: [0, { $add: [{ $ifNull: ['$memberCount', 0] }, delta] }],
              },
            },
          },
        ],
        { new: true }
      )
      .select('memberCount name')
      .lean();
  }

  private async canListMembers(userId: string, groupId: Types.ObjectId): Promise<boolean> {
    const userObjectId = this.toObjectId(userId, 'userId');
    const [group, membership] = await Promise.all([
      this.groupModel.findOne({ _id: groupId, isActive: true }).select('privacy visibility').lean(),
      this.groupMemberModel
        .findOne({ groupId, userId: userObjectId, status: MemberStatus.APPROVED })
        .select('_id')
        .lean(),
    ]);
    if (!group) throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y nhÃ³m');
    return (
      !!membership ||
      (group.privacy === GroupPrivacy.PUBLIC && group.visibility === GroupVisibility.VISIBLE)
    );
  }

  // ==================== GROUP CRUD ====================

  async createGroup(userId: string, dto: CreateGroupDto) {
    const creatorId = this.toObjectId(userId, 'userId');
    const group = new this.groupModel({
      name: dto.name.trim(),
      description: dto.description?.trim() ?? '',
      privacy: dto.privacy ?? GroupPrivacy.PUBLIC,
      visibility: dto.visibility ?? GroupVisibility.VISIBLE,
      location: dto.location?.trim() || null,
      avatar: dto.avatar?.trim() || null,
      coverImage: dto.coverImage?.trim() || null,
      createdBy: creatorId,
      memberCount: 1, // Creator is first member
    });
    await group.save();

    try {
      await this.groupMemberModel.create({
        groupId: group._id,
        userId: creatorId,
        role: GroupRole.ADMIN,
        status: MemberStatus.APPROVED,
        joinedAt: new Date(),
      });
    } catch (error) {
      await this.groupModel.deleteOne({ _id: group._id });
      throw error;
    }

    return group;
  }

  async updateGroup(userId: string, groupId: string, dto: UpdateGroupDto) {
    const groupObjectId = this.toObjectId(groupId, 'groupId');
    const userObjectId = this.toObjectId(userId, 'userId');
    const group = await this.groupModel.findOne({ _id: groupObjectId, isActive: true });
    if (!group) {
      throw new NotFoundException('Không tìm thấy nhóm');
    }

    // Check if user is admin
    const member = await this.groupMemberModel.exists({
      groupId: groupObjectId,
      userId: userObjectId,
      role: GroupRole.ADMIN,
      status: MemberStatus.APPROVED,
    });

    if (!member) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa nhóm này');
    }

    if (dto.name !== undefined) group.name = dto.name.trim();
    if (dto.description !== undefined) group.description = dto.description.trim();
    if (dto.privacy !== undefined) group.privacy = dto.privacy;
    if (dto.visibility !== undefined) group.visibility = dto.visibility;
    if (dto.location !== undefined) group.location = dto.location.trim();
    if (dto.avatar !== undefined) group.avatar = dto.avatar.trim();
    if (dto.coverImage !== undefined) group.coverImage = dto.coverImage.trim();
    if (dto.rules !== undefined) group.rules = dto.rules.map((rule) => rule.trim());
    await group.save();

    // Emit socket event for group settings update
    this.groupGateway.emitGroupSettingsUpdate(groupId, {
      name: group.name,
      description: group.description,
      privacy: group.privacy,
      visibility: group.visibility,
      avatar: group.avatar,
      coverImage: group.coverImage,
    });

    return group;
  }

  async deleteGroup(userId: string, groupId: string) {
    const groupObjectId = this.toObjectId(groupId, 'groupId');
    const group = await this.groupModel.findOne({ _id: groupObjectId, isActive: true });
    if (!group) {
      throw new NotFoundException('Không tìm thấy nhóm');
    }

    // Only creator can delete
    if (group.createdBy.toString() !== userId) {
      throw new ForbiddenException('Chỉ người tạo nhóm mới có thể xóa');
    }

    // Soft delete the group
    group.isActive = false;
    await group.save();

    // Make the resource inaccessible first; cleanup cannot expose a deleted group.
    await this.groupMemberModel.deleteMany({ groupId: groupObjectId });

    return { message: 'Đã xóa nhóm' };
  }

  async getGroupById(groupId: string, userId?: string): Promise<any> {
    const groupObjectId = this.toObjectId(groupId, 'groupId');
    const group = await this.groupModel
      .findOne({ _id: groupObjectId, isActive: true })
      .populate('createdBy', 'firstName lastName avatar username')
      .lean();

    if (!group) {
      throw new NotFoundException('Không tìm thấy nhóm');
    }

    // Check membership
    const membership = userId
      ? await this.groupMemberModel
          .findOne({
            groupId: groupObjectId,
            userId: this.toObjectId(userId, 'userId'),
          })
          .lean()
      : null;
    const isApprovedMember = membership?.status === MemberStatus.APPROVED;

    // Private or hidden group metadata is limited to approved members.
    if (
      !isApprovedMember &&
      (group.privacy === GroupPrivacy.PRIVATE || group.visibility === GroupVisibility.HIDDEN)
    ) {
      return {
        _id: group._id,
        name: group.name,
        coverImage: group.coverImage,
        privacy: group.privacy,
        memberCount: group.memberCount,
        isMember: false,
        isPending: membership?.status === MemberStatus.PENDING,
      };
    }

    return {
      ...group,
      isMember: isApprovedMember,
      isPending: membership?.status === MemberStatus.PENDING,
      myRole: membership?.role || null,
    };
  }

  async searchGroups(query: string, userId: string, page = 1, limit = 20): Promise<any> {
    const userObjectId = this.toObjectId(userId, 'userId');
    const pagination = this.normalizePagination(page, limit, 50);
    const searchTerm = query.trim();
    if (searchTerm.length > 100) {
      throw new BadRequestException('Search query is too long');
    }

    const memberships = await this.groupMemberModel
      .find({
        userId: userObjectId,
      })
      .select('groupId status role')
      .lean();
    const membershipMap = new Map(memberships.map((m) => [m.groupId.toString(), m]));
    const approvedGroupIds = memberships
      .filter((membership) => membership.status === MemberStatus.APPROVED)
      .map((membership) => membership.groupId);
    const filters: FilterQuery<GroupDocument> = {
      isActive: true,
      $and: [
        {
          $or: [{ visibility: GroupVisibility.VISIBLE }, { _id: { $in: approvedGroupIds } }],
        },
      ],
    };
    if (searchTerm) filters.$text = { $search: searchTerm };

    let groupsQuery = this.groupModel
      .find(filters)
      .populate('createdBy', 'firstName lastName avatar')
      .skip(pagination.skip)
      .limit(pagination.limit);
    groupsQuery = searchTerm
      ? groupsQuery
          .select({ score: { $meta: 'textScore' } })
          .sort({ score: { $meta: 'textScore' } })
      : groupsQuery.sort({ memberCount: -1, createdAt: -1 });
    const groups = await groupsQuery.lean();

    return groups.map((group) => {
      const membership = membershipMap.get(group._id.toString());
      return {
        ...group,
        isMember: membership?.status === MemberStatus.APPROVED,
        isPending: membership?.status === MemberStatus.PENDING,
      };
    });
  }

  async getMyGroups(userId: string) {
    const userObjectId = this.toObjectId(userId, 'userId');
    const memberships = (await this.groupMemberModel
      .find({
        userId: userObjectId,
        status: MemberStatus.APPROVED,
      })
      .populate({
        path: 'groupId',
        match: { isActive: true },
        populate: { path: 'createdBy', select: 'firstName lastName avatar' },
      })
      .lean()) as unknown as PopulatedGroupMembership[];

    return memberships
      .filter(
        (membership): membership is PopulatedGroupMembership & { groupId: PopulatedGroup } =>
          membership.groupId !== null
      )
      .map((membership) => ({
        ...membership.groupId,
        myRole: membership.role,
        joinedAt: membership.joinedAt,
      }));
  }

  async getSuggestedGroups(userId: string, limit = 10): Promise<any> {
    const userObjectId = this.toObjectId(userId, 'userId');
    const normalizedLimit = this.normalizePagination(1, limit, 50).limit;
    // Get groups user is NOT an approved member of
    const myApprovedMemberships = await this.groupMemberModel
      .find({
        userId: userObjectId,
        status: MemberStatus.APPROVED,
      })
      .select('groupId')
      .lean();

    const myGroupIds = myApprovedMemberships.map((m) => m.groupId);

    const groups = await this.groupModel
      .find({
        _id: { $nin: myGroupIds },
        isActive: true,
        privacy: GroupPrivacy.PUBLIC,
        visibility: GroupVisibility.VISIBLE,
      })
      .populate('createdBy', 'firstName lastName avatar')
      .sort({ memberCount: -1 }) // Sort by popularity
      .limit(normalizedLimit)
      .lean();

    // Add pending status for each group
    const groupIds = groups.map((g) => g._id);
    const pendingMemberships = await this.groupMemberModel
      .find({
        groupId: { $in: groupIds },
        userId: userObjectId,
        status: MemberStatus.PENDING,
      })
      .lean();

    const pendingMap = new Map(pendingMemberships.map((m) => [m.groupId.toString(), true]));

    return groups.map((group) => ({
      ...group,
      isPending: pendingMap.has(group._id.toString()),
    }));
  }

  // ==================== MEMBERSHIP ====================

  async joinGroup(userId: string, groupId: string) {
    const groupObjectId = this.toObjectId(groupId, 'groupId');
    const userObjectId = this.toObjectId(userId, 'userId');
    const group = await this.groupModel.findOne({
      _id: groupObjectId,
      isActive: true,
    });

    if (!group) {
      throw new NotFoundException('Không tìm thấy nhóm');
    }

    // Check if already a member
    const existingMember = await this.groupMemberModel.findOne({
      groupId: groupObjectId,
      userId: userObjectId,
    });

    if (existingMember) {
      if (existingMember.status === MemberStatus.APPROVED) {
        throw new BadRequestException('Bạn đã là thành viên của nhóm này');
      }
      if (existingMember.status === MemberStatus.PENDING) {
        throw new BadRequestException('Yêu cầu tham gia đang chờ duyệt');
      }
      if (existingMember.status === MemberStatus.BANNED) {
        throw new ForbiddenException('Bạn đã bị cấm khỏi nhóm này');
      }
    }

    // Create membership
    const status =
      group.privacy === GroupPrivacy.PRIVATE ? MemberStatus.PENDING : MemberStatus.APPROVED;

    const member = new this.groupMemberModel({
      groupId: groupObjectId,
      userId: userObjectId,
      role: GroupRole.MEMBER,
      status,
      joinedAt: status === MemberStatus.APPROVED ? new Date() : null,
    });
    try {
      await member.save();
    } catch (error: unknown) {
      if (this.isDuplicateKeyError(error)) {
        throw new BadRequestException('Membership already exists');
      }
      throw error;
    }

    // Update member count if approved
    if (status === MemberStatus.APPROVED) {
      const updatedGroup = await this.updateMemberCount(groupObjectId, 1);
      if (!updatedGroup) {
        await this.groupMemberModel.deleteOne({ _id: member._id });
        throw new NotFoundException('Group not found');
      }
      this.groupGateway.emitMemberCountUpdate(groupId, updatedGroup.memberCount);

      const newMemberInfo = await this.accountModel
        .findOne({ _id: userObjectId, isActive: { $ne: false }, isDeleted: false })
        .select('firstName lastName avatar')
        .lean();
      if (newMemberInfo) {
        this.groupGateway.emitNewMember(groupId, {
          _id: userId,
          firstName: newMemberInfo.firstName,
          lastName: newMemberInfo.lastName,
          avatar: newMemberInfo.avatar,
          role: GroupRole.MEMBER,
        });
      }
    } else if (!(await this.groupModel.exists({ _id: groupObjectId, isActive: true }))) {
      await this.groupMemberModel.deleteOne({ _id: member._id });
      throw new NotFoundException('Group not found');
    }

    return {
      message:
        status === MemberStatus.PENDING ? 'Yêu cầu tham gia đã được gửi' : 'Đã tham gia nhóm',
      status,
    };
  }

  async leaveGroup(userId: string, groupId: string) {
    const groupObjectId = this.toObjectId(groupId, 'groupId');
    const userObjectId = this.toObjectId(userId, 'userId');
    const member = await this.groupMemberModel.findOne({
      groupId: groupObjectId,
      userId: userObjectId,
      status: MemberStatus.APPROVED,
    });

    if (!member) {
      throw new NotFoundException('Bạn không phải thành viên của nhóm này');
    }

    const group = await this.groupModel
      .findOne({ _id: groupObjectId, isActive: true })
      .select('createdBy');
    if (!group) throw new NotFoundException('Group not found');
    if (group.createdBy.toString() === userId) {
      throw new BadRequestException('Transfer ownership or delete the group before leaving');
    }

    // Check if user is the only admin
    if (member.role === GroupRole.ADMIN) {
      const adminCount = await this.groupMemberModel.countDocuments({
        groupId: groupObjectId,
        role: GroupRole.ADMIN,
        status: MemberStatus.APPROVED,
      });

      if (adminCount === 1) {
        // Check if there are other members
        const memberCount = await this.groupMemberModel.countDocuments({
          groupId: groupObjectId,
          status: MemberStatus.APPROVED,
        });

        if (memberCount > 1) {
          throw new BadRequestException('Bạn cần chỉ định admin khác trước khi rời nhóm');
        }
      }
    }

    const removal = await this.groupMemberModel.deleteOne({
      _id: member._id,
      status: MemberStatus.APPROVED,
    });
    if (removal.deletedCount === 0) {
      throw new BadRequestException('Membership was already changed');
    }

    const updatedGroup = await this.updateMemberCount(groupObjectId, -1);
    if (updatedGroup) {
      this.groupGateway.emitMemberCountUpdate(groupId, updatedGroup.memberCount);
      this.groupGateway.emitMemberLeft(groupId, userId);
    }

    return { message: 'Đã rời khỏi nhóm' };
  }

  async cancelJoinRequest(userId: string, groupId: string) {
    const groupObjectId = this.toObjectId(groupId, 'groupId');
    const userObjectId = this.toObjectId(userId, 'userId');
    const result = await this.groupMemberModel.deleteOne({
      groupId: groupObjectId,
      userId: userObjectId,
      status: MemberStatus.PENDING,
      invitedBy: null,
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Không tìm thấy yêu cầu tham gia');
    }

    // Chỉnh thông báo nếu có
    await this.notificationService.respondGroupInvitationRequest(userId, groupId, 'REJECTED');

    return { message: 'Đã hủy yêu cầu tham gia' };
  }

  async getMembers(userId: string, groupId: string, page = 1, limit = 20) {
    const groupObjectId = this.toObjectId(groupId, 'groupId');
    if (!(await this.canListMembers(userId, groupObjectId))) {
      throw new ForbiddenException('Báº¡n khÃ´ng cÃ³ quyá»n xem danh sÃ¡ch thÃ nh viÃªn');
    }
    const pagination = this.normalizePagination(page, limit, 100);

    const memberFilter = { groupId: groupObjectId, status: MemberStatus.APPROVED };
    const [rawMembers, total] = await Promise.all([
      this.groupMemberModel
        .find(memberFilter)
        .populate('userId', 'firstName lastName avatar username status lastActive')
        .sort({ role: 1, joinedAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      this.groupMemberModel.countDocuments(memberFilter),
    ]);
    const members = rawMembers as unknown as PopulatedAccountMembership[];

    return {
      members: members
        .filter(
          (
            membership
          ): membership is PopulatedAccountMembership & {
            userId: GroupAccountSummary;
          } => membership.userId !== null
        )
        .map((membership) => ({
          ...membership.userId,
          role: membership.role,
          joinedAt: membership.joinedAt,
        })),
      total,
      page: pagination.page,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async getPendingMembers(userId: string, groupId: string, page = 1, limit = 20) {
    const groupObjectId = this.toObjectId(groupId, 'groupId');
    const userObjectId = this.toObjectId(userId, 'userId');
    // Check if user is admin or moderator
    const member = await this.groupMemberModel.exists({
      groupId: groupObjectId,
      userId: userObjectId,
      role: { $in: [GroupRole.ADMIN, GroupRole.MODERATOR] },
      status: MemberStatus.APPROVED,
    });

    if (!member) {
      throw new ForbiddenException('Bạn không có quyền xem danh sách chờ duyệt');
    }

    const pagination = this.normalizePagination(page, limit, 100);
    const pendingFilter = { groupId: groupObjectId, status: MemberStatus.PENDING };
    const [rawPendingMembers, total] = await Promise.all([
      this.groupMemberModel
        .find(pendingFilter)
        .populate('userId', 'firstName lastName avatar username')
        .sort({ createdAt: 1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      this.groupMemberModel.countDocuments(pendingFilter),
    ]);
    const pendingMembers = rawPendingMembers as unknown as PopulatedAccountMembership[];

    return {
      members: pendingMembers
        .filter(
          (
            membership
          ): membership is PopulatedAccountMembership & {
            userId: GroupAccountSummary;
          } => membership.userId !== null
        )
        .map((membership) => ({
          ...membership.userId,
          requestedAt: membership.createdAt,
        })),
      total,
      page: pagination.page,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async approveMember(userId: string, groupId: string, targetUserId: string) {
    const groupObjectId = this.toObjectId(groupId, 'groupId');
    const userObjectId = this.toObjectId(userId, 'userId');
    const targetObjectId = this.toObjectId(targetUserId, 'targetUserId');
    // Check if user is admin or moderator
    const member = await this.groupMemberModel.exists({
      groupId: groupObjectId,
      userId: userObjectId,
      role: { $in: [GroupRole.ADMIN, GroupRole.MODERATOR] },
      status: MemberStatus.APPROVED,
    });

    if (!member) {
      throw new ForbiddenException('Bạn không có quyền duyệt thành viên');
    }

    const joinedAt = new Date();
    const targetMember = await this.groupMemberModel.findOneAndUpdate(
      {
        groupId: groupObjectId,
        userId: targetObjectId,
        status: MemberStatus.PENDING,
      },
      {
        $set: {
          status: MemberStatus.APPROVED,
          approvedBy: userObjectId,
          joinedAt,
        },
      },
      { new: true }
    );

    if (!targetMember) {
      throw new NotFoundException('Không tìm thấy yêu cầu tham gia');
    }

    const group = await this.updateMemberCount(groupObjectId, 1);
    if (!group) {
      await this.groupMemberModel.updateOne(
        { _id: targetMember._id, status: MemberStatus.APPROVED, approvedBy: userObjectId },
        { $set: { status: MemberStatus.PENDING, approvedBy: null, joinedAt: null } }
      );
      throw new NotFoundException('Group not found');
    }

    // Send notification approved via RabbitMQ
    if (group) {
      await this.notificationEmitter.emitGroupRequestApproved(
        targetUserId,
        userId,
        groupId,
        group.name
      );

      // Emit new member event
      const newMemberInfo = await this.accountModel
        .findOne({ _id: targetObjectId, isActive: { $ne: false }, isDeleted: false })
        .select('firstName lastName avatar')
        .lean();
      if (newMemberInfo) {
        this.groupGateway.emitMemberCountUpdate(groupId, group.memberCount);
        this.groupGateway.emitNewMember(groupId, {
          _id: targetUserId,
          firstName: newMemberInfo.firstName,
          lastName: newMemberInfo.lastName,
          avatar: newMemberInfo.avatar,
          role: GroupRole.MEMBER,
        });
      }
    }

    return { message: 'Đã duyệt thành viên' };
  }

  async rejectMember(userId: string, groupId: string, targetUserId: string) {
    const groupObjectId = this.toObjectId(groupId, 'groupId');
    const userObjectId = this.toObjectId(userId, 'userId');
    const targetObjectId = this.toObjectId(targetUserId, 'targetUserId');
    // Check if user is admin or moderator
    const member = await this.groupMemberModel.exists({
      groupId: groupObjectId,
      userId: userObjectId,
      role: { $in: [GroupRole.ADMIN, GroupRole.MODERATOR] },
      status: MemberStatus.APPROVED,
    });

    if (!member) {
      throw new ForbiddenException('Bạn không có quyền từ chối thành viên');
    }

    const result = await this.groupMemberModel.deleteOne({
      groupId: groupObjectId,
      userId: targetObjectId,
      status: MemberStatus.PENDING,
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Không tìm thấy yêu cầu tham gia');
    }

    // Send notification rejected via RabbitMQ
    const group = await this.groupModel
      .findOne({ _id: groupObjectId, isActive: true })
      .select('name');
    if (group) {
      await this.notificationEmitter.emitGroupRequestRejected(
        targetUserId,
        userId,
        groupId,
        group.name
      );
    }

    return { message: 'Đã từ chối yêu cầu tham gia' };
  }

  async removeMember(userId: string, groupId: string, targetUserId: string) {
    const groupObjectId = this.toObjectId(groupId, 'groupId');
    const userObjectId = this.toObjectId(userId, 'userId');
    const targetObjectId = this.toObjectId(targetUserId, 'targetUserId');
    // Check if user is admin
    const member = await this.groupMemberModel.exists({
      groupId: groupObjectId,
      userId: userObjectId,
      role: GroupRole.ADMIN,
      status: MemberStatus.APPROVED,
    });

    if (!member) {
      throw new ForbiddenException('Chỉ admin mới có thể xóa thành viên');
    }

    // Cannot remove yourself this way
    if (userId === targetUserId) {
      throw new BadRequestException('Sử dụng chức năng rời nhóm để rời khỏi nhóm');
    }

    const targetMember = await this.groupMemberModel.findOne({
      groupId: groupObjectId,
      userId: targetObjectId,
      status: MemberStatus.APPROVED,
    });

    if (!targetMember) {
      throw new NotFoundException('Không tìm thấy thành viên');
    }

    // Cannot remove other admins unless you are creator
    const group = await this.groupModel
      .findOne({ _id: groupObjectId, isActive: true })
      .select('createdBy');
    if (targetMember.role === GroupRole.ADMIN && group && group.createdBy.toString() !== userId) {
      throw new ForbiddenException('Chỉ người tạo nhóm mới có thể xóa admin khác');
    }

    const removal = await this.groupMemberModel.deleteOne({
      _id: targetMember._id,
      status: MemberStatus.APPROVED,
    });
    if (removal.deletedCount === 0) {
      throw new BadRequestException('Membership was already changed');
    }
    const updatedGroup = await this.updateMemberCount(groupObjectId, -1);
    if (updatedGroup) {
      this.groupGateway.emitMemberCountUpdate(groupId, updatedGroup.memberCount);
      this.groupGateway.emitMemberLeft(groupId, targetUserId);
    }

    return { message: 'Đã xóa thành viên' };
  }

  async updateMemberRole(
    userId: string,
    groupId: string,
    targetUserId: string,
    newRole: GroupRole
  ) {
    const groupObjectId = this.toObjectId(groupId, 'groupId');
    const userObjectId = this.toObjectId(userId, 'userId');
    const targetObjectId = this.toObjectId(targetUserId, 'targetUserId');
    if (!Object.values(GroupRole).includes(newRole)) {
      throw new BadRequestException('Invalid group role');
    }
    // Check if user is admin
    const member = await this.groupMemberModel.exists({
      groupId: groupObjectId,
      userId: userObjectId,
      role: GroupRole.ADMIN,
      status: MemberStatus.APPROVED,
    });

    if (!member) {
      throw new ForbiddenException('Chỉ admin mới có thể thay đổi vai trò');
    }

    const targetMember = await this.groupMemberModel.findOne({
      groupId: groupObjectId,
      userId: targetObjectId,
      status: MemberStatus.APPROVED,
    });

    if (!targetMember) {
      throw new NotFoundException('Không tìm thấy thành viên');
    }

    // Only creator can change admin roles
    const group = await this.groupModel
      .findOne({ _id: groupObjectId, isActive: true })
      .select('createdBy name');
    if (!group) throw new NotFoundException('Group not found');
    if (group.createdBy.toString() === targetUserId && newRole !== GroupRole.ADMIN) {
      throw new BadRequestException('Transfer ownership before changing the owner role');
    }
    if (
      (targetMember.role === GroupRole.ADMIN || newRole === GroupRole.ADMIN) &&
      group.createdBy.toString() !== userId
    ) {
      throw new ForbiddenException('Chỉ người tạo nhóm mới có thể thay đổi vai trò admin');
    }

    const oldRole = targetMember.role;
    if (oldRole !== newRole) {
      await this.groupMemberModel.updateOne(
        { _id: targetMember._id, role: oldRole, status: MemberStatus.APPROVED },
        { $set: { role: newRole } }
      );
    }

    // Send notification about role change via RabbitMQ
    if (oldRole !== newRole) {
      const roleNames: Record<string, string> = {
        ADMIN: 'Quản trị viên',
        MODERATOR: 'Người kiểm duyệt',
        MEMBER: 'Thành viên',
      };

      await this.notificationEmitter.emitGroupRoleChanged(
        targetUserId,
        userId,
        groupId,
        newRole,
        roleNames[newRole] || newRole,
        group.name
      );

      // Emit socket event for role update
      this.groupGateway.emitRoleUpdate(groupId, targetUserId, newRole, userId);
    }

    return { message: 'Đã cập nhật vai trò' };
  }

  // ==================== HELPER METHODS ====================

  async isMember(userId: string, groupId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(groupId)) return false;
    const member = await this.groupMemberModel.exists({
      groupId: new Types.ObjectId(groupId),
      userId: new Types.ObjectId(userId),
      status: MemberStatus.APPROVED,
    });
    return !!member;
  }

  async getAccessibleGroupIds(userId: string): Promise<string[]> {
    if (!Types.ObjectId.isValid(userId)) return [];
    const memberships = await this.groupMemberModel
      .find({ userId: new Types.ObjectId(userId), status: MemberStatus.APPROVED })
      .select('groupId')
      .lean();
    const groups = await this.groupModel
      .find({
        isActive: true,
        $or: [
          { privacy: GroupPrivacy.PUBLIC },
          { _id: { $in: memberships.map((membership) => membership.groupId) } },
        ],
      })
      .select('_id')
      .lean();
    return groups.map((group) => group._id.toString());
  }

  async canViewGroupContent(userId: string, groupId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(groupId)) return false;
    const group = await this.groupModel
      .findOne({ _id: groupId, isActive: true })
      .select('privacy')
      .lean();
    if (!group) return false;
    return group.privacy === GroupPrivacy.PUBLIC || this.isMember(userId, groupId);
  }

  async getMemberRole(userId: string, groupId: string): Promise<GroupRole | null> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(groupId)) return null;
    const member = await this.groupMemberModel.findOne({
      groupId: new Types.ObjectId(groupId),
      userId: new Types.ObjectId(userId),
      status: MemberStatus.APPROVED,
    });
    return member?.role || null;
  }

  async incrementPostCount(groupId: string) {
    if (!Types.ObjectId.isValid(groupId)) throw new BadRequestException('groupId is invalid');
    await this.groupModel.updateOne(
      { _id: new Types.ObjectId(groupId), isActive: true },
      { $inc: { postCount: 1 } }
    );
  }

  async decrementPostCount(groupId: string) {
    if (!Types.ObjectId.isValid(groupId)) throw new BadRequestException('groupId is invalid');
    await this.groupModel.updateOne({ _id: new Types.ObjectId(groupId), isActive: true }, [
      { $set: { postCount: { $max: [0, { $subtract: [{ $ifNull: ['$postCount', 0] }, 1] }] } } },
    ]);
  }

  // Get members for avatar display (top members)
  async getTopMembers(userId: string, groupId: string, limit = 12) {
    const groupObjectId = this.toObjectId(groupId, 'groupId');
    if (!(await this.canListMembers(userId, groupObjectId))) {
      throw new ForbiddenException('Báº¡n khÃ´ng cÃ³ quyá»n xem danh sÃ¡ch thÃ nh viÃªn');
    }
    const normalizedLimit = this.normalizePagination(1, limit, 50).limit;
    const members = (await this.groupMemberModel
      .find({
        groupId: groupObjectId,
        status: MemberStatus.APPROVED,
      })
      .populate('userId', 'firstName lastName avatar')
      .sort({ role: 1, joinedAt: 1 })
      .limit(normalizedLimit)
      .lean()) as unknown as PopulatedAccountMembership[];

    return members
      .map((membership) => membership.userId)
      .filter((user): user is GroupAccountSummary => user !== null);
  }

  // Invite friend to group
  async inviteMember(userId: string, groupId: string, targetUserId: string) {
    const groupObjectId = this.toObjectId(groupId, 'groupId');
    const userObjectId = this.toObjectId(userId, 'userId');
    const targetObjectId = this.toObjectId(targetUserId, 'targetUserId');
    // Check if user is a member
    const member = await this.groupMemberModel.exists({
      groupId: groupObjectId,
      userId: userObjectId,
      status: MemberStatus.APPROVED,
    });

    if (!member) {
      throw new ForbiddenException('Bạn cần là thành viên để mời người khác');
    }

    // Check if target is already member or pending
    const existingMember = await this.groupMemberModel.findOne({
      groupId: groupObjectId,
      userId: targetObjectId,
    });

    if (existingMember) {
      if (existingMember.status === MemberStatus.APPROVED) {
        throw new BadRequestException('Người này đã là thành viên');
      }
      throw new BadRequestException('Đã có yêu cầu tham gia từ người này');
    }

    // Get inviter and group info for notification
    const [inviter, target, group] = await Promise.all([
      this.accountModel.findById(userObjectId).select('firstName lastName').lean(),
      this.accountModel
        .findOne({ _id: targetObjectId, isActive: true, isDeleted: false })
        .select('_id')
        .lean(),
      this.groupModel.findOne({ _id: groupObjectId, isActive: true }).select('name').lean(),
    ]);
    if (!target) throw new NotFoundException('Target account not found');
    if (!group) throw new NotFoundException('Group not found');

    // Create pending membership with invite
    const newMember = new this.groupMemberModel({
      groupId: groupObjectId,
      userId: targetObjectId,
      role: GroupRole.MEMBER,
      status: MemberStatus.PENDING,
      invitedBy: userObjectId,
    });
    try {
      await newMember.save();
    } catch (error: unknown) {
      if (this.isDuplicateKeyError(error)) {
        throw new BadRequestException('Membership already exists');
      }
      throw error;
    }

    // Send notification to invited user via RabbitMQ
    if (inviter) {
      const inviterName = `${inviter.firstName} ${inviter.lastName}`;
      await this.notificationEmitter.emitGroupInvitation(
        targetUserId,
        userId,
        groupId,
        inviterName,
        group.name
      );
    }

    return { message: 'Đã gửi lời mời' };
  }

  // Accept group invitation (called from notification response)
  async acceptInvitation(userId: string, groupId: string) {
    const groupObjectId = this.toObjectId(groupId, 'groupId');
    const userObjectId = this.toObjectId(userId, 'userId');
    const member = await this.groupMemberModel.findOneAndUpdate(
      {
        groupId: groupObjectId,
        userId: userObjectId,
        status: MemberStatus.PENDING,
        invitedBy: { $ne: null },
      },
      { $set: { status: MemberStatus.APPROVED, joinedAt: new Date() } },
      { new: true }
    );

    if (!member) {
      throw new NotFoundException('Không tìm thấy lời mời');
    }

    const group = await this.updateMemberCount(groupObjectId, 1);
    if (!group) {
      await this.groupMemberModel.updateOne(
        { _id: member._id, status: MemberStatus.APPROVED },
        { $set: { status: MemberStatus.PENDING, joinedAt: null } }
      );
      throw new NotFoundException('Group not found');
    }
    this.groupGateway.emitMemberCountUpdate(groupId, group.memberCount);

    return { message: 'Đã tham gia nhóm' };
  }

  // Reject group invitation (called from notification response)
  async rejectInvitation(userId: string, groupId: string) {
    const groupObjectId = this.toObjectId(groupId, 'groupId');
    const userObjectId = this.toObjectId(userId, 'userId');
    const result = await this.groupMemberModel.deleteOne({
      groupId: groupObjectId,
      userId: userObjectId,
      status: MemberStatus.PENDING,
      invitedBy: { $ne: null },
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Không tìm thấy lời mời');
    }

    return { message: 'Đã từ chối lời mời' };
  }

  // Transfer group ownership
  async transferOwnership(userId: string, groupId: string, newOwnerId: string) {
    const groupObjectId = this.toObjectId(groupId, 'groupId');
    const userObjectId = this.toObjectId(userId, 'userId');
    const newOwnerObjectId = this.toObjectId(newOwnerId, 'newOwnerId');
    if (userId === newOwnerId) throw new BadRequestException('User already owns this group');
    const group = await this.groupModel.findOne({ _id: groupObjectId, isActive: true });
    if (!group) {
      throw new NotFoundException('Không tìm thấy nhóm');
    }

    // Only creator can transfer ownership
    if (group.createdBy.toString() !== userId) {
      throw new ForbiddenException('Chỉ người tạo nhóm mới có thể nhượng quyền');
    }

    // Check if new owner is a member
    const newOwnerMember = await this.groupMemberModel.findOne({
      groupId: groupObjectId,
      userId: newOwnerObjectId,
      status: MemberStatus.APPROVED,
    });

    if (!newOwnerMember) {
      throw new BadRequestException('Người được chọn phải là thành viên của nhóm');
    }

    const oldOwnerMember = await this.groupMemberModel.findOne({
      groupId: groupObjectId,
      userId: userObjectId,
      status: MemberStatus.APPROVED,
    });
    if (!oldOwnerMember) throw new BadRequestException('Current owner membership is invalid');
    const previousNewOwnerRole = newOwnerMember.role;
    const previousOldOwnerRole = oldOwnerMember.role;

    await this.groupMemberModel.bulkWrite([
      {
        updateOne: {
          filter: { _id: newOwnerMember._id, status: MemberStatus.APPROVED },
          update: { $set: { role: GroupRole.ADMIN } },
        },
      },
      {
        updateOne: {
          filter: { _id: oldOwnerMember._id, status: MemberStatus.APPROVED },
          update: { $set: { role: GroupRole.MEMBER } },
        },
      },
    ]);

    const ownershipUpdate = await this.groupModel.updateOne(
      { _id: groupObjectId, createdBy: userObjectId, isActive: true },
      { $set: { createdBy: newOwnerObjectId } }
    );
    if (ownershipUpdate.modifiedCount === 0) {
      await this.groupMemberModel.bulkWrite([
        {
          updateOne: {
            filter: { _id: newOwnerMember._id },
            update: { $set: { role: previousNewOwnerRole } },
          },
        },
        {
          updateOne: {
            filter: { _id: oldOwnerMember._id },
            update: { $set: { role: previousOldOwnerRole } },
          },
        },
      ]);
      throw new BadRequestException('Ownership changed concurrently');
    }

    // Send notification to new owner via RabbitMQ
    await this.notificationEmitter.emitGroupOwnershipTransferred(
      newOwnerId,
      userId,
      groupId,
      group.name
    );

    // Emit socket event for ownership transfer
    this.groupGateway.emitOwnershipTransfer(groupId, userId, newOwnerId);

    return { message: 'Đã nhượng quyền sở hữu nhóm' };
  }
}
