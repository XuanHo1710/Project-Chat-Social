import { Types } from 'mongoose';
import {
  InteractionType,
  PostEventDto,
  PostEventType,
  UserInteractionEventDto,
} from './dto/feed-event.dto';

const MAX_CONTENT_LENGTH = 10_000;
const MAX_METADATA_BYTES = 8_192;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export class InvalidFeedEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidFeedEventError';
  }
}

function assertRecord(
  value: unknown,
  field: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidFeedEventError(`${field} must be an object`);
  }
}

function assertObjectId(
  value: unknown,
  field: string,
): asserts value is string {
  if (
    typeof value !== 'string' ||
    !Types.ObjectId.isValid(value) ||
    !/^[a-f\d]{24}$/i.test(value)
  ) {
    throw new InvalidFeedEventError(
      `${field} must be a valid MongoDB ObjectId`,
    );
  }
}

function normalizeTimestamp(value: unknown): number {
  const timestamp =
    typeof value === 'string' ? Date.parse(value) : Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    throw new InvalidFeedEventError('timestamp must be a valid date');
  }
  if (timestamp > Date.now() + MAX_CLOCK_SKEW_MS) {
    throw new InvalidFeedEventError('timestamp is too far in the future');
  }
  return timestamp;
}

function sanitizeMetadata(value: unknown): UserInteractionEventDto['metadata'] {
  if (value === undefined) return undefined;
  assertRecord(value, 'metadata');

  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_METADATA_BYTES) {
    throw new InvalidFeedEventError('metadata is too large');
  }

  const metadata: NonNullable<UserInteractionEventDto['metadata']> = {};
  if (typeof value.reactionType === 'string')
    metadata.reactionType = value.reactionType.slice(0, 32);
  if (typeof value.commentContent === 'string')
    metadata.commentContent = value.commentContent.slice(0, 200);
  if (typeof value.searchQuery === 'string')
    metadata.searchQuery = value.searchQuery.slice(0, 200);
  if (typeof value.source === 'string')
    metadata.source = value.source.slice(0, 100);
  if (typeof value.deviceType === 'string')
    metadata.deviceType = value.deviceType.slice(0, 32);
  if (value.timeSpentSeconds !== undefined) {
    const seconds = Number(value.timeSpentSeconds);
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 86_400) {
      throw new InvalidFeedEventError('metadata.timeSpentSeconds is invalid');
    }
    metadata.timeSpentSeconds = seconds;
  }
  return metadata;
}

export function validateInteractionEvent(
  value: unknown,
): UserInteractionEventDto {
  assertRecord(value, 'interaction event');
  assertObjectId(value.userId, 'userId');

  if (
    !Object.values(InteractionType).includes(
      value.interactionType as InteractionType,
    )
  ) {
    throw new InvalidFeedEventError('interactionType is not supported');
  }

  if (value.targetId !== undefined) assertObjectId(value.targetId, 'targetId');
  const allowedTargetTypes = [
    'POST',
    'USER',
    'COMMENT',
    'STORY',
    'REEL',
  ] as const;
  if (
    value.targetType !== undefined &&
    !allowedTargetTypes.includes(
      value.targetType as (typeof allowedTargetTypes)[number],
    )
  ) {
    throw new InvalidFeedEventError('targetType is not supported');
  }

  return {
    userId: value.userId,
    interactionType: value.interactionType as InteractionType,
    targetId: value.targetId,
    targetType: value.targetType as UserInteractionEventDto['targetType'],
    metadata: sanitizeMetadata(value.metadata),
    timestamp: normalizeTimestamp(value.timestamp),
  };
}

export function validatePostEvent(value: unknown): PostEventDto {
  assertRecord(value, 'post event');
  assertObjectId(value.postId, 'postId');
  assertObjectId(value.authorId, 'authorId');

  if (
    !Object.values(PostEventType).includes(value.eventType as PostEventType)
  ) {
    throw new InvalidFeedEventError('eventType is not supported');
  }

  let postData: PostEventDto['postData'];
  if (value.postData !== undefined) {
    assertRecord(value.postData, 'postData');
    const content = value.postData.content;
    if (
      content !== undefined &&
      (typeof content !== 'string' || content.length > MAX_CONTENT_LENGTH)
    ) {
      throw new InvalidFeedEventError('postData.content is invalid');
    }
    if (value.postData.groupId !== undefined)
      assertObjectId(value.postData.groupId, 'postData.groupId');

    const privacy = value.postData.privacy;
    const allowedPrivacy = ['PUBLIC', 'FRIEND', 'PRIVATE', 'GROUP'];
    if (
      privacy !== undefined &&
      (typeof privacy !== 'string' || !allowedPrivacy.includes(privacy))
    ) {
      throw new InvalidFeedEventError('postData.privacy is invalid');
    }

    const mediaType = value.postData.mediaType;
    if (
      mediaType !== undefined &&
      (typeof mediaType !== 'string' || mediaType.length > 32)
    ) {
      throw new InvalidFeedEventError('postData.mediaType is invalid');
    }

    postData = {
      content,
      privacy,
      mediaType,
      groupId: value.postData.groupId,
    };
  }

  let followerIds: string[] | undefined;
  if (value.followerIds !== undefined) {
    if (!Array.isArray(value.followerIds) || value.followerIds.length > 5_000) {
      throw new InvalidFeedEventError(
        'followerIds must contain at most 5000 users',
      );
    }
    followerIds = [
      ...new Set(
        value.followerIds.map((followerId) => {
          assertObjectId(followerId, 'followerIds[]');
          return followerId;
        }),
      ),
    ];
  }

  return {
    eventType: value.eventType as PostEventType,
    postId: value.postId,
    authorId: value.authorId,
    postData,
    followerIds,
    timestamp: normalizeTimestamp(value.timestamp),
  };
}
