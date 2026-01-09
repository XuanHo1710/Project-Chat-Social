import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { postService } from "@/services/post.service";
import { QUERY_KEYS } from "@/constants/query-keys";
import { CreatePostRequest, UpdatePostRequest } from "@/types/post";
import { toast } from "sonner";

/**
 * Hook to fetch posts with pagination
 */
export const useGetPosts = (params?: {
  page?: number;
  limit?: number;
  userId?: string;
}) => {
  return useQuery({
    queryKey: [QUERY_KEYS.POSTS_PAGINATED, params],
    queryFn: () => postService.getPosts(params),
  });
};

/**
 * Hook to fetch news feed posts
 */
export const useGetNewsFeed = (params?: {
  page?: number;
  limit?: number;
  friendIds?: string[];
}) => {
  return useQuery({
    queryKey: [QUERY_KEYS.NEWS_FEED, params],
    queryFn: () => postService.getNewsFeed(params),
  });
};

/**
 * Hook to fetch news feed posts with infinite scroll
 */
export const useGetNewsFeedInfinite = (limit: number = 20) => {
  return useInfiniteQuery({
    queryKey: [QUERY_KEYS.NEWS_FEED, 'infinite', limit],
    queryFn: ({ pageParam = 1 }) => postService.getNewsFeed({ page: pageParam, limit }),
    getNextPageParam: (lastPage, allPages) => {
      // Check if there are more posts to load
      // PostPageResponse returns { data: PostType[], total, page, totalPages }
      const totalPosts = lastPage?.data?.length || 0;
      if (totalPosts < limit) {
        // No more posts
        return undefined;
      }
      return allPages.length + 1;
    },
    initialPageParam: 1,
  });
};

/**
 * Hook to fetch posts by user ID
 */
export const useGetUserPosts = (
  userId: string,
  params?: { page?: number; limit?: number }
) => {
  return useQuery({
    queryKey: [QUERY_KEYS.USER_POSTS, userId, params],
    queryFn: () => postService.getPostsByUserId(userId, params),
    enabled: !!userId,
  });
};

/**
 * Hook to fetch posts by group ID
 */
export const useGetGroupPosts = (
  groupId: string,
  params?: { page?: number; limit?: number }
) => {
  return useQuery({
    queryKey: [QUERY_KEYS.GROUP_POSTS, groupId, params],
    queryFn: () => postService.getPostsByGroupId(groupId, params),
    enabled: !!groupId,
  });
};

/**
 * Hook to fetch a single post
 */
export const useGetPostById = (postId: string) => {
  return useQuery({
    queryKey: [QUERY_KEYS.POST_DETAIL, postId],
    queryFn: () => postService.getPostById(postId),
    enabled: !!postId,
  });
};

/**
 * Hook to create a new post
 */
export const useCreatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePostRequest) => postService.createPost(data),
    onSuccess: () => {
      // Invalidate all post-related queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NEWS_FEED] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.POSTS_PAGINATED] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.USER_POSTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GROUP_POSTS] });
      toast.success("Đăng bài thành công!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Đăng bài thất bại!");
    },
  });
};

/**
 * Hook to update a post
 */
export const useUpdatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      postId,
      data,
    }: {
      postId: string;
      data: UpdatePostRequest;
    }) => postService.updatePost(postId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NEWS_FEED] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.POSTS_PAGINATED] });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.POST_DETAIL, variables.postId],
      });
      toast.success("Cập nhật bài viết thành công!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Cập nhật bài viết thất bại!");
    },
  });
};

/**
 * Hook to delete a post
 */
export const useDeletePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => postService.deletePost(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.NEWS_FEED] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.POSTS_PAGINATED] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.USER_POSTS] });
      toast.success("Xóa bài viết thành công!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Xóa bài viết thất bại!");
    },
  });
};
