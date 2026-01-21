import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Group, GroupDocument, GroupPrivacy, GroupVisibility } from './entities/group.entity';
import {
  GroupMember,
  GroupMemberDocument,
  GroupRole,
  MemberStatus,
} from './entities/group-member.entity';
import { CreateGroupDto, UpdateGroupDto } from './dto/group.dto';
import { NotificationService } from 'src/notification/notification.service';
import { Account, AccountDocument } from 'src/account/entities/account.entity';
import { GroupGateway } from './group.gateway';

@Injectable()
export class GroupService {
  constructor(
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(GroupMember.name) private groupMemberModel: Model<GroupMemberDocument>,
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    @Inject(forwardRef(() => NotificationService))
    private notificationService: NotificationService,
    private groupGateway: GroupGateway
  ) { }

  // ==================== GROUP CRUD ====================

  async createGroup(userId: string, dto: CreateGroupDto) {
    const group = new this.groupModel({
      ...dto,
      createdBy: new Types.ObjectId(userId),
      memberCount: 1, // Creator is first member
    });
    await group.save();

    // Add creator as admin
    const member = new this.groupMemberModel({
      groupId: group._id,
      userId: new Types.ObjectId(userId),
      role: GroupRole.ADMIN,
      status: MemberStatus.APPROVED,
      joinedAt: new Date(),
    });
    await member.save();

    return group;
  }

  async updateGroup(userId: string, groupId: string, dto: UpdateGroupDto) {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Không tìm thấy nhóm');
    }

    // Check if user is admin
    const member = await this.groupMemberModel.findOne({
      groupId: new Types.ObjectId(groupId),
      userId: new Types.ObjectId(userId),
      role: GroupRole.ADMIN,
      status: MemberStatus.APPROVED,
    });

    if (!member) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa nhóm này');
    }

    Object.assign(group, dto);
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
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Không tìm thấy nhóm');
    }

    // Only creator can delete
    if (group.createdBy.toString() !== userId) {
      throw new ForbiddenException('Chỉ người tạo nhóm mới có thể xóa');
    }

    // Remove all members
    await this.groupMemberModel.deleteMany({ groupId: new Types.ObjectId(groupId) });

    // Soft delete the group
    group.isActive = false;
    await group.save();

    return { message: 'Đã xóa nhóm' };
  }

  async getGroupById(groupId: string, userId?: string): Promise<any> {
    const group = await this.groupModel
      .findOne({ _id: new Types.ObjectId(groupId), isActive: true })
      .populate('createdBy', 'firstName lastName avatar username')
      .lean();

    if (!group) {
      throw new NotFoundException('Không tìm thấy nhóm');
    }

    // Check membership
    const membership = await this.groupMemberModel
      .findOne({
        groupId: new Types.ObjectId(groupId),
        userId: new Types.ObjectId(userId),
      })
      .lean();

    // For private groups, only members can see details
    if (group.privacy === GroupPrivacy.PRIVATE && !membership) {
      return {
        _id: group._id,
        name: group.name,
        coverImage: group.coverImage,
        privacy: group.privacy,
        memberCount: group.memberCount,
        isMember: false,
        isPending: false,
      };
    }

    return {
      ...group,
      isMember: membership?.status === MemberStatus.APPROVED,
      isPending: membership?.status === MemberStatus.PENDING,
      myRole: membership?.role || null,
    };
  }

  async searchGroups(query: string, userId: string, page = 1, limit = 20): Promise<any> {
    const skip = (page - 1) * limit;

    const groups = await this.groupModel
      .find({
        isActive: true,
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
        ],
      })
      .populate('createdBy', 'firstName lastName avatar')
      .skip(skip)
      .limit(limit)
      .lean();

    // Add membership status for each group
    const groupIds = groups.map((g) => g._id);
    const memberships = await this.groupMemberModel
      .find({
        groupId: { $in: groupIds },
        userId: new Types.ObjectId(userId),
      })
      .lean();

    const membershipMap = new Map(memberships.map((m) => [m.groupId.toString(), m]));

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
    const memberships = await this.groupMemberModel
      .find({
        userId: new Types.ObjectId(userId),
        status: MemberStatus.APPROVED,
      })
      .populate({
        path: 'groupId',
        match: { isActive: true },
        populate: { path: 'createdBy', select: 'firstName lastName avatar' },
      })
      .lean();

    return memberships
      .filter((m) => m.groupId) // Filter out null groups
      .map((m: any) => ({
        ...m.groupId,
        myRole: m.role,
        joinedAt: m.joinedAt,
      }));
  }

  async getSuggestedGroups(userId: string, limit = 10): Promise<any> {
    // Get groups user is NOT an approved member of
    const myApprovedMemberships = await this.groupMemberModel
      .find({
        userId: new Types.ObjectId(userId),
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
      .limit(limit)
      .lean();

    // Add pending status for each group
    const groupIds = groups.map((g) => g._id);
    const pendingMemberships = await this.groupMemberModel
      .find({
        groupId: { $in: groupIds },
        userId: new Types.ObjectId(userId),
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
    const group = await this.groupModel.findOne({
      _id: new Types.ObjectId(groupId),
      isActive: true,
    });

    if (!group) {
      throw new NotFoundException('Không tìm thấy nhóm');
    }

    // Check if already a member
    const existingMember = await this.groupMemberModel.findOne({
      groupId: new Types.ObjectId(groupId),
      userId: new Types.ObjectId(userId),
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
      groupId: new Types.ObjectId(groupId),
      userId: new Types.ObjectId(userId),
      role: GroupRole.MEMBER,
      status,
      joinedAt: status === MemberStatus.APPROVED ? new Date() : null,
    });
    await member.save();

    // Update member count if approved
    if (status === MemberStatus.APPROVED) {
      await this.groupModel.updateOne(
        { _id: new Types.ObjectId(groupId) },
        { $inc: { memberCount: 1 } }
      );

      // Get updated member count and emit socket event
      const updatedGroup = await this.groupModel.findById(groupId).lean();
      if (updatedGroup) {
        this.groupGateway.emitMemberCountUpdate(groupId, updatedGroup.memberCount);

        // Emit new member event
        const newMemberInfo = await this.accountModel
          .findById(userId)
          .select('firstName lastName avatar')
          .lean();
        if (newMemberInfo) {
          this.groupGateway.emitNewMember(groupId, {
            odId: userId,
            firstName: newMemberInfo.firstName,
            lastName: newMemberInfo.lastName,
            avatar: newMemberInfo.avatar,
            role: GroupRole.MEMBER,
          });
        }
      }
    }

    return {
      message:
        status === MemberStatus.PENDING ? 'Yêu cầu tham gia đã được gửi' : 'Đã tham gia nhóm',
      status,
    };
  }

  async leaveGroup(userId: string, groupId: string) {
    const member = await this.groupMemberModel.findOne({
      groupId: new Types.ObjectId(groupId),
      userId: new Types.ObjectId(userId),
      status: MemberStatus.APPROVED,
    });

    if (!member) {
      throw new NotFoundException('Bạn không phải thành viên của nhóm này');
    }

    // Check if user is the only admin
    if (member.role === GroupRole.ADMIN) {
      const adminCount = await this.groupMemberModel.countDocuments({
        groupId: new Types.ObjectId(groupId),
        role: GroupRole.ADMIN,
        status: MemberStatus.APPROVED,
      });

      if (adminCount === 1) {
        // Check if there are other members
        const memberCount = await this.groupMemberModel.countDocuments({
          groupId: new Types.ObjectId(groupId),
          status: MemberStatus.APPROVED,
        });

        if (memberCount > 1) {
          throw new BadRequestException('Bạn cần chỉ định admin khác trước khi rời nhóm');
        }
      }
    }

    await this.groupMemberModel.deleteOne({ _id: member._id });

    await this.groupModel.updateOne(
      { _id: new Types.ObjectId(groupId) },
      { $inc: { memberCount: -1 } }
    );

    // Get updated member count and emit socket event
    const updatedGroup = await this.groupModel.findById(groupId).lean();
    if (updatedGroup) {
      this.groupGateway.emitMemberCountUpdate(groupId, updatedGroup.memberCount);
      this.groupGateway.emitMemberLeft(groupId, userId);
    }

    return { message: 'Đã rời khỏi nhóm' };
  }

  async cancelJoinRequest(userId: string, groupId: string) {
    const result = await this.groupMemberModel.deleteOne({
      groupId: new Types.ObjectId(groupId),
      userId: new Types.ObjectId(userId),
      status: MemberStatus.PENDING,
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Không tìm thấy yêu cầu tham gia');
    }

    // Chỉnh thông báo nếu có
    await this.notificationService.respondGroupInvitationRequest(userId, groupId, 'REJECTED');

    return { message: 'Đã hủy yêu cầu tham gia' };
  }

  async getMembers(groupId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const members = await this.groupMemberModel
      .find({
        groupId: new Types.ObjectId(groupId),
        status: MemberStatus.APPROVED,
      })
      .populate('userId', 'firstName lastName avatar username status lastActive')
      .sort({ role: 1, joinedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await this.groupMemberModel.countDocuments({
      groupId: new Types.ObjectId(groupId),
      status: MemberStatus.APPROVED,
    });

    return {
      members: members.map((m: any) => ({
        ...m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getPendingMembers(userId: string, groupId: string, page = 1, limit = 20) {
    // Check if user is admin or moderator
    const member = await this.groupMemberModel.findOne({
      groupId: new Types.ObjectId(groupId),
      userId: new Types.ObjectId(userId),
      role: { $in: [GroupRole.ADMIN, GroupRole.MODERATOR] },
      status: MemberStatus.APPROVED,
    });

    if (!member) {
      throw new ForbiddenException('Bạn không có quyền xem danh sách chờ duyệt');
    }

    const skip = (page - 1) * limit;

    const pendingMembers = await this.groupMemberModel
      .find({
        groupId: new Types.ObjectId(groupId),
        status: MemberStatus.PENDING,
      })
      .populate('userId', 'firstName lastName avatar username')
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await this.groupMemberModel.countDocuments({
      groupId: new Types.ObjectId(groupId),
      status: MemberStatus.PENDING,
    });

    return {
      members: pendingMembers.map((m: any) => ({
        ...m.userId,
        requestedAt: m.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async approveMember(userId: string, groupId: string, targetUserId: string) {
    // Check if user is admin or moderator
    const member = await this.groupMemberModel.findOne({
      groupId: new Types.ObjectId(groupId),
      userId: new Types.ObjectId(userId),
      role: { $in: [GroupRole.ADMIN, GroupRole.MODERATOR] },
      status: MemberStatus.APPROVED,
    });

    if (!member) {
      throw new ForbiddenException('Bạn không có quyền duyệt thành viên');
    }

    const targetMember = await this.groupMemberModel.findOne({
      groupId: new Types.ObjectId(groupId),
      userId: new Types.ObjectId(targetUserId),
      status: MemberStatus.PENDING,
    });

    if (!targetMember) {
      throw new NotFoundException('Không tìm thấy yêu cầu tham gia');
    }

    targetMember.status = MemberStatus.APPROVED;
    targetMember.approvedBy = new Types.ObjectId(userId);
    targetMember.joinedAt = new Date();
    await targetMember.save();

    await this.groupModel.updateOne(
      { _id: new Types.ObjectId(groupId) },
      { $inc: { memberCount: 1 } }
    );

    return { message: 'Đã duyệt thành viên' };
  }

  async rejectMember(userId: string, groupId: string, targetUserId: string) {
    // Check if user is admin or moderator
    const member = await this.groupMemberModel.findOne({
      groupId: new Types.ObjectId(groupId),
      userId: new Types.ObjectId(userId),
      role: { $in: [GroupRole.ADMIN, GroupRole.MODERATOR] },
      status: MemberStatus.APPROVED,
    });

    if (!member) {
      throw new ForbiddenException('Bạn không có quyền từ chối thành viên');
    }

    const result = await this.groupMemberModel.deleteOne({
      groupId: new Types.ObjectId(groupId),
      userId: new Types.ObjectId(targetUserId),
      status: MemberStatus.PENDING,
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Không tìm thấy yêu cầu tham gia');
    }

    return { message: 'Đã từ chối yêu cầu tham gia' };
  }

  async removeMember(userId: string, groupId: string, targetUserId: string) {
    // Check if user is admin
    const member = await this.groupMemberModel.findOne({
      groupId: new Types.ObjectId(groupId),
      userId: new Types.ObjectId(userId),
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
      groupId: new Types.ObjectId(groupId),
      userId: new Types.ObjectId(targetUserId),
      status: MemberStatus.APPROVED,
    });

    if (!targetMember) {
      throw new NotFoundException('Không tìm thấy thành viên');
    }

    // Cannot remove other admins unless you are creator
    const group = await this.groupModel.findById(groupId);
    if (targetMember.role === GroupRole.ADMIN && group && group.createdBy.toString() !== userId) {
      throw new ForbiddenException('Chỉ người tạo nhóm mới có thể xóa admin khác');
    }

    await this.groupMemberModel.deleteOne({ _id: targetMember._id });

    await this.groupModel.updateOne(
      { _id: new Types.ObjectId(groupId) },
      { $inc: { memberCount: -1 } }
    );

    return { message: 'Đã xóa thành viên' };
  }

  async updateMemberRole(
    userId: string,
    groupId: string,
    targetUserId: string,
    newRole: GroupRole
  ) {
    // Check if user is admin
    const member = await this.groupMemberModel.findOne({
      groupId: new Types.ObjectId(groupId),
      userId: new Types.ObjectId(userId),
      role: GroupRole.ADMIN,
      status: MemberStatus.APPROVED,
    });

    if (!member) {
      throw new ForbiddenException('Chỉ admin mới có thể thay đổi vai trò');
    }

    const targetMember = await this.groupMemberModel.findOne({
      groupId: new Types.ObjectId(groupId),
      userId: new Types.ObjectId(targetUserId),
      status: MemberStatus.APPROVED,
    });

    if (!targetMember) {
      throw new NotFoundException('Không tìm thấy thành viên');
    }

    // Only creator can change admin roles
    const group = await this.groupModel.findById(groupId);
    if (
      (targetMember.role === GroupRole.ADMIN || newRole === GroupRole.ADMIN) &&
      group &&
      group.createdBy.toString() !== userId
    ) {
      throw new ForbiddenException('Chỉ người tạo nhóm mới có thể thay đổi vai trò admin');
    }

    const oldRole = targetMember.role;
    targetMember.role = newRole;
    await targetMember.save();

    // Send notification about role change if role actually changed
    if (oldRole !== newRole && group) {
      await this.notificationService.createRoleChangedNotification(
        targetUserId,
        groupId,
        group.name,
        newRole,
        userId
      );

      // Emit socket event for role update
      this.groupGateway.emitRoleUpdate(groupId, targetUserId, newRole, userId);
    }

    return { message: 'Đã cập nhật vai trò' };
  }

  // ==================== HELPER METHODS ====================

  async isMember(userId: string, groupId: string): Promise<boolean> {
    const member = await this.groupMemberModel.findOne({
      groupId: new Types.ObjectId(groupId),
      userId: new Types.ObjectId(userId),
      status: MemberStatus.APPROVED,
    });
    return !!member;
  }

  async getMemberRole(userId: string, groupId: string): Promise<GroupRole | null> {
    const member = await this.groupMemberModel.findOne({
      groupId: new Types.ObjectId(groupId),
      userId: new Types.ObjectId(userId),
      status: MemberStatus.APPROVED,
    });
    return member?.role || null;
  }

  async incrementPostCount(groupId: string) {
    await this.groupModel.updateOne(
      { _id: new Types.ObjectId(groupId) },
      { $inc: { postCount: 1 } }
    );
  }

  async decrementPostCount(groupId: string) {
    await this.groupModel.updateOne(
      { _id: new Types.ObjectId(groupId) },
      { $inc: { postCount: -1 } }
    );
  }

  // Get members for avatar display (top members)
  async getTopMembers(groupId: string, limit = 12) {
    const members = await this.groupMemberModel
      .find({
        groupId: new Types.ObjectId(groupId),
        status: MemberStatus.APPROVED,
      })
      .populate('userId', 'firstName lastName avatar')
      .sort({ role: 1, joinedAt: 1 })
      .limit(limit)
      .lean();

    return members.map((m: any) => m.userId);
  }

  // Invite friend to group
  async inviteMember(userId: string, groupId: string, targetUserId: string) {
    // Check if user is a member
    const member = await this.groupMemberModel.findOne({
      groupId: new Types.ObjectId(groupId),
      userId: new Types.ObjectId(userId),
      status: MemberStatus.APPROVED,
    });

    if (!member) {
      throw new ForbiddenException('Bạn cần là thành viên để mời người khác');
    }

    // Check if target is already member or pending
    const existingMember = await this.groupMemberModel.findOne({
      groupId: new Types.ObjectId(groupId),
      userId: new Types.ObjectId(targetUserId),
    });

    if (existingMember) {
      if (existingMember.status === MemberStatus.APPROVED) {
        throw new BadRequestException('Người này đã là thành viên');
      }
      throw new BadRequestException('Đã có yêu cầu tham gia từ người này');
    }

    // Get inviter and group info for notification
    const [inviter, group] = await Promise.all([
      this.accountModel.findById(userId).select('firstName lastName').lean(),
      this.groupModel.findById(groupId).select('name').lean(),
    ]);

    // Create pending membership with invite
    const newMember = new this.groupMemberModel({
      groupId: new Types.ObjectId(groupId),
      userId: new Types.ObjectId(targetUserId),
      role: GroupRole.MEMBER,
      status: MemberStatus.PENDING,
      invitedBy: new Types.ObjectId(userId),
    });
    await newMember.save();

    // Send notification to invited user
    if (inviter && group) {
      const inviterName = `${inviter.firstName} ${inviter.lastName}`;
      await this.notificationService.createGroupInvitationNotification(
        userId,
        targetUserId,
        groupId,
        group.name,
        inviterName
      );
    }

    return { message: 'Đã gửi lời mời' };
  }

  // Accept group invitation (called from notification response)
  async acceptInvitation(userId: string, groupId: string) {
    const member = await this.groupMemberModel.findOne({
      groupId: new Types.ObjectId(groupId),
      userId: new Types.ObjectId(userId),
      status: MemberStatus.PENDING,
    });

    if (!member) {
      throw new NotFoundException('Không tìm thấy lời mời');
    }

    member.status = MemberStatus.APPROVED;
    member.joinedAt = new Date();
    await member.save();

    await this.groupModel.updateOne(
      { _id: new Types.ObjectId(groupId) },
      { $inc: { memberCount: 1 } }
    );

    return { message: 'Đã tham gia nhóm' };
  }

  // Reject group invitation (called from notification response)
  async rejectInvitation(userId: string, groupId: string) {
    const result = await this.groupMemberModel.deleteOne({
      groupId: new Types.ObjectId(groupId),
      userId: new Types.ObjectId(userId),
      status: MemberStatus.PENDING,
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Không tìm thấy lời mời');
    }

    return { message: 'Đã từ chối lời mời' };
  }

  // Transfer group ownership
  async transferOwnership(userId: string, groupId: string, newOwnerId: string) {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Không tìm thấy nhóm');
    }

    // Only creator can transfer ownership
    if (group.createdBy.toString() !== userId) {
      throw new ForbiddenException('Chỉ người tạo nhóm mới có thể nhượng quyền');
    }

    // Check if new owner is a member
    const newOwnerMember = await this.groupMemberModel.findOne({
      groupId: new Types.ObjectId(groupId),
      userId: new Types.ObjectId(newOwnerId),
      status: MemberStatus.APPROVED,
    });

    if (!newOwnerMember) {
      throw new BadRequestException('Người được chọn phải là thành viên của nhóm');
    }

    // Update group creator
    await this.groupModel.updateOne(
      { _id: new Types.ObjectId(groupId) },
      { $set: { createdBy: new Types.ObjectId(newOwnerId) } }
    );

    // Make new owner an admin
    newOwnerMember.role = GroupRole.ADMIN;
    await newOwnerMember.save();

    // Demote old owner to regular member
    await this.groupMemberModel.updateOne(
      {
        groupId: new Types.ObjectId(groupId),
        userId: new Types.ObjectId(userId),
        status: MemberStatus.APPROVED,
      },
      { $set: { role: GroupRole.MEMBER } }
    );

    // Send notification to new owner
    await this.notificationService.createOwnershipTransferredNotification(
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
