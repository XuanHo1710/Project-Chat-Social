import { create } from "zustand";
import { PostType } from "@/types/post";

interface PostStore {
  posts: PostType[];
  setPosts: (posts: PostType[]) => void;
  addPost: (post: PostType) => void;
  updatePost: (postId: string, updatedPost: Partial<PostType>) => void;
  deletePost: (postId: string) => void;
  incrementShareCount: (postId: string) => void;
}

export const usePostStore = create<PostStore>((set) => ({
  posts: [],

  setPosts: (posts) => set({ posts }),

  addPost: (post) =>
    set((state) => ({
      posts: [post, ...state.posts],
    })),

  updatePost: (postId, updatedPost) =>
    set((state) => ({
      posts: state.posts.map((post) =>
        post._id === postId ? { ...post, ...updatedPost } : post
      ),
    })),

  deletePost: (postId) =>
    set((state) => ({
      posts: state.posts.filter((post) => post._id !== postId),
    })),

  incrementShareCount: (postId) =>
    set((state) => ({
      posts: state.posts.map((post) =>
        post._id === postId
          ? { ...post, totalShares: (post.totalShares || 0) + 1 }
          : post
      ),
    })),
}));
