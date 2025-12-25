import axios from "@/config/axios";
import {
  Comment,
  CommentsResponse,
  CreateCommentPayload,
  UpdateCommentPayload,
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
    const result = response.data?.data;
    return result || emptyResponse;
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
    const result = response.data?.data || response.data;
    return result || emptyResponse;
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
  return response.data?.data || response.data;
};

// Update a comment
export const updateComment = async (
  commentId: string,
  data: UpdateCommentPayload
): Promise<Comment> => {
  const response = await axios.patch(`/comment/${commentId}`, data);
  // Backend wraps response in { data: actualData }
  return response.data?.data || response.data;
};

// Delete a comment
export const deleteComment = async (commentId: string): Promise<void> => {
  await axios.delete(`/comment/${commentId}`);
};
