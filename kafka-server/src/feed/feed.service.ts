import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserFeed, UserFeedDocument } from './schemas/user-feed.schema';
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
        @InjectModel(UserFeed.name)
        private userFeedModel: Model<UserFeedDocument>,
        @InjectModel(UserInteraction.name)
        private userInteractionModel: Model<UserInteractionDocument>,
        private readonly aiServerService: AIServerService,
    ) { }

    /**
     * Xử lý post event - Fan-out bài viết đến followers
     */
    async handlePostEvent(event: PostEventDto): Promise<void> {
        this.logger.log(`Processing post event: ${event.eventType} for post ${event.postId}`);

        switch (event.eventType) {
            case PostEventType.POST_CREATED:
                await this.fanOutNewPost(event);
                break;
            case PostEventType.POST_DELETED:
                await this.removePostFromFeeds(event.postId);
                break;
            case PostEventType.POST_SHARED:
                await this.fanOutSharedPost(event);
                break;
            default:
                this.logger.warn(`Unknown post event type: ${event.eventType}`);
        }
    }

    /**
     * Fan-out new post to all followers' feeds
     */
    private async fanOutNewPost(event: PostEventDto): Promise<void> {
        if (!event.followerIds || event.followerIds.length === 0) {
            this.logger.log(`No followers to fan-out for post ${event.postId}`);
        }

        // 1. Embed post to AI Server (Async, don't block fan-out logic too long)
        this.aiServerService.embedPost({
            post_id: event.postId,
            content: event.postData?.content || '',
            user_id: event.authorId,
            privacy: event.postData?.privacy || 'PUBLIC',
            group_id: event.postData?.groupId,
            media_type: event.postData?.mediaType || 'TEXT',
            created_at: new Date(event.timestamp).toISOString(),
        }).catch(err => this.logger.warn(`Failed to embed post: ${err.message}`));

        if (!event.followerIds || event.followerIds.length === 0) return;


        const score = this.calculateInitialScore(event);

        // Process in batches to avoid memory issues
        const batchSize = 1000;
        for (let i = 0; i < event.followerIds.length; i += batchSize) {
            const batch = event.followerIds.slice(i, i + batchSize);

            const operations = batch.map(followerId => ({
                updateOne: {
                    filter: {
                        userId: new Types.ObjectId(followerId),
                        postId: new Types.ObjectId(event.postId)
                    },
                    update: {
                        $setOnInsert: {
                            userId: new Types.ObjectId(followerId),
                            postId: new Types.ObjectId(event.postId),
                            authorId: new Types.ObjectId(event.authorId),
                            actionType: 'POST_CREATED',
                            score,
                            postCreatedAt: new Date(event.timestamp),
                            isViewed: false,
                            isHidden: false,
                        },
                    },
                    upsert: true,
                },
            }));

            try {
                // Use any to bypass strict type checking for bulkWrite
                const result = await (this.userFeedModel as any).bulkWrite(operations);
                this.logger.log(
                    `Fan-out batch complete: ${result.upsertedCount || 0} new feeds for post ${event.postId}`
                );
            } catch (error) {
                this.logger.error(`Error during fan-out for post ${event.postId}:`, error);
            }
        }
    }

    /**
     * Fan-out shared post
     */
    private async fanOutSharedPost(event: PostEventDto): Promise<void> {
        if (!event.followerIds || event.followerIds.length === 0) {
            return;
        }

        const score = this.calculateInitialScore(event) * 0.8;

        for (const followerId of event.followerIds) {
            try {
                await (this.userFeedModel as any).updateOne(
                    {
                        userId: new Types.ObjectId(followerId),
                        postId: new Types.ObjectId(event.postId)
                    },
                    {
                        $set: {
                            userId: new Types.ObjectId(followerId),
                            postId: new Types.ObjectId(event.postId),
                            authorId: new Types.ObjectId(event.authorId),
                            actionType: 'POST_SHARED',
                            score,
                            postCreatedAt: new Date(event.timestamp),
                            isViewed: false,
                            isHidden: false,
                        },
                    },
                    { upsert: true }
                );
            } catch (error) {
                this.logger.error(`Error fan-out shared post to ${followerId}:`, error);
            }
        }

        this.logger.log(`Shared post fan-out complete for post ${event.postId}`);
    }

    /**
     * Remove post from all feeds when deleted
     */
    private async removePostFromFeeds(postId: string): Promise<void> {
        try {
            const result = await (this.userFeedModel as any).deleteMany({
                postId: new Types.ObjectId(postId),
            });
            this.logger.log(`Removed post ${postId} from ${result.deletedCount} feeds`);

            // Delete embedding from AI Server
            this.aiServerService.deletePostEmbedding(postId).catch(() => { });
        } catch (error) {
            this.logger.error(`Error removing post ${postId} from feeds:`, error);
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

        // Xử lý logic đặc biệt cho một số interaction types
        switch (event.interactionType) {
            case InteractionType.POST_LIKE:
                await this.handlePostLike(event);
                break;
            case InteractionType.USER_FOLLOW:
                await this.handleUserFollow(event);
                break;
            case InteractionType.USER_UNFOLLOW:
                await this.handleUserUnfollow(event);
                break;
            case InteractionType.POST_VIEW:
                await this.handlePostView(event);
                break;
            case InteractionType.POST_HIDE:
                await this.handlePostHide(event);
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

    /**
     * Khi user like post, tăng score của post trong feed
     */
    private async handlePostLike(event: UserInteractionEventDto): Promise<void> {
        if (!event.targetId) return;

        try {
            await (this.userFeedModel as any).updateMany(
                { postId: new Types.ObjectId(event.targetId) },
                { $inc: { score: 0.1 } }
            );
        } catch (error) {
            this.logger.error('Error updating score on like:', error);
        }
    }

    /**
     * Khi user follow someone
     */
    private async handleUserFollow(event: UserInteractionEventDto): Promise<void> {
        this.logger.log(`User ${event.userId} followed ${event.targetId}`);
    }

    /**
     * Khi user unfollow
     */
    private async handleUserUnfollow(event: UserInteractionEventDto): Promise<void> {
        this.logger.log(`User ${event.userId} unfollowed ${event.targetId}`);
    }

    /**
     * Khi user xem post, đánh dấu là đã xem
     */
    private async handlePostView(event: UserInteractionEventDto): Promise<void> {
        if (!event.targetId) return;

        try {
            await (this.userFeedModel as any).updateOne(
                {
                    userId: new Types.ObjectId(event.userId),
                    postId: new Types.ObjectId(event.targetId),
                },
                { $set: { isViewed: true } }
            );
        } catch (error) {
            this.logger.error('Error marking post as viewed:', error);
        }
    }

    /**
     * Khi user hide post
     */
    private async handlePostHide(event: UserInteractionEventDto): Promise<void> {
        if (!event.targetId) return;

        try {
            await (this.userFeedModel as any).updateOne(
                {
                    userId: new Types.ObjectId(event.userId),
                    postId: new Types.ObjectId(event.targetId),
                },
                { $set: { isHidden: true } }
            );
        } catch (error) {
            this.logger.error('Error hiding post:', error);
        }
    }

    /**
     * Tính điểm ban đầu cho post trong feed
     */
    private calculateInitialScore(event: PostEventDto): number {
        let score = 100;

        if (event.postData?.mediaType === 'VIDEO' || event.postData?.mediaType === 'REEL') {
            score += 20;
        }

        if (event.postData?.groupId) {
            score -= 10;
        }

        return score;
    }

    /**
     * Lấy feed cho user
     */
    async getUserFeed(
        userId: string,
        page: number = 1,
        limit: number = 20,
    ): Promise<UserFeedDocument[]> {
        const skip = (page - 1) * limit;

        // 1. Get from MongoDB (Following feed) - 80%
        const dbLimit = Math.floor(limit * 0.8);
        const dbFeedPromise = (this.userFeedModel as any)
            .find({
                userId: new Types.ObjectId(userId),
                isHidden: false,
            })
            .sort({ score: -1, postCreatedAt: -1 })
            .skip(skip)
            .limit(dbLimit)
            .lean();

        // 2. Get from AI Server (Recommendation feed) - 20% + fill gap if DB empty
        // Only fetch AI if page is small (e.g. < 5) to avoid deep pagination issues
        let aiFeed: any[] = [];
        if (page <= 5) {
            const aiLimit = limit - dbLimit;
            try {
                const aiResult = await this.aiServerService.getRecommendations(
                    userId,
                    [], // friends (could fetch from relationship service)
                    aiLimit,
                    page
                );

                if (aiResult.posts.length > 0) {
                    aiFeed = aiResult.posts.map(p => ({
                        _id: new Types.ObjectId(),
                        userId: new Types.ObjectId(userId),
                        postId: new Types.ObjectId(p.post_id),
                        authorId: new Types.ObjectId(), // Unknown here, client fetches details
                        actionType: 'RECOMMENDATION',
                        score: p.score,
                        postCreatedAt: new Date(),
                        isViewed: false,
                        isHidden: false,
                        isRecommended: true
                    }));
                }
            } catch (e) {
                this.logger.warn(`Failed to fetch AI feed: ${e.message}`);
            }
        }

        const [dbFeed] = await Promise.all([dbFeedPromise]);

        // Merge and shuffle slightly or just append (AI posts at bottom or mixed)
        // Here we just append AI items to fill the limit
        const mixedFeed = [...dbFeed, ...aiFeed];

        return mixedFeed as unknown as UserFeedDocument[];
    }
}
