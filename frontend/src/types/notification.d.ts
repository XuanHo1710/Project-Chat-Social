export type NotificationEnum =
  | "GROUP_INVITATION"
  | "GROUP_REQUEST_APPROVED"
  | "GROUP_REQUEST_REJECTED"
  | "GROUP_ROLE_CHANGED"
  | "GROUP_OWNERSHIP_TRANSFERRED"
  // Post notifications
  | "POST_COMMENTED"
  | "POST_REACTED"
  | "POST_SHARED"
  // Comment notifications
  | "COMMENT_REPLIED"
  | "COMMENT_REACTED"
  // Relationship notifications
  | "FRIEND_REQUEST"
  | "FRIEND_ACCEPTED"
  // System notifications
  | "SYSTEM";

export type NotificationEnumStatus = "UNREAD" | "READ";

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
  type: NotificationEnum;
  status: NotificationEnumStatus;
  title: string;
  message: string;
  groupId?: NotificationGroup;
  postId?: string;
  commentId?: string;
  actionStatus?: "PENDING" | "ACCEPTED" | "REJECTED";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  typeReaction?: string;
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
