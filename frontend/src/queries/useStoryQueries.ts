import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/query-keys";
import * as storyService from "@/services/story.service";
import { CreateStoryPayload, UpdateStoryPayload } from "@/types/story";

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
 * Get story viewers
 */
export const useStoryViewers = (
  storyId: string,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: [QUERY_KEYS.STORY_DETAIL, storyId, "viewers"],
    queryFn: () => storyService.getStoryViewers(storyId),
    enabled: options?.enabled ?? !!storyId,
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
 * Update story mutation
 */
export const useUpdateStory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      storyId,
      payload,
    }: {
      storyId: string;
      payload: UpdateStoryPayload;
    }) => storyService.updateStory(storyId, payload),
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
  return useMutation({
    mutationFn: (storyId: string) => storyService.viewStory(storyId),
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
