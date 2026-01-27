import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { FeedService } from './feed.service';
import { UserInteractionEventDto, PostEventDto } from './dto/feed-event.dto';

/**
 * Kafka Consumer Controller
 * 
 * Listens to Kafka topics and processes events:
 * - post-events: New posts, updates, deletions
 * - user-interactions: Likes, comments, shares, views, follows
 */
@Controller()
export class FeedConsumerController {
    private readonly logger = new Logger('FeedConsumer');




    constructor(private readonly feedService: FeedService) { }

    /**
     * Handle post events (new posts, updates, deletions)
     * Topic: post-events
     */
    @EventPattern('post-events')
    async handlePostEvent(
        @Payload() message: PostEventDto,
        @Ctx() context: KafkaContext,
    ): Promise<void> {
        const topic = context.getTopic();
        const partition = context.getPartition();
        const offset = context.getMessage().offset;

        this.logger.log(
            `📥 Received post event [${topic}:${partition}:${offset}]: ${message.eventType}`,
        );

        try {
            await this.feedService.handlePostEvent(message);
            this.logger.log(`✅ Processed post event: ${message.eventType} for post ${message.postId}`);
        } catch (error) {
            this.logger.error(`❌ Error processing post event:`, error);
            // In production, you might want to send to a dead-letter queue
        }
    }

    /**
     * Handle user interaction events (likes, comments, views, etc.)
     * Topic: user-interactions
     */
    @EventPattern('user-interactions')
    async handleUserInteraction(
        @Payload() message: UserInteractionEventDto,
        @Ctx() context: KafkaContext,
    ): Promise<void> {
        const topic = context.getTopic();
        const partition = context.getPartition();
        const offset = context.getMessage().offset;

        this.logger.log(
            `📥 Received interaction [${topic}:${partition}:${offset}]: ${message.interactionType}`,
        );

        try {
            await this.feedService.handleInteractionEvent(message);
            this.logger.log(`✅ Processed interaction: ${message.interactionType} by ${message.userId}`);
        } catch (error) {
            this.logger.error(`❌ Error processing interaction:`, error);
        }
    }

    /**
     * Health check pattern - useful for monitoring
     */
    @EventPattern('health-check')
    async handleHealthCheck(@Ctx() context: KafkaContext): Promise<void> {
        this.logger.log('💓 Health check received');
    }
}
