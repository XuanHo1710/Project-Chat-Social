import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Put } from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { UserInfo } from '../../decorators/customize';
import { ChatGateway } from './chat.gateway';
import { ConversationService } from 'src/conversation/conversation.service';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
    private readonly conversationService: ConversationService
  ) {}

  @Post('/messages')
  sendMessageByConversationId(@Body() createMessageDto: CreateMessageDto) {
    return this.chatService.sendMessage(createMessageDto);
  }

  @Put('/conversations/:id/read')
  async markAsRead(
    @Param('id') conversationId: string,
    @UserInfo() user: any,
    @Body() body?: { messageId?: string }
  ) {
    const userId = user._id.toString();
    const result = await this.chatService.markAsRead(conversationId, userId, body?.messageId);

    // Also reset unread count in ConversationService
    const conversationUpdated = await this.conversationService.resetUnreadCount(
      conversationId,
      userId
    );

    // Helper to get user info (duplicated from Gateway, but necessary for event payload)
    // Actually result from markAsRead now populates userId and lastReadMessageId, so we can use that.

    // We need to format the payload to match what Gateway emits
    const readerUser = result.readStatus
      ? {
          _id: (result.readStatus.userId as any)._id.toString(),
          firstName: (result.readStatus.userId as any).firstName,
          lastName: (result.readStatus.userId as any).lastName,
          avatar: (result.readStatus.userId as any).avatar,
        }
      : null;

    if (this.chatGateway.server) {
      this.chatGateway.server.to(`room:${conversationId}`).emit('message:read:updated', {
        conversationId: conversationId,
        readBy: readerUser,
        readByUserId: userId,
        modifiedCount: result.modifiedCount,
        lastReadMessageId: result.lastReadMessageId,
        readStatus: result.readStatus,
      });

      this.chatGateway.server.to(`room:${conversationId}`).emit('conversation:unread:reset', {
        conversationId: conversationId,
        unreadCount: conversationUpdated.unreadCount,
      });
    }

    return result;
  }

  @Get('/messages/:id')
  findAllMessagesByConversationId(
    @Param('id') conversationId: string,
    @UserInfo() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string
  ) {
    return this.chatService.findAllMessagesByConversationId(
      conversationId,
      user._id.toString(),
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 15,
      before
    );
  }

  // Get media messages (images/videos) for a conversation
  @Get('/messages/:id/media')
  findMediaMessages(
    @Param('id') conversationId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.chatService.findMediaMessages(
      conversationId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20
    );
  }

  // Get file messages (documents) for a conversation
  @Get('/messages/:id/files')
  findFileMessages(
    @Param('id') conversationId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.chatService.findFileMessages(
      conversationId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20
    );
  }

  @Get('/:id')
  findOne(@Param('id') id: string) {
    return this.chatService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMessageDto: UpdateMessageDto) {
    return this.chatService.update(id, updateMessageDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.chatService.remove(+id);
  }
}
