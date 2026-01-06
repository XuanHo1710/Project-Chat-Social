import axios from "@/config/axios";
import { FriendType } from "@/types/account";
import { APIResponse } from "@/types/common";
import { RelationshipEnum } from "@/types/relationship";

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
}

export const relationshipService = new RelationshipService();
