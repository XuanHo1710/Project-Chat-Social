import axios from "@/config/axios";
import {
  AccountCardFriendType,
  AccountType,
  ProfileType,
  UpdateProfileType,
} from "@/types/account";
import { APIResponse, PageResponse } from "@/types/common";

const PREFIX = "account";

export interface UserSettings {
  showActivityStatus: boolean;
  isActive: boolean;
  isSelfBlocked: boolean;
  selfBlockExpireAt?: string;
}

class AccountService {
  async getAccountsByPage(
    params?: Record<string, string | number | boolean | Array<string>>
  ) {
    const response = await axios.get<
      APIResponse<PageResponse<AccountCardFriendType>>
    >(`/${PREFIX}`, { params });
    return response.data.data;
  }

  async getAccountById(id: string): Promise<AccountType> {
    const response = await axios.get<APIResponse<AccountType>>(
      `/${PREFIX}/${id}`
    );
    return response.data.data;
  }

  // Get profile by username
  async getProfileByUsername(username: string): Promise<ProfileType> {
    const response = await axios.get<APIResponse<ProfileType>>(
      `/${PREFIX}/profile/${username}`
    );
    return response.data.data;
  }

  // Update own profile (no need to pass id - backend uses authenticated user)
  async updateProfile(data: UpdateProfileType): Promise<ProfileType> {
    const response = await axios.put<APIResponse<ProfileType>>(
      `/${PREFIX}/profile`,
      data
    );
    return response.data.data;
  }

  // ==================== SETTINGS ====================

  // Get user settings
  async getSettings(): Promise<UserSettings> {
    const response = await axios.get<APIResponse<UserSettings>>(
      `/${PREFIX}/settings`
    );
    return response.data.data;
  }

  // Toggle activity status visibility
  async toggleActivityStatus(show: boolean): Promise<ProfileType> {
    const response = await axios.patch<APIResponse<ProfileType>>(
      `/${PREFIX}/settings/activity-status`,
      { show }
    );
    return response.data.data;
  }

  // Self-block account for 30 days
  async selfBlockAccount(): Promise<{
    message: string;
    selfBlockedAt: string;
    selfBlockExpireAt: string;
  }> {
    const response = await axios.post<
      APIResponse<{
        message: string;
        selfBlockedAt: string;
        selfBlockExpireAt: string;
      }>
    >(`/${PREFIX}/settings/self-block`);
    return response.data.data;
  }

  // Cancel self-block
  async unblockSelfAccount(): Promise<{ message: string }> {
    const response = await axios.delete<APIResponse<{ message: string }>>(
      `/${PREFIX}/settings/self-block`
    );
    return response.data.data;
  }
}

export const accountService = new AccountService();
