// Comment types
export interface CommentMedia {
  mediaType: "IMAGE" | "VIDEO";
  url: string;
  publicId?: string;
  width?: number;
  height?: number;
}

export type CommentReactionType =
  | "LIKE"
  | "LOVE"
  | "HAHA"
  | "WOW"
  | "SAD"
  | "ANGRY";

export interface CommentReaction {
  _id: string;
  commentId: string;
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  type: CommentReactionType;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  _id: string;
  postId: string;
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  content: string;
  image?: string;
  media?: CommentMedia[];
  parentId?: string;
  totalReplies: number;
  totalLikes: number;
  isActive: boolean;
  isEdited?: boolean;
  createdAt: string;
  updatedAt: string;
  // Client-side fields for reaction display
  userReaction?: CommentReactionType | null;
  topReactions?: { type: CommentReactionType; count: number }[];
  reactInfo?: {
    isReact: boolean;
    type: string | null;
  };
}

export interface CreateCommentPayload {
  postId: string;
  content: string;
  image?: string;
  media?: CommentMedia[];
  parentId?: string;
}

export interface UpdateCommentPayload {
  content?: string;
  image?: string;
  media?: CommentMedia[];
}

export interface CreateCommentReactionPayload {
  commentId: string;
  type: CommentReactionType;
}

export interface CommentReactionResponse {
  action: "added" | "updated" | "removed";
  reaction: CommentReaction | null;
  totalLikes: number;
}

export interface CommentsResponse {
  data: Comment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
