import { create } from "zustand";
import { PostType } from "@/types/post";

interface GroupPostStore {
  groupPosts: Record<string, PostType[]>; // Map groupId -> posts

  // Set posts for a specific group
  setGroupPosts: (groupId: string, posts: PostType[]) => void;

  // Add a new post to a specific group (prepend to beginning)
  addGroupPost: (groupId: string, post: PostType) => void;

  // Update a post in a specific group
  updateGroupPost: (
    groupId: string,
    postId: string,
    updatedPost: Partial<PostType>
  ) => void;

  // Delete a post from a specific group
  deleteGroupPost: (groupId: string, postId: string) => void;

  // Get posts for a specific group
  getGroupPosts: (groupId: string) => PostType[];

  // Clear posts for a specific group
  clearGroupPosts: (groupId: string) => void;

  // Restore initial state
  reset: () => void;
}

export const useGroupPostStore = create<GroupPostStore>((set, get) => ({
  groupPosts: {},

  reset: () => set({ groupPosts: {} }),

  setGroupPosts: (groupId, posts) =>
    set((state) => ({
      groupPosts: {
        ...state.groupPosts,
        [groupId]: posts,
      },
    })),

  addGroupPost: (groupId, post) =>
    set((state) => ({
      groupPosts: {
        ...state.groupPosts,
        [groupId]: [post, ...(state.groupPosts[groupId] || [])],
      },
    })),

  updateGroupPost: (groupId, postId, updatedPost) =>
    set((state) => ({
      groupPosts: {
        ...state.groupPosts,
        [groupId]: (state.groupPosts[groupId] || []).map((post) =>
          post._id === postId ? { ...post, ...updatedPost } : post
        ),
      },
    })),

  deleteGroupPost: (groupId, postId) =>
    set((state) => ({
      groupPosts: {
        ...state.groupPosts,
        [groupId]: (state.groupPosts[groupId] || []).filter(
          (post) => post._id !== postId
        ),
      },
    })),

  getGroupPosts: (groupId) => get().groupPosts[groupId] || [],

  clearGroupPosts: (groupId) =>
    set((state) => {
      const newGroupPosts = { ...state.groupPosts };
      delete newGroupPosts[groupId];
      return { groupPosts: newGroupPosts };
    }),
}));
