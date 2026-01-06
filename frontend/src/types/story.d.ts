export type StoryType = "IMAGE" | "VIDEO";
export type StoryPrivacy = "PUBLIC" | "FRIENDS" | "CUSTOM";

export interface StoryViewer {
  userId: string;
  viewedAt: string;
  user?: {
    _id: string;
    firstName: string;
    lastName: string;
    avatar: string;
  };
}

export interface StoryReaction {
  userId: string;
  reaction: string;
  createdAt: string;
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
  privacy: StoryPrivacy;
  viewers: string[];
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
  privacy?: StoryPrivacy;
}
