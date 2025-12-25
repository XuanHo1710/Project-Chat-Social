// Reaction types
export type ReactionType = "LIKE" | "LOVE" | "HAHA" | "WOW" | "SAD" | "ANGRY";

export interface Reaction {
  _id: string;
  postId: string;
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

export interface CreateReactionPayload {
  postId: string;
  type: ReactionType;
}

export interface ToggleReactionResponse {
  action: "added" | "updated" | "removed";
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
