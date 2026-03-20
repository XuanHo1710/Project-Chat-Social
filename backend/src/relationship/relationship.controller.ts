import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  NotFoundException,
} from '@nestjs/common';
import { RelationshipService } from './relationship.service';
import { CreateRelationshipDto } from './dto/create-relationship.dto';
import { UpdateRelationshipDto } from './dto/update-relationship.dto';
import { RelationshipStatus } from 'src/relationship/entities/relationship.entity';
import { UserInfo } from 'decorators/customize';

@Controller('relationship')
export class RelationshipController {
  constructor(private readonly relationshipService: RelationshipService) {}

  // Add friend with PENDING status by default
  @Post('/add-friend')
  addFriend(@Body() createRelationshipDto: CreateRelationshipDto) {
    createRelationshipDto.status = RelationshipStatus.PENDING;
    return this.relationshipService.addFriend(createRelationshipDto);
  }

  // Cancel friend request or unfriend or rejected friend request
  @Patch('/update-status')
  updateStatusRelationship(@Body() updateRelationshipDto: UpdateRelationshipDto) {
    if (
      !updateRelationshipDto ||
      !updateRelationshipDto.status ||
      !updateRelationshipDto.userId ||
      !updateRelationshipDto.friendId
    ) {
      throw new NotFoundException('Invalid data provided');
    }
    return this.relationshipService.updateStatusRelationship(
      updateRelationshipDto?.userId.toString(),
      updateRelationshipDto?.friendId.toString(),
      updateRelationshipDto?.status.toString()
    );
  }

  // Chấp nhận kết bạn
  @Patch('/accept-friend')
  acceptFriend(@Body() updateRelationshipDto: UpdateRelationshipDto) {
    if (
      !updateRelationshipDto ||
      !updateRelationshipDto.userId ||
      !updateRelationshipDto.friendId
    ) {
      throw new NotFoundException('Invalid data provided');
    }
    return this.relationshipService.acceptFriend(
      updateRelationshipDto?.userId.toString(),
      updateRelationshipDto?.friendId.toString()
    );
  }

  // Lấy danh sách mà người dùng nhận được lời mời kết bạn
  @Get('/received-requests')
  getReceivedFriendRequests(@UserInfo() user: any) {
    return this.relationshipService.getReceivedFriendRequests(user._id);
  }

  // Lấy danh sách mà người dùng gửi lời mời kết bạn
  @Get('/sent-requests')
  getSentFriendRequests(@UserInfo() user: any) {
    return this.relationshipService.getSentFriendRequests(user._id);
  }

  // Lấy danh sách bạn bè hiện tại của người dùng đang đăng nhập
  @Get('/friends')
  getFriends(@UserInfo() user: any) {
    return this.relationshipService.getFriendsList(user._id, user._id);
  }

  // Lấy danh sách bạn bè của một người dùng cụ thể (theo userId)
  @Get('/friends/:userId')
  getFriendsByUserId(@UserInfo() user: any, @Param('userId') userId: string) {
    return this.relationshipService.getFriendsList(userId, user._id);
  }

  // Kiểm tra xem 2 người dùng có phải là bạn bè không
  @Get('/check-friendship/:targetUserId')
  checkFriendship(@UserInfo() user: any, @Param('targetUserId') targetUserId: string) {
    return this.relationshipService.checkFriendship(user._id, targetUserId);
  }

  // ==================== BLOCKING ====================

  // Block a user
  @Post('/block/:targetUserId')
  blockUser(@UserInfo() user: any, @Param('targetUserId') targetUserId: string) {
    return this.relationshipService.blockUser(user._id, targetUserId);
  }

  // Unblock a user
  @Delete('/block/:targetUserId')
  unblockUser(@UserInfo() user: any, @Param('targetUserId') targetUserId: string) {
    return this.relationshipService.unblockUser(user._id, targetUserId);
  }

  // Get blocked users list
  @Get('/blocked')
  getBlockedUsers(@UserInfo() user: any) {
    return this.relationshipService.getBlockedUsers(user._id);
  }

  // Check if a user is blocked
  @Get('/is-blocked/:targetUserId')
  isUserBlocked(@UserInfo() user: any, @Param('targetUserId') targetUserId: string) {
    return this.relationshipService.isUserBlocked(user._id, targetUserId);
  }

  // ==================== RESTRICT ====================

  // Restrict a user
  @Post('/restrict/:targetUserId')
  restrictUser(@UserInfo() user: any, @Param('targetUserId') targetUserId: string) {
    return this.relationshipService.restrictUser(user._id, targetUserId);
  }

  // Unrestrict a user
  @Delete('/unrestrict/:targetUserId')
  unrestrictUser(@UserInfo() user: any, @Param('targetUserId') targetUserId: string) {
    return this.relationshipService.unrestrictUser(user._id, targetUserId);
  }

  // Get restricted users list
  @Get('/restricted')
  getRestrictedUsers(@UserInfo() user: any) {
    return this.relationshipService.getRestrictedUsers(user._id);
  }
}
