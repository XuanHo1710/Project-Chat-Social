// Comment types
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
  parentId?: string;
  totalReplies: number;
  totalLikes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentPayload {
  postId: string;
  content: string;
  image?: string;
  parentId?: string;
}

export interface UpdateCommentPayload {
  content?: string;
  image?: string;
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
