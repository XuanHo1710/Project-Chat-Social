import axios from "@/config/axios";
import { APIResponse } from "@/types/common";
import {
  Group,
  GroupWithMembership,
  CreateGroupData,
  UpdateGroupData,
  GroupMembersResponse,
  PendingMembersResponse,
  GroupCreator,
} from "@/types/group";

class GroupService {
  // ==================== GROUP CRUD ====================

  async createGroup(data: CreateGroupData): Promise<Group> {
    const response = await axios.post<APIResponse<Group>>("/group", data);
    return response.data.data;
  }

  async updateGroup(groupId: string, data: UpdateGroupData): Promise<Group> {
    const response = await axios.put<APIResponse<Group>>(
      `/group/${groupId}`,
      data
    );
    return response.data.data;
  }

  async deleteGroup(groupId: string): Promise<{ message: string }> {
    const response = await axios.delete<APIResponse<{ message: string }>>(
      `/group/${groupId}`
    );
    return response.data.data;
  }

  async getGroupById(groupId: string): Promise<Group> {
    const response = await axios.get<APIResponse<Group>>(`/group/${groupId}`);
    return response.data.data;
  }

  async getMyGroups(): Promise<GroupWithMembership[]> {
    const response = await axios.get<APIResponse<GroupWithMembership[]>>(
      "/group/my-groups"
    );
    return response.data.data;
  }

  async getSuggestedGroups(limit = 10): Promise<Group[]> {
    const response = await axios.get<APIResponse<Group[]>>(
      `/group/suggested?limit=${limit}`
    );
    return response.data.data;
  }

  async searchGroups(query: string, page = 1, limit = 20): Promise<Group[]> {
    const response = await axios.get<APIResponse<Group[]>>(
      `/group/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
    );
    return response.data.data;
  }

  // ==================== MEMBERSHIP ====================

  async joinGroup(
    groupId: string
  ): Promise<{ message: string; status: string }> {
    const response = await axios.post<
      APIResponse<{ message: string; status: string }>
    >(`/group/${groupId}/join`);
    return response.data.data;
  }

  async leaveGroup(groupId: string): Promise<{ message: string }> {
    const response = await axios.post<APIResponse<{ message: string }>>(
      `/group/${groupId}/leave`
    );
    return response.data.data;
  }

  async cancelJoinRequest(groupId: string): Promise<{ message: string }> {
    const response = await axios.delete<APIResponse<{ message: string }>>(
      `/group/${groupId}/cancel-request`
    );
    return response.data.data;
  }

  async getMembers(
    groupId: string,
    page = 1,
    limit = 20
  ): Promise<GroupMembersResponse> {
    const response = await axios.get<APIResponse<GroupMembersResponse>>(
      `/group/${groupId}/members?page=${page}&limit=${limit}`
    );
    return response.data.data;
  }

  async getTopMembers(groupId: string, limit = 12): Promise<GroupCreator[]> {
    const response = await axios.get<APIResponse<GroupCreator[]>>(
      `/group/${groupId}/members/top?limit=${limit}`
    );
    return response.data.data;
  }

  async getPendingMembers(
    groupId: string,
    page = 1,
    limit = 20
  ): Promise<PendingMembersResponse> {
    const response = await axios.get<APIResponse<PendingMembersResponse>>(
      `/group/${groupId}/members/pending?page=${page}&limit=${limit}`
    );
    return response.data.data;
  }

  async approveMember(
    groupId: string,
    userId: string
  ): Promise<{ message: string }> {
    const response = await axios.post<APIResponse<{ message: string }>>(
      `/group/${groupId}/members/${userId}/approve`
    );
    return response.data.data;
  }

  async rejectMember(
    groupId: string,
    userId: string
  ): Promise<{ message: string }> {
    const response = await axios.post<APIResponse<{ message: string }>>(
      `/group/${groupId}/members/${userId}/reject`
    );
    return response.data.data;
  }

  async removeMember(
    groupId: string,
    userId: string
  ): Promise<{ message: string }> {
    const response = await axios.delete<APIResponse<{ message: string }>>(
      `/group/${groupId}/members/${userId}`
    );
    return response.data.data;
  }

  async updateMemberRole(
    groupId: string,
    userId: string,
    role: "ADMIN" | "MODERATOR" | "MEMBER"
  ): Promise<{ message: string }> {
    const response = await axios.put<APIResponse<{ message: string }>>(
      `/group/${groupId}/members/${userId}/role`,
      { role }
    );
    return response.data.data;
  }

  async inviteMember(
    groupId: string,
    userId: string
  ): Promise<{ message: string }> {
    const response = await axios.post<APIResponse<{ message: string }>>(
      `/group/${groupId}/invite`,
      { userId }
    );
    return response.data.data;
  }
}

export const groupService = new GroupService();
