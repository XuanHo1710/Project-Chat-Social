import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { UserInfo } from 'decorators/customize';
import { Account } from 'src/account/entities/account.entity';

@Controller('conversation')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) { }

  @Get('/total-unread-count')
  unreadCountAllConversationByUserId(@UserInfo() user: Account) {
    return this.conversationService.unreadCountAllConversationByUserId(user._id.toString());
  }

  @Post()
  create(@Body() createConversationDto: CreateConversationDto) {
    return this.conversationService.create(createConversationDto);
  }

  @Get()
  findAll(@UserInfo() user: Account) {
    return this.conversationService.findConversationByUserId(user._id.toString());
  }

  @Post('chatbot')
  createChatbotConversation(@UserInfo() user: Account) {
    return this.conversationService.findOrCreateChatbotConversation(user._id.toString());
  }

  @Get('detail/:id')
  findOne(@Param('id') id: string, @UserInfo() user: Account) {
    return this.conversationService.findById(id, user._id.toString());
  }

  @Get(':id')
  findConversationByUserId(@Param('id') userId: string) {
    return this.conversationService.findConversationByUserId(userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateConversationDto: UpdateConversationDto) {
    return this.conversationService.update(id, updateConversationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.conversationService.remove(id);
  }
}
