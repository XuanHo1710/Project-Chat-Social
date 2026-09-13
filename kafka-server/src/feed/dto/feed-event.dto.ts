// DTOs for Kafka events

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

/**
 * DTO cho user interaction events
 * Topic: user-interactions
 */
export class UserInteractionEventDto {
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

/**
 * DTO cho post events
 * Topic: post-events
 */
export class PostEventDto {
  eventType: PostEventType;
  postId: string;
  authorId: string;
  postData?: {
    content?: string;
    privacy?: string;
    mediaType?: string;
    groupId?: string;
  };
  // List of follower IDs to fan-out to (for POST_CREATED)
  followerIds?: string[];
  timestamp: number;
}

/**
 * DTO cho feed update events
 * Topic: feed-updates
 */
export class FeedUpdateDto {
  userId: string;
  action: 'ADD' | 'REMOVE' | 'UPDATE';
  postId: string;
  authorId: string;
  actionType: string;
  score: number;
  postCreatedAt: Date;
}
