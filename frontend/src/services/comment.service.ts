import axios, { unwrap } from "@/config/axios";
import {
  Comment,
  CommentsResponse,
  CreateCommentPayload,
  UpdateCommentPayload,
  CreateCommentReactionPayload,
  CommentReactionResponse,
  CommentReaction,
  CommentReactionType,
} from "@/types/comment";

// Default empty response
const emptyResponse: CommentsResponse = {
  data: [],
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
};

// Get comments for a post
export const getCommentsByPost = async (
  postId: string,
  page: number = 1,
  limit: number = 10
): Promise<CommentsResponse> => {
  try {
    const response = await axios.get(
      `/comment/post/${postId}?page=${page}&limit=${limit}`
    );
    // Backend wraps response in { data: actualData }
    return unwrap<CommentsResponse>(response.data) || emptyResponse;
  } catch {
    return emptyResponse;
  }
};

// Get replies for a comment
export const getCommentReplies = async (
  commentId: string,
  page: number = 1,
  limit: number = 5
): Promise<CommentsResponse> => {
  try {
    const response = await axios.get(
      `/comment/${commentId}/replies?page=${page}&limit=${limit}`
    );
    // Backend wraps response in { data: actualData }
    return unwrap<CommentsResponse>(response.data) || emptyResponse;
  } catch {
    return {
      ...emptyResponse,
      pagination: { ...emptyResponse.pagination, limit: 5 },
    };
  }
};

// Create a comment
export const createComment = async (
  data: CreateCommentPayload
): Promise<Comment> => {
  const response = await axios.post("/comment", data);
  // Backend wraps response in { data: actualData }
  return unwrap<Comment>(response.data);
};

// Update a comment
export const updateComment = async (
  commentId: string,
  data: UpdateCommentPayload
): Promise<Comment> => {
  const response = await axios.patch(`/comment/${commentId}`, data);
  // Backend wraps response in { data: actualData }
  return unwrap<Comment>(response.data);
};

// Delete a comment
export const deleteComment = async (commentId: string): Promise<void> => {
  await axios.delete(`/comment/${commentId}`);
};

// ==================== COMMENT REACTIONS (via unified Reaction API) ====================

// Toggle reaction on a comment
export const toggleCommentReaction = async (
  data: CreateCommentReactionPayload
): Promise<CommentReactionResponse> => {
  // Use new unified reaction endpoint
  const response = await axios.post("/reaction/comment", data);
  return unwrap<CommentReactionResponse>(response.data);
};

// Get user's reaction on a comment
export const getUserCommentReaction = async (
  commentId: string
): Promise<CommentReaction | null> => {
  try {
    // Use new unified reaction endpoint
    const response = await axios.get(`/reaction/comment/${commentId}/user`);
    return unwrap<CommentReaction>(response.data) || null;
  } catch {
    return null;
  }
};

// Get all reactions for a comment
export const getCommentReactions = async (
  commentId: string,
  page: number = 1,
  limit: number = 20
): Promise<{
  data: CommentReaction[];
  counts: Record<CommentReactionType, number>;
  total: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> => {
  // Use new unified reaction endpoint
  const response = await axios.get(
    `/reaction/comment/${commentId}?page=${page}&limit=${limit}`
  );
  return unwrap(response.data);
};
