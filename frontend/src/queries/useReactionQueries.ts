import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  toggleReaction,
  getPostReactions,
  getUserReaction,
  getReactionsSummary,
} from "@/services/reaction.service";
import { CreateReactionPayload } from "@/types/reaction";

// Query keys
export const reactionKeys = {
  all: ["reactions"] as const,
  byPost: (postId: string) => [...reactionKeys.all, "post", postId] as const,
  userReaction: (postId: string) =>
    [...reactionKeys.all, "user", postId] as const,
  summary: (postIds: string[]) =>
    [...reactionKeys.all, "summary", postIds.join(",")] as const,
};

// Get reactions for a post
export const useGetPostReactions = (
  postId: string,
  enabled: boolean = false
) => {
  return useQuery({
    queryKey: reactionKeys.byPost(postId),
    queryFn: () => getPostReactions(postId),
    enabled: enabled && !!postId,
  });
};

// Get user's reaction on a post
export const useGetUserReaction = (postId: string) => {
  return useQuery({
    queryKey: reactionKeys.userReaction(postId),
    queryFn: () => getUserReaction(postId),
    enabled: !!postId,
  });
};

// Get reaction summaries for multiple posts
export const useGetReactionsSummary = (postIds: string[]) => {
  return useQuery({
    queryKey: reactionKeys.summary(postIds),
    queryFn: () => getReactionsSummary(postIds),
    enabled: postIds.length > 0,
  });
};

// Toggle reaction mutation
export const useToggleReaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateReactionPayload) => toggleReaction(data),
    onSuccess: (result, variables) => {
      // Immediately update user reaction in cache
      queryClient.setQueryData(
        reactionKeys.userReaction(variables.postId),
        result.reaction || null
      );

      // Invalidate and refetch related queries
      queryClient.invalidateQueries({
        queryKey: reactionKeys.userReaction(variables.postId),
      });
      queryClient.invalidateQueries({
        queryKey: reactionKeys.byPost(variables.postId),
      });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
};
