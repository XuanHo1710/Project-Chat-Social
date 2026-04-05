import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

export enum InteractionType {
  POST_VIEW = 'POST_VIEW',
  POST_LIKE = 'POST_LIKE',
  POST_UNLIKE = 'POST_UNLIKE',
  POST_COMMENT = 'POST_COMMENT',
  POST_SHARE = 'POST_SHARE',
  POST_SAVE = 'POST_SAVE',
  POST_UNSAVE = 'POST_UNSAVE',
  POST_HIDE = 'POST_HIDE',
  USER_FOLLOW = 'USER_FOLLOW',
  USER_UNFOLLOW = 'USER_UNFOLLOW',
  REEL_VIEW = 'REEL_VIEW',
  REEL_LIKE = 'REEL_LIKE',
}

export enum PostEventType {
  POST_CREATED = 'POST_CREATED',
  POST_UPDATED = 'POST_UPDATED',
  POST_DELETED = 'POST_DELETED',
  POST_SHARED = 'POST_SHARED',
}

export interface UserInteractionEvent {
  userId: string;
  interactionType: InteractionType;
  targetId?: string;
  targetType?: 'POST' | 'USER' | 'COMMENT' | 'STORY' | 'REEL';
  metadata?: {
    reactionType?: string;
    commentContent?: string;
    searchQuery?: string;
    timeSpentSeconds?: number;
    source?: string;
    deviceType?: string;
  };
  timestamp: number;
}

export interface PostEvent {
  eventType: PostEventType;
  postId: string;
  authorId: string;
  postData?: {
    content?: string;
    privacy?: string;
    mediaType?: string;
    groupId?: string;
  };
  followerIds?: string[];
  timestamp: number;
}

/**
 * Kafka Producer Service for Backend
 *
 * Emits events to Kafka topics:
 * - post-events: When posts are created, updated, deleted
 * - user-interactions: When users interact (like, comment, view, etc.)
 */
@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('KafkaProducer');
  private isConnected = false;

  constructor(
    @Inject('KAFKA_SERVICE')
    private readonly kafkaClient: ClientKafka
  ) {}

  async onModuleInit() {
    try {
      await this.kafkaClient.connect();
      this.isConnected = true;
      this.logger.log('✅ Connected to Kafka broker');
    } catch (error: any) {
      this.logger.warn('⚠️ Failed to connect to Kafka, events will be skipped:', error.message);
      this.isConnected = false;
    }
  }

  async onModuleDestroy() {
    if (this.isConnected) {
      await this.kafkaClient.close();
      this.logger.log('Disconnected from Kafka');
    }
  }

  /**
   * Emit post event to Kafka
   */
  async emitPostEvent(event: PostEvent): Promise<void> {
    if (!this.isConnected) {
      this.logger.debug('Kafka not connected, skipping post event');
      return;
    }

    try {
      this.kafkaClient.emit('post-events', {
        key: event.postId, // Partition by postId
        value: event,
      });
      this.logger.debug(`Emitted post event: ${event.eventType} for post ${event.postId}`);
    } catch (error) {
      this.logger.error('Error emitting post event:', error);
    }
  }

  /**
   * Emit user interaction event to Kafka
   */
  async emitInteractionEvent(event: UserInteractionEvent): Promise<void> {
    if (!this.isConnected) {
      this.logger.debug('Kafka not connected, skipping interaction event');
      return;
    }

    try {
      this.kafkaClient.emit('user-interactions', {
        key: event.userId, // Partition by userId
        value: event,
      });
      this.logger.debug(`Emitted interaction: ${event.interactionType} by ${event.userId}`);
    } catch (error) {
      this.logger.error('Error emitting interaction event:', error);
    }
  }

  // ============ Helper Methods for Common Events ============

  /**
   * Emit when a new post is created
   */
  async emitPostCreated(
    postId: string,
    authorId: string,
    followerIds: string[],
    postData?: { content?: string; privacy?: string; mediaType?: string; groupId?: string }
  ): Promise<void> {
    await this.emitPostEvent({
      eventType: PostEventType.POST_CREATED,
      postId,
      authorId,
      followerIds,
      postData,
      timestamp: Date.now(),
    });
  }

  /**
   * Emit when a post is deleted
   */
  async emitPostDeleted(postId: string, authorId: string): Promise<void> {
    await this.emitPostEvent({
      eventType: PostEventType.POST_DELETED,
      postId,
      authorId,
      timestamp: Date.now(),
    });
  }

  /**
   * Emit when a post is shared
   */
  async emitPostShared(postId: string, sharerId: string, followerIds: string[]): Promise<void> {
    await this.emitPostEvent({
      eventType: PostEventType.POST_SHARED,
      postId,
      authorId: sharerId,
      followerIds,
      timestamp: Date.now(),
    });
  }

  /**
   * Emit when user likes a post
   */
  async emitPostLike(userId: string, postId: string, reactionType?: string): Promise<void> {
    await this.emitInteractionEvent({
      userId,
      interactionType: InteractionType.POST_LIKE,
      targetId: postId,
      targetType: 'POST',
      metadata: { reactionType },
      timestamp: Date.now(),
    });
  }

  /**
   * Emit when user unlikes a post
   */
  async emitPostUnlike(userId: string, postId: string): Promise<void> {
    await this.emitInteractionEvent({
      userId,
      interactionType: InteractionType.POST_UNLIKE,
      targetId: postId,
      targetType: 'POST',
      timestamp: Date.now(),
    });
  }

  /**
   * Emit when user comments on a post
   */
  async emitPostComment(userId: string, postId: string, commentPreview?: string): Promise<void> {
    await this.emitInteractionEvent({
      userId,
      interactionType: InteractionType.POST_COMMENT,
      targetId: postId,
      targetType: 'POST',
      metadata: { commentContent: commentPreview?.substring(0, 100) },
      timestamp: Date.now(),
    });
  }

  /**
   * Emit when user views a post
   */
  async emitPostView(
    userId: string,
    postId: string,
    timeSpentSeconds?: number,
    source?: string
  ): Promise<void> {
    await this.emitInteractionEvent({
      userId,
      interactionType: InteractionType.POST_VIEW,
      targetId: postId,
      targetType: 'POST',
      metadata: { timeSpentSeconds, source },
      timestamp: Date.now(),
    });
  }

  /**
   * Emit when user follows another user
   */
  async emitUserFollow(userId: string, targetUserId: string): Promise<void> {
    await this.emitInteractionEvent({
      userId,
      interactionType: InteractionType.USER_FOLLOW,
      targetId: targetUserId,
      targetType: 'USER',
      timestamp: Date.now(),
    });
  }

  /**
   * Emit when user unfollows another user
   */
  async emitUserUnfollow(userId: string, targetUserId: string): Promise<void> {
    await this.emitInteractionEvent({
      userId,
      interactionType: InteractionType.USER_UNFOLLOW,
      targetId: targetUserId,
      targetType: 'USER',
      timestamp: Date.now(),
    });
  }

  /**
   * Emit when user hides a post from feed
   */
  async emitPostHide(userId: string, postId: string): Promise<void> {
    await this.emitInteractionEvent({
      userId,
      interactionType: InteractionType.POST_HIDE,
      targetId: postId,
      targetType: 'POST',
      timestamp: Date.now(),
    });
  }

  /**
   * Emit when user shares a post (Interaction Log)
   */
  async emitInteractionPostShare(
    userId: string,
    originalPostId: string,
    newSharePostId?: string
  ): Promise<void> {
    await this.emitInteractionEvent({
      userId,
      interactionType: InteractionType.POST_SHARE,
      targetId: originalPostId,
      targetType: 'POST',
      metadata: { source: newSharePostId },
      timestamp: Date.now(),
    });
  }
}
