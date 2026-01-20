import { PostType } from "@/types/post";

export type EmotionType = "LIKE" | "LOVE" | "FUNNY" | "SAD" | "ANGRY" | "WOW";

export type MessageType =
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "FILE"
  | "POST"
  | "SYSTEM"
  | "STORY_REPLY"
  | "CHATBOT";

export type MessageStatus = "SENT" | "DELIVERED" | "READ";

export interface AttachmentData {
  url: string;
  fileName: string;
  fileSize: number;
  mediaType: "IMAGE" | "VIDEO" | "RAW";
}

export interface MessageResponse {
  _id: string;

  conversationId: string;

  isMuted?: boolean;

  senderId: {
    firstName: string;
    lastName: string;
    _id: string;
    avatar: string;
  }; // For CHATBOT type, this is the user who triggered the bot

  type: MessageType;

  content: string;

  emotions?: Array<{
    userId: string;
    emotionType: EmotionType;
  }>;

  attachments?: AttachmentData[];

  replyTo?: MessageResponse;

  postId?: PostType;

  postIdsRecommendationfromAI?: PostType[]; // Multiple AI-suggested posts (for CHATBOT)

  // Story reply fields
  storyReply?: {
    storyId: string;
    storyMediaUrl: string;
    storyOwnerId: string;
    storyOwnerName: string;
    storyCaption?: string;
  };

  status?: MessageStatus;

  readBy?: Array<{
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  }>;

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
  attachments?: AttachmentData[];
  replyTo?: string;
  postId?: string;
  storyReply?: {
    storyId: string;
    storyMediaUrl: string;
    storyOwnerId: string;
    storyOwnerName: string;
    storyCaption?: string;
  };
}

export interface PaginatedMessagesResponse {
  messages: MessageResponse[];
  hasMore: boolean;
  nextCursor: string | null;
}
