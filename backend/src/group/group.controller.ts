import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { GroupService } from './group.service';
import {
  CreateGroupDto,
  UpdateGroupDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
} from './dto/group.dto';
import { UserInfo } from 'decorators/customize';

@Controller('group')
@UseGuards(JwtAuthGuard)
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  // ==================== GROUP CRUD ====================

  @Post()
  createGroup(@UserInfo() user: any, @Body() dto: CreateGroupDto) {
    return this.groupService.createGroup(user._id, dto);
  }

  @Put(':groupId')
  updateGroup(
    @UserInfo() user: any,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateGroupDto
  ) {
    return this.groupService.updateGroup(user._id, groupId, dto);
  }

  @Delete(':groupId')
  deleteGroup(@UserInfo() user: any, @Param('groupId') groupId: string) {
    return this.groupService.deleteGroup(user._id, groupId);
  }

  @Get('my-groups')
  getMyGroups(@UserInfo() user: any) {
    return this.groupService.getMyGroups(user._id);
  }

  @Get('suggested')
  getSuggestedGroups(@UserInfo() user: any, @Query('limit') limit?: string) {
    return this.groupService.getSuggestedGroups(user._id, limit ? parseInt(limit) : 10);
  }

  @Get('search')
  searchGroups(
    @UserInfo() user: any,
    @Query('q') query: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.groupService.searchGroups(
      query || '',
      user._id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20
    );
  }

  @Get(':groupId')
  getGroupById(@UserInfo() user: any, @Param('groupId') groupId: string) {
    return this.groupService.getGroupById(groupId, user._id);
  }

  // ==================== MEMBERSHIP ====================

  @Post(':groupId/join')
  joinGroup(@UserInfo() user: any, @Param('groupId') groupId: string) {
    return this.groupService.joinGroup(user._id, groupId);
  }

  @Post(':groupId/leave')
  leaveGroup(@UserInfo() user: any, @Param('groupId') groupId: string) {
    return this.groupService.leaveGroup(user._id, groupId);
  }

  @Delete(':groupId/cancel-request')
  cancelJoinRequest(@UserInfo() user: any, @Param('groupId') groupId: string) {
    return this.groupService.cancelJoinRequest(user._id, groupId);
  }

  @Get(':groupId/members')
  getMembers(
    @Param('groupId') groupId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.groupService.getMembers(
      groupId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20
    );
  }

  @Get(':groupId/members/top')
  getTopMembers(@Param('groupId') groupId: string, @Query('limit') limit?: string) {
    return this.groupService.getTopMembers(groupId, limit ? parseInt(limit) : 12);
  }

  @Get(':groupId/members/pending')
  getPendingMembers(
    @UserInfo() user: any,
    @Param('groupId') groupId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.groupService.getPendingMembers(
      user._id,
      groupId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20
    );
  }

  @Post(':groupId/members/:targetUserId/approve')
  approveMember(
    @UserInfo() user: any,
    @Param('groupId') groupId: string,
    @Param('targetUserId') targetUserId: string
  ) {
    return this.groupService.approveMember(user._id, groupId, targetUserId);
  }

  @Post(':groupId/members/:targetUserId/reject')
  rejectMember(
    @UserInfo() user: any,
    @Param('groupId') groupId: string,
    @Param('targetUserId') targetUserId: string
  ) {
    return this.groupService.rejectMember(user._id, groupId, targetUserId);
  }

  @Delete(':groupId/members/:targetUserId')
  removeMember(
    @UserInfo() user: any,
    @Param('groupId') groupId: string,
    @Param('targetUserId') targetUserId: string
  ) {
    return this.groupService.removeMember(user._id, groupId, targetUserId);
  }

  @Put(':groupId/members/:targetUserId/role')
  updateMemberRole(
    @UserInfo() user: any,
    @Param('groupId') groupId: string,
    @Param('targetUserId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto
  ) {
    return this.groupService.updateMemberRole(user._id, groupId, targetUserId, dto.role as any);
  }

  @Post(':groupId/invite')
  inviteMember(
    @UserInfo() user: any,
    @Param('groupId') groupId: string,
    @Body() dto: InviteMemberDto
  ) {
    return this.groupService.inviteMember(user._id, groupId, dto.userId);
  }

  @Post(':groupId/transfer-ownership')
  transferOwnership(
    @UserInfo() user: any,
    @Param('groupId') groupId: string,
    @Body() dto: InviteMemberDto
  ) {
    return this.groupService.transferOwnership(user._id, groupId, dto.userId);
  }
}
