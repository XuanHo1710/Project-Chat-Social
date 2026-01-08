import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { UserInfo } from 'decorators/customize';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Post()
  create(@Body() createAccountDto: CreateAccountDto) {
    return this.accountService.create(createAccountDto);
  }

  @Get()
  findAll(@UserInfo() user: any, @Query('page') page: number) {
    return this.accountService.findAll(user, +page);
  }

  // Get own profile
  @Get('profile')
  getOwnProfile(@UserInfo() userInfo: any) {
    return this.accountService.getProfile(userInfo._id);
  }

  // Update own profile
  @Put('profile')
  updateProfile(@UserInfo() userInfo: any, @Body() updateAccountDto: UpdateAccountDto) {
    return this.accountService.updateProfile(userInfo._id, updateAccountDto);
  }

  // Get profile by username (for viewing other users)
  @Get('profile/:username')
  getProfileByUsername(@Param('username') username: string) {
    return this.accountService.getProfileByUsername(username);
  }

  // ==================== SETTINGS ====================

  // Get user settings
  @Get('settings')
  @UseGuards(JwtAuthGuard)
  getSettings(@UserInfo() user: any) {
    return this.accountService.getSettings(user._id);
  }

  // Toggle activity status
  @Patch('settings/activity-status')
  @UseGuards(JwtAuthGuard)
  toggleActivityStatus(@UserInfo() user: any, @Body('show') show: boolean) {
    return this.accountService.toggleActivityStatus(user._id, show);
  }

  // Self-block account for 30 days
  @Post('settings/self-block')
  @UseGuards(JwtAuthGuard)
  selfBlockAccount(@UserInfo() user: any) {
    return this.accountService.selfBlockAccount(user._id);
  }

  // Unblock self (cancel self-block)
  @Delete('settings/self-block')
  @UseGuards(JwtAuthGuard)
  unblockSelfAccount(@UserInfo() user: any) {
    return this.accountService.unblockSelfAccount(user._id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.accountService.findOne(id);
  }
}
