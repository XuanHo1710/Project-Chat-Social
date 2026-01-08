export enum NotificationType {
  // Group notifications
  GROUP_INVITATION = "GROUP_INVITATION",
  GROUP_REQUEST_APPROVED = "GROUP_REQUEST_APPROVED",
  GROUP_REQUEST_REJECTED = "GROUP_REQUEST_REJECTED",
  GROUP_ROLE_CHANGED = "GROUP_ROLE_CHANGED",
  GROUP_OWNERSHIP_TRANSFERRED = "GROUP_OWNERSHIP_TRANSFERRED",
  // Post notifications
  POST_COMMENTED = "POST_COMMENTED",
  POST_REACTED = "POST_REACTED",
  POST_SHARED = "POST_SHARED",
  // Comment notifications
  COMMENT_REPLIED = "COMMENT_REPLIED",
  COMMENT_REACTED = "COMMENT_REACTED",
  // Relationship notifications
  FRIEND_REQUEST = "FRIEND_REQUEST",
  FRIEND_ACCEPTED = "FRIEND_ACCEPTED",
  // System notifications
  SYSTEM = "SYSTEM",
}

export enum NotificationStatus {
  UNREAD = "UNREAD",
  READ = "READ",
}

export interface NotificationSender {
  _id: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  username?: string;
}

export interface NotificationGroup {
  _id: string;
  name: string;
  avatar?: string;
  coverImage?: string;
}

export interface Notification {
  _id: string;
  recipientId: string;
  senderId?: NotificationSender;
  type: NotificationType;
  status: NotificationStatus;
  title: string;
  message: string;
  groupId?: NotificationGroup;
  postId?: string;
  commentId?: string;
  actionStatus?: "PENDING" | "ACCEPTED" | "REJECTED";
  metadata?: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  page: number;
  totalPages: number;
}

export interface UnreadCountResponse {
  unreadCount: number;
}
