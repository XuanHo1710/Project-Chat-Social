import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserInteraction, UserInteractionDocument } from './schemas/user-interaction.schema';
import {
    UserInteractionEventDto,
    PostEventDto,
    InteractionType,
    PostEventType
} from './dto/feed-event.dto';
import { AIServerService } from '../services/ai-server.service';

@Injectable()
export class FeedService {
    private readonly logger = new Logger('FeedService');

    constructor(
        @InjectModel(UserInteraction.name)
        private userInteractionModel: Model<UserInteractionDocument>,
        private readonly aiServerService: AIServerService,
    ) { }

    /**
     * Xử lý post event - Sync to AI Server
     */
    async handlePostEvent(event: PostEventDto): Promise<void> {
        this.logger.log(`Processing post event: ${event.eventType} for post ${event.postId}`);

        switch (event.eventType) {
            case PostEventType.POST_CREATED:
                await this.syncNewPostToAI(event);
                break;
            case PostEventType.POST_DELETED:
                await this.removePostFromAI(event.postId);
                break;
            case PostEventType.POST_SHARED:
                // Shared post logic if needed for AI, currently simplified
                break;
            default:
                this.logger.warn(`Unknown post event type: ${event.eventType}`);
        }
    }

    /**
     * Sync new post to AI Server
     */
    private async syncNewPostToAI(event: PostEventDto): Promise<void> {
        // Embed post to AI Server (Async)
        this.aiServerService.embedPost({
            post_id: event.postId,
            content: event.postData?.content || '',
            user_id: event.authorId,
            privacy: event.postData?.privacy || 'PUBLIC',
            group_id: event.postData?.groupId,
            media_type: event.postData?.mediaType || 'TEXT',
            created_at: new Date(event.timestamp).toISOString(),
        }).catch(err => this.logger.warn(`Failed to embed post: ${err.message}`));
    }

    /**
     * Remove post from AI Server
     */
    private async removePostFromAI(postId: string): Promise<void> {
        try {
            // Delete embedding from AI Server
            this.aiServerService.deletePostEmbedding(postId).catch(() => { });
            this.logger.log(`Triggered removal of post ${postId} from AI Server`);
        } catch (error) {
            this.logger.error(`Error removing post ${postId}:`, error);
        }
    }

    /**
     * Xử lý user interaction event
     */
    async handleInteractionEvent(event: UserInteractionEventDto): Promise<void> {
        this.logger.log(`Processing interaction: ${event.interactionType} by user ${event.userId}`);

        // 1. Push to AI Server for Real-time Learning (Async)
        if (event.targetType === 'POST' && event.targetId) {
            this.aiServerService.trackInteraction(
                event.userId,
                event.targetId,
                event.interactionType
            ).then(success => {
                if (success) this.logger.log(`⚡ Pushed interaction to AI Server: ${event.interactionType}`);
            }).catch(() => { });
        }

        // 2. Lưu interaction vào database để analytics
        await this.saveInteraction(event);

        // Logic xử lý interaction khác (follow/unfollow) giữ nguyên nếu cần thiết
        switch (event.interactionType) {
            case InteractionType.USER_FOLLOW:
                this.logger.log(`User ${event.userId} followed ${event.targetId}`);
                break;
            case InteractionType.USER_UNFOLLOW:
                this.logger.log(`User ${event.userId} unfollowed ${event.targetId}`);
                break;
        }
    }

    /**
     * Lưu interaction vào database
     */
    private async saveInteraction(event: UserInteractionEventDto): Promise<void> {
        try {
            const interaction = new this.userInteractionModel({
                userId: new Types.ObjectId(event.userId),
                interactionType: event.interactionType,
                targetId: event.targetId ? new Types.ObjectId(event.targetId) : undefined,
                targetType: event.targetType,
                metadata: event.metadata,
                eventTimestamp: new Date(event.timestamp),
            });
            await interaction.save();
        } catch (error) {
            this.logger.error('Error saving interaction:', error);
        }
    }
}
