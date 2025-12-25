import axios from "@/config/axios";
import {
  CreatePostRequest,
  PostPageResponse,
  PostType,
  UpdatePostRequest,
} from "@/types/post";
import { APIResponse } from "@/types/common";

const PREFIX = "post";

class PostService {
  /**
   * Create a new post
   */
  async createPost(data: CreatePostRequest) {
    const response = await axios.post<APIResponse<PostType>>(
      `/${PREFIX}`,
      data
    );
    return response.data;
  }

  /**
   * Get all posts with pagination
   */
  async getPosts(params?: { page?: number; limit?: number; userId?: string }) {
    const response = await axios.get<APIResponse<PostPageResponse>>(
      `/${PREFIX}`,
      { params }
    );
    return response.data.data;
  }

  /**
   * Get news feed posts (public + friends' posts + own posts)
   */
  async getNewsFeed(params?: {
    page?: number;
    limit?: number;
    friendIds?: string[];
  }) {
    const queryParams = {
      page: params?.page,
      limit: params?.limit,
      friendIds: params?.friendIds?.join(","),
    };
    const response = await axios.get<APIResponse<PostPageResponse>>(
      `/${PREFIX}/news-feed`,
      { params: queryParams }
    );
    return response.data.data;
  }

  /**
   * Get posts by user ID
   */
  async getPostsByUserId(
    userId: string,
    params?: { page?: number; limit?: number }
  ) {
    const response = await axios.get<APIResponse<PostPageResponse>>(
      `/${PREFIX}/user/${userId}`,
      { params }
    );
    return response.data.data;
  }

  /**
   * Get a single post by ID
   */
  async getPostById(postId: string) {
    const response = await axios.get<APIResponse<PostType>>(
      `/${PREFIX}/${postId}`
    );
    return response.data.data;
  }

  /**
   * Update a post
   */
  async updatePost(postId: string, data: UpdatePostRequest) {
    const response = await axios.patch<APIResponse<PostType>>(
      `/${PREFIX}/${postId}`,
      data
    );
    return response.data;
  }

  /**
   * Delete a post (soft delete)
   */
  async deletePost(postId: string) {
    const response = await axios.delete<APIResponse<{ message: string }>>(
      `/${PREFIX}/${postId}`
    );
    return response.data;
  }
}

export const postService = new PostService();
