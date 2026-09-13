import axios, { unwrap } from "@/config/axios";
import {
  CreateReactionPayload,
  CreatePostReactionPayload,
  CreateCommentReactionPayload,
  ToggleReactionResponse,
  ReactionsResponse,
  Reaction,
  ReactionSummary,
  TypeFactor,
} from "@/types/reaction";

// Generic toggle reaction
export const toggleReaction = async (
  data: CreateReactionPayload
): Promise<ToggleReactionResponse> => {
  const response = await axios.post("/reaction", data);
  return unwrap<ToggleReactionResponse>(response.data);
};

// Legacy: Toggle reaction on a post
export const togglePostReaction = async (
  data: CreatePostReactionPayload
): Promise<ToggleReactionResponse> => {
  const response = await axios.post("/reaction/post", data);
  return unwrap<ToggleReactionResponse>(response.data);
};

// Legacy: Toggle reaction on a comment
export const toggleCommentReaction = async (
  data: CreateCommentReactionPayload
): Promise<ToggleReactionResponse> => {
  const response = await axios.post("/reaction/comment", data);
  return unwrap<ToggleReactionResponse>(response.data);
};

// Get reactions for a factor
export const getFactorReactions = async (
  factorId: string,
  typeFactor: TypeFactor,
  page: number = 1,
  limit: number = 20
): Promise<ReactionsResponse> => {
  const response = await axios.get(
    `/reaction/${typeFactor}/${factorId}?page=${page}&limit=${limit}`
  );
  return unwrap<ReactionsResponse>(response.data);
};

// Legacy: Get reactions for a post
export const getPostReactions = async (
  postId: string,
  page: number = 1,
  limit: number = 20
): Promise<ReactionsResponse> => {
  const response = await axios.get(
    `/reaction/post/${postId}?page=${page}&limit=${limit}`
  );
  return unwrap<ReactionsResponse>(response.data);
};

// Legacy: Get reactions for a comment
export const getCommentReactions = async (
  commentId: string,
  page: number = 1,
  limit: number = 20
): Promise<ReactionsResponse> => {
  const response = await axios.get(
    `/reaction/comment/${commentId}?page=${page}&limit=${limit}`
  );
  return unwrap<ReactionsResponse>(response.data);
};

// Get user's reaction on a factor
export const getUserReactionByFactor = async (
  factorId: string,
  typeFactor: TypeFactor
): Promise<Reaction | null> => {
  try {
    const response = await axios.get(`/reaction/${typeFactor}/${factorId}/user`);
    const result = unwrap<Reaction | null>(response.data);
    return result || null;
  } catch {
    return null;
  }
};

// Legacy: Get user's reaction on a post
export const getUserReaction = async (
  postId: string
): Promise<Reaction | null> => {
  try {
    const response = await axios.get(`/reaction/post/${postId}/user`);
    const result = unwrap<Reaction | null>(response.data);
    return result || null;
  } catch {
    return null;
  }
};

// Legacy: Get user's reaction on a comment
export const getUserCommentReaction = async (
  commentId: string
): Promise<Reaction | null> => {
  try {
    const response = await axios.get(`/reaction/comment/${commentId}/user`);
    const result = unwrap<Reaction | null>(response.data);
    return result || null;
  } catch {
    return null;
  }
};

// Get reaction summaries for multiple posts
export const getReactionsSummary = async (
  postIds: string[]
): Promise<Record<string, ReactionSummary>> => {
  const response = await axios.post("/reaction/summary", { postIds });
  return unwrap<Record<string, ReactionSummary>>(response.data);
};

// Generic: Get reaction summaries for multiple factors
export const getFactorReactionsSummary = async (
  factorIds: string[],
  typeFactor: TypeFactor
): Promise<Record<string, ReactionSummary>> => {
  const response = await axios.post(`/reaction/summary/${typeFactor}`, { factorIds });
  return unwrap<Record<string, ReactionSummary>>(response.data);
};
