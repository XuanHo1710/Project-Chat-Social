import axios, { unwrap } from "@/config/axios";
import { APIResponse } from "@/types/common";

const PREFIX = "admin";

// Types
export interface DashboardStats {
  totalUsers: number;
  newUsersToday: number;
  userChange: number;
  onlineUsers: number;
  totalPosts: number;
  newPostsToday: number;
  totalComments: number;
  totalReactions: number;
}

export interface WeeklyPostStat {
  day: string;
  count: number;
}

export interface TopPageStat {
  name: string;
  views: number;
  percentage: number;
}

export interface RecentComment {
  id: string;
  user: string;
  avatar: string;
  content: string;
  time: string;
}

export interface EmotionStat {
  type: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: "USER" | "ADMIN" | "EMPLOYEE";
  status: "ACTIVE" | "BLOCKED" | "PENDING";
  lastLogin: string | null;
  createdAt: string;
  isBlocked?: boolean;
  phone?: string;
  username?: string;
}

export interface AdminPost {
  id: string;
  author: string;
  authorAvatar?: string;
  content: string;
  privacy: string;
  reactions: number;
  comments: number;
  shares: number;
  status: "ACTIVE" | "HIDDEN" | "REPORTED";
  time: string;
  createdAt: string;
}

export interface AdminPostDetail {
  _id: string;
  content: string;
  privacy: string;
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    username: string;
  };
  media: {
    mediaType: "IMAGE" | "VIDEO";
    url: string;
    publicId?: string;
    width?: number;
    height?: number;
  }[];
  background?: string | null;
  totalReacts: number;
  totalComments: number;
  totalShares: number;
  isActive: boolean;
  type?: string;
  createdAt: string;
  updatedAt: string;
  groupId?: { _id: string; name: string; avatar?: string } | null;
}

export interface PaginationResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UserQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  role?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
}

export interface PostQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  privacy?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
}

class AdminService {
  // ========== DASHBOARD STATISTICS ==========

  async getDashboardStats(): Promise<DashboardStats> {
    const response = await axios.get<APIResponse<DashboardStats>>(
      `/${PREFIX}/stats`,
    );
    return unwrap<DashboardStats>(response.data);
  }

  async getWeeklyPostsStats(): Promise<WeeklyPostStat[]> {
    const response = await axios.get<APIResponse<WeeklyPostStat[]>>(
      `/${PREFIX}/stats/weekly-posts`,
    );
    return unwrap<WeeklyPostStat[]>(response.data);
  }

  async getTopPagesStats(): Promise<TopPageStat[]> {
    const response = await axios.get<APIResponse<TopPageStat[]>>(
      `/${PREFIX}/stats/top-pages`,
    );
    return unwrap<TopPageStat[]>(response.data);
  }

  async getRecentComments(): Promise<RecentComment[]> {
    const response = await axios.get<APIResponse<RecentComment[]>>(
      `/${PREFIX}/stats/recent-comments`,
    );
    return unwrap<RecentComment[]>(response.data);
  }

  async getEmotionStats(): Promise<EmotionStat[]> {
    const response = await axios.get<APIResponse<EmotionStat[]>>(
      `/${PREFIX}/stats/emotions`,
    );
    return unwrap<EmotionStat[]>(response.data);
  }

  async getTrafficData(
    days: number = 7,
  ): Promise<Array<{ date: string; logins: number; activeUsers: number }>> {
    const response = await axios.get<
      APIResponse<Array<{ date: string; logins: number; activeUsers: number }>>
    >(`/${PREFIX}/stats/traffic`, { params: { days } });
    return unwrap<Array<{ date: string; logins: number; activeUsers: number }>>(
      response.data,
    );
  }

  // ========== USER MANAGEMENT ==========

  async getUsers(
    params: UserQueryParams = {},
  ): Promise<PaginationResponse<AdminUser>> {
    const response = await axios.get<
      APIResponse<PaginationResponse<AdminUser>>
    >(`/${PREFIX}/users`, { params });
    return unwrap<PaginationResponse<AdminUser>>(response.data);
  }

  async getUserById(id: string): Promise<AdminUser> {
    const response = await axios.get<APIResponse<AdminUser>>(
      `/${PREFIX}/users/${id}`,
    );
    return unwrap<AdminUser>(response.data);
  }

  async blockUser(
    id: string,
    reason?: string,
    expireAt?: Date,
  ): Promise<AdminUser> {
    const response = await axios.put<APIResponse<AdminUser>>(
      `/${PREFIX}/users/${id}/block`,
      { reason, expireAt },
    );
    return unwrap<AdminUser>(response.data);
  }

  async unblockUser(id: string): Promise<AdminUser> {
    const response = await axios.put<APIResponse<AdminUser>>(
      `/${PREFIX}/users/${id}/unblock`,
    );
    return unwrap<AdminUser>(response.data);
  }

  async updateUserRole(id: string, role: string): Promise<AdminUser> {
    const response = await axios.put<APIResponse<AdminUser>>(
      `/${PREFIX}/users/${id}/role`,
      { role },
    );
    return unwrap<AdminUser>(response.data);
  }

  async createAccount(data: any): Promise<AdminUser> {
    const response = await axios.post<APIResponse<AdminUser>>(
      `/${PREFIX}/users`,
      data,
    );
    return unwrap<AdminUser>(response.data);
  }

  // ========== POST MANAGEMENT ==========

  async getPosts(
    params: PostQueryParams = {},
  ): Promise<PaginationResponse<AdminPost>> {
    const response = await axios.get<
      APIResponse<PaginationResponse<AdminPost>>
    >(`/${PREFIX}/posts`, { params });
    return unwrap<PaginationResponse<AdminPost>>(response.data);
  }

  async getPostById(id: string): Promise<AdminPostDetail> {
    const response = await axios.get<APIResponse<AdminPostDetail>>(
      `/${PREFIX}/posts/${id}`,
    );
    return unwrap<AdminPostDetail>(response.data);
  }

  async deletePost(id: string): Promise<void> {
    await axios.delete(`/${PREFIX}/posts/${id}`);
  }

  async hidePost(id: string): Promise<AdminPost> {
    const response = await axios.put<APIResponse<AdminPost>>(
      `/${PREFIX}/posts/${id}/hide`,
    );
    return unwrap<AdminPost>(response.data);
  }

  async showPost(id: string): Promise<AdminPost> {
    const response = await axios.put<APIResponse<AdminPost>>(
      `/${PREFIX}/posts/${id}/show`,
    );
    return unwrap<AdminPost>(response.data);
  }
}

export const adminService = new AdminService();
