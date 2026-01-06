import axios from "@/config/axios";
import {
  Story,
  StoryGroup,
  CreateStoryPayload,
  StoryViewer,
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
 * Get story viewers
 */
export const getStoryViewers = async (
  storyId: string
): Promise<APIResponse<StoryViewer[]>> => {
  const response = await axios.get<APIResponse<StoryViewer[]>>(
    `/story/${storyId}/viewers`
  );
  return response.data;
};
