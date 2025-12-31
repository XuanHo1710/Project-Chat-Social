import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  toggleReaction,
  togglePostReaction,
  toggleCommentReaction,
  getPostReactions,
  getCommentReactions,
  getUserReaction,
  getUserCommentReaction,
  getReactionsSummary,
} from "@/services/reaction.service";
import {
  CreateReactionPayload,
  CreatePostReactionPayload,
  CreateCommentReactionPayload
} from "@/types/reaction";

// Query keys
export const reactionKeys = {
  all: ["reactions"] as const,
  byPost: (postId: string) => [...reactionKeys.all, "post", postId] as const,
  byComment: (commentId: string) => [...reactionKeys.all, "comment", commentId] as const,
  userReaction: (postId: string) => [...reactionKeys.all, "user", postId] as const,
  userCommentReaction: (commentId: string) => [...reactionKeys.all, "user", "comment", commentId] as const,
  summary: (postIds: string[]) => [...reactionKeys.all, "summary", postIds.join(",")] as const,
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

// Get reactions for a comment
export const useGetCommentReactions = (
  commentId: string,
  enabled: boolean = false
) => {
  return useQuery({
    queryKey: reactionKeys.byComment(commentId),
    queryFn: () => getCommentReactions(commentId),
    enabled: enabled && !!commentId,
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

// Get user's reaction on a comment
export const useGetUserCommentReaction = (commentId: string) => {
  return useQuery({
    queryKey: reactionKeys.userCommentReaction(commentId),
    queryFn: () => getUserCommentReaction(commentId),
    enabled: !!commentId,
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

// Generic toggle reaction mutation
export const useToggleReaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateReactionPayload) => toggleReaction(data),
    onSuccess: (result, variables) => {
      // Invalidate related queries based on typeFactor
      if (variables.typeFactor === 'POST') {
        queryClient.invalidateQueries({
          queryKey: reactionKeys.userReaction(variables.factorId),
        });
        queryClient.invalidateQueries({
          queryKey: reactionKeys.byPost(variables.factorId),
        });
      } else if (variables.typeFactor === 'COMMENT') {
        queryClient.invalidateQueries({
          queryKey: reactionKeys.userCommentReaction(variables.factorId),
        });
        queryClient.invalidateQueries({
          queryKey: reactionKeys.byComment(variables.factorId),
        });
      }
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
};

// Legacy: Toggle reaction on a post
export const useTogglePostReaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePostReactionPayload) => togglePostReaction(data),
    onSuccess: (result, variables) => {
      queryClient.setQueryData(
        reactionKeys.userReaction(variables.postId),
        result.reaction || null
      );
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

// Legacy: Toggle reaction on a comment
export const useToggleCommentReaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCommentReactionPayload) => toggleCommentReaction(data),
    onSuccess: (result, variables) => {
      queryClient.setQueryData(
        reactionKeys.userCommentReaction(variables.commentId),
        result.reaction || null
      );
      queryClient.invalidateQueries({
        queryKey: reactionKeys.userCommentReaction(variables.commentId),
      });
      queryClient.invalidateQueries({
        queryKey: reactionKeys.byComment(variables.commentId),
      });
    },
  });
};
