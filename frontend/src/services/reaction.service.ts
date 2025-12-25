import axios from "@/config/axios";
import {
  CreateReactionPayload,
  ToggleReactionResponse,
  ReactionsResponse,
  Reaction,
  ReactionSummary,
} from "@/types/reaction";

// Toggle reaction on a post
export const toggleReaction = async (
  data: CreateReactionPayload
): Promise<ToggleReactionResponse> => {
  const response = await axios.post("/reaction", data);
  // Backend wraps response in { data: actualData }
  return response.data?.data || response.data;
};

// Get reactions for a post
export const getPostReactions = async (
  postId: string,
  page: number = 1,
  limit: number = 20
): Promise<ReactionsResponse> => {
  const response = await axios.get(
    `/reaction/post/${postId}?page=${page}&limit=${limit}`
  );
  // Backend wraps response in { data: actualData }
  return response.data?.data || response.data;
};

// Get user's reaction on a post
export const getUserReaction = async (
  postId: string
): Promise<Reaction | null> => {
  try {
    const response = await axios.get(`/reaction/post/${postId}/user`);
    // Backend wraps response in { data: actualData }
    const result = response.data?.data ?? response.data;
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
  // Backend wraps response in { data: actualData }
  return response.data?.data || response.data;
};
