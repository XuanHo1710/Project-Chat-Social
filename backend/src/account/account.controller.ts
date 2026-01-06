import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Put } from '@nestjs/common';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { UserInfo } from 'decorators/customize';

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
}
