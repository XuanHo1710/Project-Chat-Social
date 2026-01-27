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
import { FirebaseService } from 'src/firebase/firebase.service';
import { CommentModule } from 'src/comment/comment.module';
import { ReactionModule } from 'src/reaction/reaction.module';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';

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
    HttpModule,
    ClientsModule.registerAsync([
      {
        name: 'RABBITMQ_SERVICE',
        imports: [ConfigModule],
        useFactory: async (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')!],
            queue: configService.get<string>('RABBITMQ_QUEUE_NAME')!,
            queueOptions: {
              durable: true,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [ChatController, ChatRabbitMQController],
  providers: [ChatGateway, ChatService, FirebaseService],
  exports: [ChatGateway, ChatService],
})
export class ChatModule { }

