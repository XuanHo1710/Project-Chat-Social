// DTO for notification events coming from Backend
export enum NotificationType {
  // Group notifications
  GROUP_INVITATION = 'GROUP_INVITATION',
  GROUP_REQUEST_APPROVED = 'GROUP_REQUEST_APPROVED',
  GROUP_REQUEST_REJECTED = 'GROUP_REQUEST_REJECTED',
  GROUP_ROLE_CHANGED = 'GROUP_ROLE_CHANGED',
  GROUP_OWNERSHIP_TRANSFERRED = 'GROUP_OWNERSHIP_TRANSFERRED',
  // Post notifications
  POST_COMMENTED = 'POST_COMMENTED',
  POST_REACTED = 'POST_REACTED',
  POST_SHARED = 'POST_SHARED',
  // Comment notifications
  COMMENT_REPLIED = 'COMMENT_REPLIED',
  COMMENT_REACTED = 'COMMENT_REACTED',
  // Relationship notifications
  FRIEND_REQUEST = 'FRIEND_REQUEST',
  FRIEND_ACCEPTED = 'FRIEND_ACCEPTED',
  // System notifications
  SYSTEM = 'SYSTEM',
}

export enum NotificationStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
}

// Event DTO từ Backend -> RabbitMQ
export class NotificationEventDto {
  recipientId: string;
  senderId?: string;
  type: NotificationType;
  title: string;
  message?: string;
  groupId?: string;
  postId?: string;
  commentId?: string;
  metadata?: Record<string, unknown>;
  typeReaction?: string;
  templateKey?: string;
  templateParams?: Record<string, string | number>;
  // Timestamp để delay logic
  timestamp?: number;
}

// Pending notification trong MongoDB (aggregated)
export class PendingNotificationDto {
  recipientId: string;
  senderIds: string[];
  type: NotificationType;
  title: string;
  message?: string;
  groupId?: string;
  postId?: string;
  commentId?: string;
  metadata?: Record<string, unknown>;
  typeReaction?: string;
  templateKey?: string;
  templateParams?: Record<string, string | number>;
  // Aggregation tracking
  aggregationKey: string; // Unique key for grouping (type + postId/commentId + recipientId)
  lastUpdated: Date;
  scheduledSendAt: Date; // When to actually send the notification
  isSent: boolean;
}
