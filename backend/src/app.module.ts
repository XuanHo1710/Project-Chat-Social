import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AccountModule } from './account/account.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
// import { JwtStrategy } from 'src/auth/jwt.strategy';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { JwtStrategy } from 'src/auth/jwt.strategy';
import { AuthModule } from 'src/auth/auth.module';
import { JwtModule } from '@nestjs/jwt';
import { LocalStrategy } from 'src/auth/passport/local.strategy';
import { GoogleStrategy } from 'src/auth/passport/google.strategy';
import { RelationshipModule } from './relationship/relationship.module';
import { ConversationModule } from './conversation/conversation.module';
import { ChatModule } from './chat/chat.module';
import { PostModule } from './post/post.module';
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
        }
      }),
      inject: [ConfigService]
    }),
    AccountModule,
    AuthModule,
    RelationshipModule,
    ConversationModule,
    ChatModule,
    PostModule
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
    GoogleStrategy
  ]
})
export class AppModule { }
