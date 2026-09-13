import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Put } from '@nestjs/common';
import { AccountService } from './account.service';
import { UpdateAccountDto } from './dto/update-account.dto';
import { ActivityStatusDto, FcmTokenDto } from './dto/account-settings.dto';
import { UserInfo } from 'decorators/customize';

interface AuthenticatedUser {
  _id: string;
}

@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  findAll(@UserInfo() user: AuthenticatedUser, @Query('page') page: number) {
    return this.accountService.findAll(user, +page);
  }

  // Get own profile
  @Get('profile')
  getOwnProfile(@UserInfo() userInfo: AuthenticatedUser): Promise<any> {
    return this.accountService.getOwnProfile(userInfo._id);
  }

  // Update own profile
  @Put('profile')
  updateProfile(
    @UserInfo() userInfo: AuthenticatedUser,
    @Body() updateAccountDto: UpdateAccountDto
  ) {
    return this.accountService.updateProfile(userInfo._id, updateAccountDto);
  }

  // Get profile by username (for viewing other users)
  @Get('profile/:username')
  getProfileByUsername(@Param('username') username: string): Promise<any> {
    return this.accountService.getProfileByUsername(username);
  }

  @Post('fcm-token')
  async saveFcmToken(@UserInfo() user: AuthenticatedUser, @Body() dto: FcmTokenDto) {
    return this.accountService.saveFcmToken(user._id, dto.token);
  }

  @Delete('fcm-token')
  async removeFcmToken(@UserInfo() user: AuthenticatedUser, @Body() dto: FcmTokenDto) {
    return this.accountService.removeFcmToken(user._id, dto.token);
  }

  // ==================== SETTINGS ====================

  // Get user settings
  @Get('settings')
  getSettings(@UserInfo() user: AuthenticatedUser) {
    return this.accountService.getSettings(user._id);
  }

  // Toggle activity status
  @Patch('settings/activity-status')
  toggleActivityStatus(@UserInfo() user: AuthenticatedUser, @Body() dto: ActivityStatusDto) {
    return this.accountService.toggleActivityStatus(user._id, dto.show);
  }

  // Self-block account for 30 days
  @Post('settings/self-block')
  selfBlockAccount(@UserInfo() user: AuthenticatedUser) {
    return this.accountService.selfBlockAccount(user._id);
  }

  // Unblock self (cancel self-block)
  @Delete('settings/self-block')
  unblockSelfAccount(@UserInfo() user: AuthenticatedUser) {
    return this.accountService.unblockSelfAccount(user._id);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<any> {
    return this.accountService.getProfile(id);
  }
}
