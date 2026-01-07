export type PostPrivacy = "PRIVATE" | "PUBLIC" | "FRIEND";
export type MediaType = "IMAGE" | "VIDEO";

export interface MediaItem {
  mediaType: MediaType;
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface PostAuthor {
  _id: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  username: string;
}

export interface PostType {
  _id: string;
  content: string;
  privacy: PostPrivacy;
  userId: PostAuthor;
  sharedPostId?: PostType | null; // Reference to shared post
  media: MediaItem[];
  background: string | null;
  totalReacts: number;
  totalComments: number;
  totalShares: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  // Client-side state
  currentReaction?: string | null;
  reactInfo?: {
    isReact: boolean;
    type: string | null;
  };
}

export interface CreatePostRequest {
  userId: string;
  content?: string;
  privacy?: PostPrivacy;
  media?: MediaItem[];
  background?: string | null;
  sharedPostId?: string | null;
}

export interface UpdatePostRequest {
  content?: string;
  privacy?: PostPrivacy;
  media?: MediaItem[];
  background?: string | null;
}

export interface PostPageResponse {
  data: PostType[];
  total: number;
  page: number;
  totalPages: number;
}

// For local state management during post creation
export interface PendingMediaItem {
  id: string; // Local ID for tracking
  file: File;
  preview: string; // Object URL for preview
  mediaType: MediaType;
  uploadStatus: "pending" | "uploading" | "uploaded" | "error";
  uploadProgress?: number;
  // After upload
  url?: string;
  publicId?: string;
  width?: number;
  height?: number;
  duration?: number;
}
