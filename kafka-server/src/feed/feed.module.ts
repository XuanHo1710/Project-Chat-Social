import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { FeedService } from './feed.service';
import { FeedConsumerController } from './feed-consumer.controller';
import { UserFeed, UserFeedSchema } from './schemas/user-feed.schema';
import { UserInteraction, UserInteractionSchema } from './schemas/user-interaction.schema';
import { AIServerService } from '../services/ai-server.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: UserFeed.name, schema: UserFeedSchema },
            { name: UserInteraction.name, schema: UserInteractionSchema },
        ]),
        HttpModule,
        ConfigModule,
    ],
    controllers: [FeedConsumerController],
    providers: [FeedService, AIServerService],
    exports: [FeedService],
})
export class FeedModule { }
