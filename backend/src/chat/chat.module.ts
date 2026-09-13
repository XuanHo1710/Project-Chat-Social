import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatRabbitMQController } from './chat-rabbitmq.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Conversation, ConversationSchema } from 'src/conversation/entities/conversation.entity';
import { Message, MessageSchema } from 'src/chat/entities/message.entity';
import {
  ConversationReadStatus,
  ConversationReadStatusSchema,
} from './entities/conversation-read-status.entity';
import { ChatGateway } from 'src/chat/chat.gateway';
import { AuthModule } from 'src/auth/auth.module';
import { ConversationModule } from 'src/conversation/conversation.module';
import { Account, AccountSchema } from 'src/account/entities/account.entity';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { RelationshipModule } from 'src/relationship/relationship.module';
import { HttpModule } from '@nestjs/axios';
import { CommentModule } from 'src/comment/comment.module';
import { ReactionModule } from 'src/reaction/reaction.module';
import { PostModule } from 'src/post/post.module';
import { RabbitMqClientModule } from 'src/common/messaging/rabbitmq-client.module';
import { GroupCallStateService } from 'src/chat/services/group-call-state.service';
import { CallSignalingHandler } from 'src/chat/services/call-signaling.handler';
import { LivestreamSignalingService } from 'src/chat/services/livestream-signaling.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Account.name, schema: AccountSchema },
      { name: ConversationReadStatus.name, schema: ConversationReadStatusSchema },
    ]),
    AuthModule,
    ConversationModule,
    CloudinaryModule,
    RelationshipModule,
    CommentModule,
    ReactionModule,
    PostModule,
    HttpModule,
    RabbitMqClientModule,
  ],
  controllers: [ChatController, ChatRabbitMQController],
  providers: [
    ChatGateway,
    ChatService,
    GroupCallStateService,
    CallSignalingHandler,
    LivestreamSignalingService,
  ],
  exports: [ChatGateway, ChatService],
})
export class ChatModule { }

