import {
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import {
  getCommentsByPost,
  getCommentReplies,
  createComment,
  updateComment,
  deleteComment,
} from "@/services/comment.service";
import { CreateCommentPayload, UpdateCommentPayload } from "@/types/comment";

// Query keys
export const commentKeys = {
  all: ["comments"] as const,
  byPost: (postId: string) => [...commentKeys.all, "post", postId] as const,
  replies: (commentId: string) =>
    [...commentKeys.all, "replies", commentId] as const,
};

// Get comments for a post with infinite scroll
export const useGetComments = (postId: string, limit: number = 10) => {
  return useInfiniteQuery({
    queryKey: commentKeys.byPost(postId),
    queryFn: ({ pageParam = 1 }) => getCommentsByPost(postId, pageParam, limit),
    getNextPageParam: (lastPage) => {
      if (!lastPage?.pagination) return undefined;
      if (lastPage.pagination.page < lastPage.pagination.totalPages) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    enabled: !!postId,
  });
};

// Get replies for a comment
export const useGetReplies = (commentId: string, enabled: boolean = false) => {
  return useInfiniteQuery({
    queryKey: commentKeys.replies(commentId),
    queryFn: ({ pageParam = 1 }) => getCommentReplies(commentId, pageParam, 5),
    getNextPageParam: (lastPage) => {
      if (!lastPage?.pagination) return undefined;
      if (lastPage.pagination.page < lastPage.pagination.totalPages) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    enabled: enabled && !!commentId,
  });
};

// Create comment mutation
export const useCreateComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCommentPayload) => createComment(data),
    onSuccess: (newComment, variables) => {
      // Invalidate comments for this post
      queryClient.invalidateQueries({
        queryKey: commentKeys.byPost(variables.postId),
      });

      // If it's a reply, invalidate parent's replies
      if (variables.parentId) {
        queryClient.invalidateQueries({
          queryKey: commentKeys.replies(variables.parentId),
        });
      }

      // Update post's comment count in cache
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
};

// Update comment mutation
export const useUpdateComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      commentId,
      data,
    }: {
      commentId: string;
      data: UpdateCommentPayload;
    }) => updateComment(commentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.all });
    },
  });
};

// Delete comment mutation
export const useDeleteComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.all });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
};
