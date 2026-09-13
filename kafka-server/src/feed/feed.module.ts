import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { FeedService } from './feed.service';
import { FeedConsumerController } from './feed-consumer.controller';

import {
  UserInteraction,
  UserInteractionSchema,
} from './schemas/user-interaction.schema';
import { AIServerService } from '../services/ai-server.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserInteraction.name, schema: UserInteractionSchema },
    ]),
    HttpModule.register({
      timeout: 15_000,
      maxRedirects: 0,
    }),
    ConfigModule,
  ],
  controllers: [FeedConsumerController],
  providers: [FeedService, AIServerService],
  exports: [FeedService],
})
export class FeedModule {}
