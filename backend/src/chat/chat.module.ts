import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Conversation, ConversationSchema } from 'src/conversation/entities/conversation.entity';
import { Message, MessageSchema } from 'src/chat/entities/message.entity';
import { ChatGateway } from 'src/chat/chat.gateway';
import { AuthModule } from 'src/auth/auth.module';
import { ConversationService } from 'src/conversation/conversation.service';
import { ConditionalModule } from '@nestjs/config';
import { ConversationModule } from 'src/conversation/conversation.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema }
    ]),
    AuthModule,
    ConversationModule
  ],
  controllers: [ChatController],
  providers: [ChatGateway, ChatService],
})
export class ChatModule { }
