import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FirebaseService } from './services/firebase.service';
import { AiService } from './services/ai.service';
import { NotificationAggregationService } from './services/notification-aggregation.service';

import { Account, AccountSchema } from 'src/schemas/account.schema';
import { Message, MessageSchema } from 'src/schemas/message.schema';
import { Conversation, ConversationSchema } from 'src/schemas/conversation.schema';
import { Notification, NotificationSchema } from 'src/schemas/notification.schema';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // MongoDB connection
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: Account.name, schema: AccountSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: Notification.name, schema: NotificationSchema },

    ]),
    // HTTP module for AI server calls
    HttpModule,
    // RabbitMQ client để emit events ngược về Backend
    ClientsModule.registerAsync([
      {
        name: 'BACKEND_SERVICE',
        imports: [ConfigModule],
        useFactory: async (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')!],
            queue: 'backend_queue', // Queue riêng cho Backend listen
            queueOptions: {
              durable: true,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    FirebaseService,
    AiService,
    NotificationAggregationService,

  ],
})
export class AppModule { }

