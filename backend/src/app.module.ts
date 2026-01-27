import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AccountModule } from './account/account.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { JwtStrategy } from 'src/auth/jwt.strategy';
import { AuthModule } from 'src/auth/auth.module';
import { LocalStrategy } from 'src/auth/passport/local.strategy';
import { GoogleStrategy } from 'src/auth/passport/google.strategy';
import { RelationshipModule } from './relationship/relationship.module';
import { ConversationModule } from './conversation/conversation.module';
import { ChatModule } from './chat/chat.module';
import { PostModule } from './post/post.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { CommentModule } from './comment/comment.module';
import { ReactionModule } from './reaction/reaction.module';
import { HashtagModule } from './hashtag/hashtag.module';
import { StoryModule } from './story/story.module';
import { GroupModule } from './group/group.module';
import { NotificationModule } from './notification/notification.module';
import { FirebaseService } from 'src/firebase/firebase.service';
import { EmailModule } from './email/email.module';
import { OtpModule } from './otp/otp.module';
import { AdminModule } from './admin/admin.module';
import { ClientsModule, Transport } from '@nestjs/microservices';
const mongooseAutoPopulate = require('mongoose-autopopulate');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        connectionFactory: (connection: Connection) => {
          connection.plugin(mongooseAutoPopulate);
          return connection;
        },
      }),
      inject: [ConfigService],
    }),
    AccountModule,
    AuthModule,
    RelationshipModule,
    ConversationModule,
    ChatModule,
    PostModule,
    CloudinaryModule,
    CommentModule,
    ReactionModule,
    HashtagModule,
    StoryModule,
    GroupModule,
    NotificationModule,
    EmailModule,
    OtpModule,
    AdminModule,
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
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    JwtStrategy,
    LocalStrategy,
    GoogleStrategy,
    FirebaseService,
  ],
})
export class AppModule {}
