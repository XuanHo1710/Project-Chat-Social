import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Conversation, ConversationSchema } from 'src/conversation/entities/conversation.entity';
import { Message, MessageSchema } from 'src/chat/entities/message.entity';
import { ChatGateway } from 'src/chat/chat.gateway';
import { AuthModule } from 'src/auth/auth.module';
import { ConversationModule } from 'src/conversation/conversation.module';
import { Account, AccountSchema } from 'src/account/entities/account.entity';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { RelationshipModule } from 'src/relationship/relationship.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Account.name, schema: AccountSchema },
    ]),
    AuthModule,
    ConversationModule,
    CloudinaryModule,
    RelationshipModule,
  ],
  controllers: [ChatController],
  providers: [ChatGateway, ChatService],
})
export class ChatModule {}
