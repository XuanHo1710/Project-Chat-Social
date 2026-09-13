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
import { EmailModule } from './email/email.module';
import { OtpModule } from './otp/otp.module';
import { AdminModule } from './admin/admin.module';
import { RabbitMQEventsController } from 'src/notification/rabbitmq-events.controller';
import { KafkaModule } from './kafka/kafka.module';
import { ThemeModule } from './theme/theme.module';
import { validateEnvironment } from './common/config/environment.config';
import { RabbitMqClientModule } from './common/messaging/rabbitmq-client.module';
import { PresenceModule } from './common/presence/presence.module';
const mongooseAutoPopulate = require('mongoose-autopopulate');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
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
    KafkaModule,
    ThemeModule,
    RabbitMqClientModule,
    PresenceModule,
  ],
  controllers: [AppController, RabbitMQEventsController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    JwtStrategy,
    LocalStrategy,
    GoogleStrategy,
  ],
})
export class AppModule { }
