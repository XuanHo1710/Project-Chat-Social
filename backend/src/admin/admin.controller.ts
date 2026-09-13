import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { UserInfo } from 'decorators/customize';
import { AdminService } from './admin.service';
import {
  AdminPostQueryDto,
  AdminUserQueryDto,
  BlockUserDto,
  CreateAdminAccountDto,
  TrafficQueryDto,
  UpdateUserRoleDto,
} from './dto/admin.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Admin, Employee } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @Employee()
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('stats/weekly-posts')
  @Employee()
  getWeeklyPostsStats() {
    return this.adminService.getWeeklyPostsStats();
  }

  @Get('stats/top-pages')
  @Employee()
  getTopPagesStats() {
    return this.adminService.getTopPagesStats();
  }

  @Get('stats/recent-comments')
  @Employee()
  getRecentComments() {
    return this.adminService.getRecentComments();
  }

  @Get('stats/emotions')
  @Employee()
  getEmotionStats() {
    return this.adminService.getEmotionStats();
  }

  @Get('stats/traffic')
  @Employee()
  getTrafficData(@Query() query: TrafficQueryDto) {
    return this.adminService.getTrafficData(query.days);
  }

  @Post('users')
  @Admin()
  createAccount(@Body() body: CreateAdminAccountDto) {
    return this.adminService.createAccount(body);
  }

  @Get('users')
  @Admin()
  getUsers(@Query() query: AdminUserQueryDto) {
    return this.adminService.getUsers(query);
  }

  @Get('users/:id')
  @Admin()
  getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @Put('users/:id/block')
  @Admin()
  blockUser(@UserInfo() actor: any, @Param('id') id: string, @Body() body: BlockUserDto) {
    return this.adminService.blockUser(actor._id, id, body.reason, body.expireAt);
  }

  @Put('users/:id/unblock')
  @Admin()
  unblockUser(@Param('id') id: string) {
    return this.adminService.unblockUser(id);
  }

  @Put('users/:id/role')
  @Admin()
  updateUserRole(
    @UserInfo() actor: any,
    @Param('id') id: string,
    @Body() body: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(actor._id, id, body.role);
  }

  @Get('posts')
  @Employee()
  getPosts(@Query() query: AdminPostQueryDto) {
    return this.adminService.getPosts(query);
  }

  @Get('posts/:id')
  @Employee()
  getPostById(@Param('id') id: string) {
    return this.adminService.getPostById(id);
  }

  @Delete('posts/:id')
  @Employee()
  deletePost(@Param('id') id: string) {
    return this.adminService.deletePost(id);
  }

  @Put('posts/:id/hide')
  @Employee()
  hidePost(@Param('id') id: string) {
    return this.adminService.hidePost(id);
  }

  @Put('posts/:id/show')
  @Employee()
  showPost(@Param('id') id: string) {
    return this.adminService.showPost(id);
  }
}
