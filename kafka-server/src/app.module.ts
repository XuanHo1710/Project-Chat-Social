import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { readBoundedInteger } from './common/configuration';
import { FeedModule } from './feed/feed.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // MongoDB connection
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>('MONGODB_URI');
        if (!uri) throw new Error('MONGODB_URI is required');
        return {
          uri,
          maxPoolSize: readBoundedInteger(
            configService.get('MONGODB_MAX_POOL_SIZE'),
            20,
            5,
            100,
            'MONGODB_MAX_POOL_SIZE',
          ),
          minPoolSize: readBoundedInteger(
            configService.get('MONGODB_MIN_POOL_SIZE'),
            2,
            0,
            20,
            'MONGODB_MIN_POOL_SIZE',
          ),
          serverSelectionTimeoutMS: 10_000,
          maxIdleTimeMS: 60_000,
          retryWrites: true,
        };
      },
      inject: [ConfigService],
    }),

    FeedModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
