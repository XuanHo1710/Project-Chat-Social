export type EmotionType = "LIKE" | "LOVE" | "FUNNY" | "SAD" | "ANGRY" | "WOW";

export type MessageType =
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "FILE"
  | "POST"
  | "SYSTEM";

export type MessageStatus = "SENT" | "DELIVERED" | "READ";

export interface MessageResponse {
  _id: string;

  conversationId: string;

  senderId: {
    firstName: string;
    lastName: string;
    _id: string;
  };

  type: MessageType;

  content: string;

  emotions?: Array<{
    userId: string;
    emotionType: EmotionType;
  }>;

  attachments?: string[];

  replyTo?: MessageResponse;

  postId?: string;

  status?: MessageStatus;

  readBy?: string[];

  createdAt: string;

  // Edit/Delete fields
  isEdited?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface SendMessagePayload {
  conversationId: string;
  senderId: string;
  type: MessageType;
  content: string;
  attachments?: string[];
  replyTo?: string;
  postId?: string;
}

export interface PaginatedMessagesResponse {
  messages: MessageResponse[];
  hasMore: boolean;
  nextCursor: string | null;
}
