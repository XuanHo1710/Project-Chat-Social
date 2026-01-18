import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Put } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { NotificationService } from './notification.service';
import { UserInfo } from 'decorators/customize';
import { RespondGroupInvitationDto } from './dto/notification.dto';

@Controller('notification')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) { }

  @Get()
  getNotifications(
    @UserInfo() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('type') type?: string
  ) {
    return this.notificationService.getUserNotifications(
      user._id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      status,
      type
    );
  }

  @Get('unread-count')
  getUnreadCount(@UserInfo() user: any) {
    return this.notificationService.getUnreadCount(user._id);
  }

  @Put(':notificationId/read')
  markAsRead(@UserInfo() user: any, @Param('notificationId') notificationId: string) {
    return this.notificationService.markAsRead(user._id, notificationId);
  }

  @Put('read-all')
  markAllAsRead(@UserInfo() user: any) {
    return this.notificationService.markAllAsRead(user._id);
  }

  @Delete(':notificationId')
  deleteNotification(@UserInfo() user: any, @Param('notificationId') notificationId: string) {
    return this.notificationService.deleteNotification(user._id, notificationId);
  }

  @Post('group-invitation/respond')
  respondToGroupInvitation(@UserInfo() user: any, @Body() dto: RespondGroupInvitationDto) {
    return this.notificationService.respondToGroupInvitation(
      user._id,
      dto.notificationId,
      dto.action
    );
  }
}
