import axios from "@/config/axios";
import {
  Story,
  StoryGroup,
  CreateStoryPayload,
  UpdateStoryPayload,
  StoryViewer,
  StoryReaction,
} from "@/types/story";
import { APIResponse } from "@/types/common";

/**
 * Get stories feed (friends' stories)
 */
export const getStoriesFeed = async (): Promise<APIResponse<StoryGroup[]>> => {
  const response = await axios.get<APIResponse<StoryGroup[]>>("/story/feed");
  return response.data;
};

/**
 * Get my own stories
 */
export const getMyStories = async (): Promise<APIResponse<Story[]>> => {
  const response = await axios.get<APIResponse<Story[]>>("/story/my");
  return response.data;
};

/**
 * Get a single story
 */
export const getStoryById = async (
  storyId: string
): Promise<APIResponse<Story>> => {
  const response = await axios.get<APIResponse<Story>>(`/story/${storyId}`);
  return response.data;
};

/**
 * Create a new story
 */
export const createStory = async (
  payload: CreateStoryPayload
): Promise<APIResponse<Story>> => {
  const response = await axios.post<APIResponse<Story>>("/story", payload);
  return response.data;
};

/**
 * Update a story
 */
export const updateStory = async (
  storyId: string,
  payload: UpdateStoryPayload
): Promise<APIResponse<Story>> => {
  const response = await axios.patch<APIResponse<Story>>(
    `/story/${storyId}`,
    payload
  );
  return response.data;
};

/**
 * Mark story as viewed
 */
export const viewStory = async (storyId: string): Promise<void> => {
  await axios.post(`/story/${storyId}/view`);
};

/**
 * React to a story
 */
export const reactToStory = async (
  storyId: string,
  reaction: string
): Promise<APIResponse<Story>> => {
  const response = await axios.post<APIResponse<Story>>("/story/react", {
    storyId,
    reaction,
  });
  return response.data;
};

/**
 * Delete a story
 */
export const deleteStory = async (storyId: string): Promise<void> => {
  await axios.delete(`/story/${storyId}`);
};

/**
 * Get story viewers with reactions
 */
export const getStoryViewers = async (
  storyId: string
): Promise<APIResponse<{ viewers: StoryViewer[]; totalViews: number }>> => {
  const response = await axios.get<
    APIResponse<{ viewers: StoryViewer[]; totalViews: number }>
  >(`/story/${storyId}/viewers`);
  return response.data;
};

/**
 * Get story reactions
 */
export const getStoryReactions = async (
  storyId: string
): Promise<APIResponse<StoryReaction[]>> => {
  const response = await axios.get<APIResponse<StoryReaction[]>>(
    `/story/${storyId}/reactions`
  );
  return response.data;
};
