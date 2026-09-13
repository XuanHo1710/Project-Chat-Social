import { Types } from 'mongoose';
import { MessageCreatedEventDto } from '../dto/message.dto';
import { NotificationEventDto, NotificationType } from '../dto/notification.dto';

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

export class PermanentEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentEventError';
  }
}

function assertRecord(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PermanentEventError(`${field} must be an object`);
  }
}

export function assertObjectId(value: unknown, field: string): asserts value is string {
  if (
    typeof value !== 'string' ||
    !OBJECT_ID_PATTERN.test(value) ||
    !Types.ObjectId.isValid(value)
  ) {
    throw new PermanentEventError(`${field} must be a valid MongoDB ObjectId`);
  }
}

function requiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') throw new PermanentEventError(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new PermanentEventError(`${field} must contain 1-${maxLength} characters`);
  }
  return normalized;
}

function optionalString(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new PermanentEventError(`${field} is invalid`);
  }
  return value.trim();
}

function sanitizeMetadata(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  assertRecord(value, 'metadata');
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new PermanentEventError('metadata must be JSON serializable');
  }
  if (Buffer.byteLength(serialized, 'utf8') > 8_192) {
    throw new PermanentEventError('metadata is too large');
  }
  return sanitizeJsonObject(JSON.parse(serialized) as Record<string, unknown>, 0);
}

function sanitizeJsonObject(
  value: Record<string, unknown>,
  depth: number
): Record<string, unknown> {
  if (depth > 10) throw new PermanentEventError('metadata nesting is too deep');
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (
      key.length > 128 ||
      key.startsWith('$') ||
      key.includes('.') ||
      key === '__proto__' ||
      key === 'constructor' ||
      key === 'prototype'
    ) {
      continue;
    }
    if (Array.isArray(entry)) {
      result[key] = entry.slice(0, 100).map((item) => sanitizeJsonValue(item, depth + 1));
    } else {
      result[key] = sanitizeJsonValue(entry, depth + 1);
    }
  }
  return result;
}

function sanitizeJsonValue(value: unknown, depth: number): unknown {
  if (depth > 10) throw new PermanentEventError('metadata nesting is too deep');
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizeJsonValue(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    return sanitizeJsonObject(value as Record<string, unknown>, depth);
  }
  return value;
}

function sanitizeTemplateParams(value: unknown): Record<string, string | number> | undefined {
  if (value === undefined) return undefined;
  assertRecord(value, 'templateParams');
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new PermanentEventError('templateParams must be JSON serializable');
  }
  if (Buffer.byteLength(serialized, 'utf8') > 16_384) {
    throw new PermanentEventError('templateParams is too large');
  }
  const parsed = JSON.parse(serialized) as Record<string, unknown>;
  const result: Record<string, string | number> = {};
  for (const [key, entry] of Object.entries(parsed)) {
    if (!key || key.length > 128 || key.startsWith('$') || key.includes('.')) continue;
    if (typeof entry === 'string') {
      if (entry.length <= 512) result[key] = entry;
    } else if (typeof entry === 'number' && Number.isFinite(entry)) {
      result[key] = entry;
    }
  }
  return result;
}

export function validateMessageEvent(value: unknown): MessageCreatedEventDto {
  assertRecord(value, 'message event');
  assertObjectId(value.messageId, 'messageId');
  assertObjectId(value.conversationId, 'conversationId');
  assertObjectId(value.senderId, 'senderId');

  const allowedConversationTypes = ['DIRECT', 'GROUP', 'CHATBOT'] as const;
  if (
    !allowedConversationTypes.includes(
      value.conversationType as (typeof allowedConversationTypes)[number]
    )
  ) {
    throw new PermanentEventError('conversationType is invalid');
  }

  if (typeof value.content !== 'string' || value.content.length > 5_000) {
    throw new PermanentEventError('content is invalid');
  }

  let participantIds: string[] | undefined;
  if (value.participantIds !== undefined) {
    if (!Array.isArray(value.participantIds) || value.participantIds.length > 1_000) {
      throw new PermanentEventError('participantIds is invalid');
    }
    participantIds = [
      ...new Set(
        value.participantIds.map((id) => {
          assertObjectId(id, 'participantIds[]');
          return id;
        })
      ),
    ];
  }

  return {
    messageId: value.messageId,
    conversationId: value.conversationId,
    senderId: value.senderId,
    content: value.content,
    conversationType: value.conversationType as MessageCreatedEventDto['conversationType'],
    isChatbotConversation: Boolean(value.isChatbotConversation),
    isChatbotMentioned: Boolean(value.isChatbotMentioned),
    chatMessage: optionalString(value.chatMessage, 'chatMessage', 5_000),
    chatbotName: optionalString(value.chatbotName, 'chatbotName', 80),
    participantIds,
    senderName: optionalString(value.senderName, 'senderName', 160),
    senderAvatar: optionalString(value.senderAvatar, 'senderAvatar', 2_048),
  };
}

export function validateNotificationEvent(value: unknown): NotificationEventDto {
  assertRecord(value, 'notification event');
  assertObjectId(value.recipientId, 'recipientId');
  if (value.senderId !== undefined) assertObjectId(value.senderId, 'senderId');
  if (value.groupId !== undefined) assertObjectId(value.groupId, 'groupId');
  if (value.postId !== undefined) assertObjectId(value.postId, 'postId');
  if (value.commentId !== undefined) assertObjectId(value.commentId, 'commentId');

  if (!Object.values(NotificationType).includes(value.type as NotificationType)) {
    throw new PermanentEventError('notification type is invalid');
  }

  const timestamp = value.timestamp === undefined ? undefined : Number(value.timestamp);
  if (timestamp !== undefined && (!Number.isFinite(timestamp) || timestamp <= 0)) {
    throw new PermanentEventError('timestamp is invalid');
  }

  return {
    recipientId: value.recipientId,
    senderId: value.senderId,
    type: value.type as NotificationType,
    title: requiredString(value.title, 'title', 160),
    message: optionalString(value.message, 'message', 1_000),
    groupId: value.groupId,
    postId: value.postId,
    commentId: value.commentId,
    metadata: sanitizeMetadata(value.metadata),
    typeReaction: optionalString(value.typeReaction, 'typeReaction', 32),
    templateKey: optionalString(value.templateKey, 'templateKey', 200),
    templateParams: sanitizeTemplateParams(value.templateParams),
    timestamp,
  };
}
