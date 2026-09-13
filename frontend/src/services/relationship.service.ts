import axios, { unwrap } from "@/config/axios";
import { FriendType } from "@/types/account";
import { APIResponse } from "@/types/common";
import { RelationshipEnum } from "@/types/relationship";

export interface BlockedUser {
  _id: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  username: string;
  blockedAt: string;
}

export interface RestrictedUser {
  _id: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  username: string;
  restrictedAt: string;
}

class RelationshipService {
  async addFriend(userId: string, friendId: string): Promise<void> {
    await axios.post<void>("/relationship/add-friend", {
      userId,
      friendId,
    });
  }

  async getReceivedFriendRequests(): Promise<APIResponse<FriendType[]>> {
    const response = await axios.get<APIResponse<FriendType[]>>(
      "/relationship/received-requests"
    );
    return response.data;
  }

  async getSentFriendRequests(): Promise<APIResponse<FriendType[]>> {
    const response = await axios.get<APIResponse<FriendType[]>>(
      "/relationship/sent-requests"
    );
    return response.data;
  }

  // Get all friends of logged in user
  async getFriends(): Promise<APIResponse<FriendType[]>> {
    const response = await axios.get<APIResponse<FriendType[]>>(
      "/relationship/friends"
    );
    return response.data;
  }

  // Get friends of a specific user by userId
  async getFriendsByUserId(userId: string): Promise<APIResponse<FriendType[]>> {
    const response = await axios.get<APIResponse<FriendType[]>>(
      `/relationship/friends/${userId}`
    );
    return response.data;
  }

  // Check friendship status between logged in user and target user
  async checkFriendship(
    targetUserId: string
  ): Promise<APIResponse<{ isFriend: boolean; status: string | null }>> {
    const response = await axios.get<
      APIResponse<{ isFriend: boolean; status: string | null }>
    >(`/relationship/check-friendship/${targetUserId}`);
    return response.data;
  }

  async updateStatusRelationship(
    userId: string,
    friendId: string,
    status: RelationshipEnum
  ): Promise<void> {
    await axios.patch<void>("/relationship/update-status", {
      userId,
      friendId,
      status,
    });
  }

  async acceptFriendRequest(userId: string, friendId: string): Promise<void> {
    await axios.patch<void>("/relationship/accept-friend", {
      userId,
      friendId,
    });
  }

  // ==================== BLOCKING ====================

  // Block a user
  async blockUser(targetUserId: string): Promise<{ message: string }> {
    const response = await axios.post<APIResponse<{ message: string }>>(
      `/relationship/block/${targetUserId}`
    );
    return unwrap<{ message: string }>(response.data);
  }

  // Unblock a user
  async unblockUser(targetUserId: string): Promise<{ message: string }> {
    const response = await axios.delete<APIResponse<{ message: string }>>(
      `/relationship/block/${targetUserId}`
    );
    return unwrap<{ message: string }>(response.data);
  }

  // Get blocked users list
  async getBlockedUsers(): Promise<BlockedUser[]> {
    const response = await axios.get<APIResponse<BlockedUser[]>>(
      "/relationship/blocked"
    );
    return unwrap<BlockedUser[]>(response.data);
  }

  // Check if a user is blocked
  async isUserBlocked(targetUserId: string): Promise<boolean> {
    const response = await axios.get<APIResponse<boolean>>(
      `/relationship/is-blocked/${targetUserId}`
    );
    return unwrap<boolean>(response.data);
  }

  // ==================== RESTRICT ====================

  // Restrict a user
  async restrictUser(targetUserId: string): Promise<{ message: string }> {
    const response = await axios.post<APIResponse<{ message: string }>>(
      `/relationship/restrict/${targetUserId}`
    );
    return unwrap<{ message: string }>(response.data);
  }

  // Unrestrict a user
  async unrestrictUser(targetUserId: string): Promise<{ message: string }> {
    const response = await axios.delete<APIResponse<{ message: string }>>(
      `/relationship/unrestrict/${targetUserId}`
    );
    return unwrap<{ message: string }>(response.data);
  }

  // Get restricted users list
  async getRestrictedUsers(): Promise<RestrictedUser[]> {
    const response = await axios.get<APIResponse<RestrictedUser[]>>(
      "/relationship/restricted"
    );
    return unwrap<RestrictedUser[]>(response.data);
  }
}

export const relationshipService = new RelationshipService();
