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
}

export const relationshipService = new RelationshipService();
