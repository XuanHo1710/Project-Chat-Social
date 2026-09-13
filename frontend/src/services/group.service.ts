import axios, { unwrap } from "@/config/axios";
import { APIResponse } from "@/types/common";
import {
  Group,
  GroupWithMembership,
  CreateGroupData,
  UpdateGroupData,
  GroupMembersResponse,
  PendingMembersResponse,
  GroupCreator,
  GroupRole,
} from "@/types/group";

class GroupService {
  // ==================== GROUP CRUD ====================

  async createGroup(data: CreateGroupData): Promise<Group> {
    const response = await axios.post<APIResponse<Group>>("/group", data);
    return unwrap<Group>(response.data);
  }

  async updateGroup(groupId: string, data: UpdateGroupData): Promise<Group> {
    const response = await axios.put<APIResponse<Group>>(
      `/group/${groupId}`,
      data,
    );
    return unwrap<Group>(response.data);
  }

  async deleteGroup(groupId: string): Promise<{ message: string }> {
    const response = await axios.delete<APIResponse<{ message: string }>>(
      `/group/${groupId}`,
    );
    return unwrap<{ message: string }>(response.data);
  }

  async getGroupById(groupId: string): Promise<Group> {
    const response = await axios.get<APIResponse<Group>>(`/group/${groupId}`);
    return unwrap<Group>(response.data);
  }

  async getMyGroups(): Promise<GroupWithMembership[]> {
    const response =
      await axios.get<APIResponse<GroupWithMembership[]>>("/group/my-groups");
    return unwrap<GroupWithMembership[]>(response.data);
  }

  async getSuggestedGroups(limit = 10): Promise<Group[]> {
    const response = await axios.get<APIResponse<Group[]>>(
      `/group/suggested?limit=${limit}`,
    );
    return unwrap<Group[]>(response.data);
  }

  async searchGroups(query: string, page = 1, limit = 20): Promise<Group[]> {
    const response = await axios.get<APIResponse<Group[]>>(
      `/group/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
    );
    return unwrap<Group[]>(response.data);
  }

  // ==================== MEMBERSHIP ====================

  async joinGroup(
    groupId: string,
  ): Promise<{ message: string; status: string }> {
    const response = await axios.post<
      APIResponse<{ message: string; status: string }>
    >(`/group/${groupId}/join`);
    return unwrap<{ message: string; status: string }>(response.data);
  }

  async leaveGroup(groupId: string): Promise<{ message: string }> {
    const response = await axios.post<APIResponse<{ message: string }>>(
      `/group/${groupId}/leave`,
    );
    return unwrap<{ message: string }>(response.data);
  }

  async cancelJoinRequest(groupId: string): Promise<{ message: string }> {
    const response = await axios.delete<APIResponse<{ message: string }>>(
      `/group/${groupId}/cancel-request`,
    );
    return unwrap<{ message: string }>(response.data);
  }

  async getMembers(
    groupId: string,
    page = 1,
    limit = 20,
  ): Promise<GroupMembersResponse> {
    const response = await axios.get<APIResponse<GroupMembersResponse>>(
      `/group/${groupId}/members?page=${page}&limit=${limit}`,
    );
    return unwrap<GroupMembersResponse>(response.data);
  }

  async getTopMembers(groupId: string, limit = 12): Promise<GroupCreator[]> {
    const response = await axios.get<APIResponse<GroupCreator[]>>(
      `/group/${groupId}/members/top?limit=${limit}`,
    );
    return unwrap<GroupCreator[]>(response.data);
  }

  async getPendingMembers(
    groupId: string,
    page = 1,
    limit = 20,
  ): Promise<PendingMembersResponse> {
    const response = await axios.get<APIResponse<PendingMembersResponse>>(
      `/group/${groupId}/members/pending?page=${page}&limit=${limit}`,
    );
    return unwrap<PendingMembersResponse>(response.data);
  }

  async approveMember(
    groupId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const response = await axios.post<APIResponse<{ message: string }>>(
      `/group/${groupId}/members/${userId}/approve`,
    );
    return unwrap<{ message: string }>(response.data);
  }

  async rejectMember(
    groupId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const response = await axios.post<APIResponse<{ message: string }>>(
      `/group/${groupId}/members/${userId}/reject`,
    );
    return unwrap<{ message: string }>(response.data);
  }

  async removeMember(
    groupId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const response = await axios.delete<APIResponse<{ message: string }>>(
      `/group/${groupId}/members/${userId}`,
    );
    return unwrap<{ message: string }>(response.data);
  }

  async updateMemberRole(
    groupId: string,
    userId: string,
    role: GroupRole,
  ): Promise<{ message: string }> {
    const response = await axios.put<APIResponse<{ message: string }>>(
      `/group/${groupId}/members/${userId}/role`,
      { role },
    );
    return unwrap<{ message: string }>(response.data);
  }

  async inviteMember(
    groupId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const response = await axios.post<APIResponse<{ message: string }>>(
      `/group/${groupId}/invite`,
      { userId },
    );
    return unwrap<{ message: string }>(response.data);
  }

  async transferOwnership(
    groupId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const response = await axios.post<APIResponse<{ message: string }>>(
      `/group/${groupId}/transfer-ownership`,
      { userId },
    );
    return unwrap<{ message: string }>(response.data);
  }
}

export const groupService = new GroupService();
