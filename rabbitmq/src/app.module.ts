import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { readBoundedInteger } from './common/configuration';
import { Account, AccountSchema } from './schemas/account.schema';
import { Conversation, ConversationSchema } from './schemas/conversation.schema';
import { Message, MessageSchema } from './schemas/message.schema';
import { Notification, NotificationSchema } from './schemas/notification.schema';
import { WorkerEvent, WorkerEventSchema } from './schemas/worker-event.schema';
import { Group, GroupSchema } from './schemas/group.schema';
import { AiService } from './services/ai.service';
import { EventInboxService } from './services/event-inbox.service';
import { FirebaseService } from './services/firebase.service';
import { NotificationAggregationService } from './services/notification-aggregation.service';
import { RmqRetryService } from './services/rmq-retry.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uri = config.get<string>('MONGODB_URI');
        if (!uri) throw new Error('MONGODB_URI is required');
        return {
          uri,
          maxPoolSize: readBoundedInteger(
            config.get('MONGODB_MAX_POOL_SIZE'),
            30,
            5,
            100,
            'MONGODB_MAX_POOL_SIZE'
          ),
          minPoolSize: readBoundedInteger(
            config.get('MONGODB_MIN_POOL_SIZE'),
            2,
            0,
            20,
            'MONGODB_MIN_POOL_SIZE'
          ),
          serverSelectionTimeoutMS: 10_000,
          maxIdleTimeMS: 60_000,
          retryWrites: true,
        };
      },
    }),
    MongooseModule.forFeature([
      { name: Account.name, schema: AccountSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: WorkerEvent.name, schema: WorkerEventSchema },
      { name: Group.name, schema: GroupSchema },
    ]),
    HttpModule.register({ timeout: 120_000, maxRedirects: 0 }),
    ClientsModule.registerAsync([
      {
        name: 'BACKEND_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => {
          const url = config.get<string>('RABBITMQ_URL');
          if (!url) throw new Error('RABBITMQ_URL is required');
          const backendQueue = config.get<string>('RABBITMQ_BACKEND_QUEUE') || 'backend_queue';
          if (!/^[a-zA-Z0-9._-]{1,180}$/.test(backendQueue)) {
            throw new Error('RABBITMQ_BACKEND_QUEUE contains invalid characters');
          }
          return {
            transport: Transport.RMQ,
            options: {
              urls: [url],
              queue: backendQueue,
              queueOptions: { durable: true },
              persistent: true,
            },
          };
        },
      },
    ]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    FirebaseService,
    AiService,
    NotificationAggregationService,
    EventInboxService,
    RmqRetryService,
  ],
})
export class AppModule {}
