import { StatusEnum } from "@/types/account";

export type StoryType = "IMAGE" | "VIDEO";
export type StoryPrivacy = "PUBLIC" | "FRIENDS" | "PRIVATE" | "CUSTOM";

export interface StoryViewer {
  userId: string;
  viewedAt: string;
  user?: {
    _id: string;
    firstName: string;
    lastName: string;
    avatar: string;
    status: StatusEnum;
  };
  reaction?: string | null;
}

export interface StoryReaction {
  userId:
    | string
    | {
        _id: string;
        firstName: string;
        lastName: string;
        avatar: string;
      };
  reaction: string;
  createdAt: string;
}

export interface CaptionStyle {
  x: number;
  y: number;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
}

export interface Story {
  _id: string;
  userId:
    | string
    | {
        _id: string;
        firstName: string;
        lastName: string;
        avatar: string;
      };
  type: StoryType;
  mediaUrl: string;
  thumbnail?: string;
  duration?: number;
  caption?: string;
  captionStyle?: CaptionStyle;
  privacy: StoryPrivacy;
  viewers: StoryViewer[];
  viewCount?: number;
  reactions: StoryReaction[];
  createdAt: string;
  expiresAt: string;
  isArchived: boolean;
  isDeleted: boolean;
}

export interface StoryGroup {
  _id: string;
  user: {
    _id: string;
    firstName: string;
    lastName: string;
    avatar: string;
  };
  stories: Story[];
  latestStory: Story;
  hasUnviewed: boolean;
}

export interface CreateStoryPayload {
  type: StoryType;
  mediaUrl: string;
  thumbnail?: string;
  duration?: number;
  caption?: string;
  captionStyle?: CaptionStyle;
  privacy?: StoryPrivacy;
}

export interface UpdateStoryPayload {
  caption?: string;
  captionStyle?: CaptionStyle;
  privacy?: StoryPrivacy;
}
