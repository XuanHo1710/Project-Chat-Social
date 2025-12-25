import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('/messages')
  sendMessageByConversationId(@Body() createMessageDto: CreateMessageDto) {
    return this.chatService.sendMessage(createMessageDto);
  }

  @Get('/messages')
  findAll() {
    return this.chatService.findAll();
  }

  @Get('/messages/:id')
  findAllMessagesByConversationId(
    @Param('id') conversationId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string
  ) {
    return this.chatService.findAllMessagesByConversationId(
      conversationId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 15,
      before
    );
  }

  @Get('/:id')
  findONe(@Param('id') id: string) {
    return this.chatService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMessageDto: UpdateMessageDto) {
    return this.chatService.update(+id, updateMessageDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.chatService.remove(+id);
  }
}
