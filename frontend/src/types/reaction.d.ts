// Reaction types
export type ReactionType = "LIKE" | "LOVE" | "HAHA" | "WOW" | "SAD" | "ANGRY";
export type TypeFactor = "POST" | "COMMENT" | "MESSAGE";

export interface Reaction {
  _id: string;
  factorId: string;
  typeFactor: TypeFactor;
  // Legacy fields for backward compatibility
  postId?: string;
  commentId?: string;
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  type: ReactionType;
  createdAt: string;
  updatedAt: string;
}

// Generic payload for new API
export interface CreateReactionPayload {
  factorId: string;
  typeFactor: TypeFactor;
  type: ReactionType;
}

// Legacy payloads for backward compatibility
export interface CreatePostReactionPayload {
  postId: string;
  type: ReactionType;
}

export interface CreateCommentReactionPayload {
  commentId: string;
  type: ReactionType;
}

export interface ToggleReactionResponse {
  action: "added" | "updated" | "removed" | "exists";
  reaction: Reaction | null;
  totalReacts: number;
}

export interface ReactionsResponse {
  data: Reaction[];
  counts: Record<ReactionType, number>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ReactionSummary {
  userReaction: ReactionType | null;
  topReactions: { type: ReactionType; count: number }[];
}

// Reaction emoji map
export const REACTION_EMOJI: Record<ReactionType, string> = {
  LIKE: "👍",
  LOVE: "❤️",
  HAHA: "😆",
  WOW: "😮",
  SAD: "😢",
  ANGRY: "😡",
};

export const REACTION_COLORS: Record<ReactionType, string> = {
  LIKE: "#1877f2",
  LOVE: "#f33e58",
  HAHA: "#f7b125",
  WOW: "#f7b125",
  SAD: "#f7b125",
  ANGRY: "#e9710f",
};

export const REACTION_LABELS: Record<ReactionType, string> = {
  LIKE: "Thích",
  LOVE: "Yêu thích",
  HAHA: "Haha",
  WOW: "Wow",
  SAD: "Buồn",
  ANGRY: "Phẫn nộ",
};
