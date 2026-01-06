import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/query-keys";
import * as storyService from "@/services/story.service";
import { CreateStoryPayload } from "@/types/story";

/**
 * Get stories feed
 */
export const useStoriesFeed = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.STORIES_FEED],
    queryFn: storyService.getStoriesFeed,
    staleTime: 1000 * 60, // 1 minute
  });
};

/**
 * Get my stories
 */
export const useMyStories = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.MY_STORIES],
    queryFn: storyService.getMyStories,
  });
};

/**
 * Create story mutation
 */
export const useCreateStory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateStoryPayload) =>
      storyService.createStory(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STORIES_FEED] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MY_STORIES] });
    },
  });
};

/**
 * View story mutation
 */
export const useViewStory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (storyId: string) => storyService.viewStory(storyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STORIES_FEED] });
    },
  });
};

/**
 * React to story mutation
 */
export const useReactToStory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      storyId,
      reaction,
    }: {
      storyId: string;
      reaction: string;
    }) => storyService.reactToStory(storyId, reaction),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STORIES_FEED] });
    },
  });
};

/**
 * Delete story mutation
 */
export const useDeleteStory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (storyId: string) => storyService.deleteStory(storyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STORIES_FEED] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MY_STORIES] });
    },
  });
};
