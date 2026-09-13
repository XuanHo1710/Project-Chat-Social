import axios, { unwrap } from "@/config/axios";
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
    params?: Record<string, string | number | boolean | Array<string>>,
  ) {
    const response = await axios.get<
      APIResponse<PageResponse<AccountCardFriendType>>
    >(`/${PREFIX}`, { params });
    return unwrap<PageResponse<AccountCardFriendType>>(response.data);
  }

  async updateFMCToken(token: string): Promise<{ message: string }> {
    const response = await axios.post<APIResponse<{ message: string }>>(
      `/${PREFIX}/fcm-token`,
      { token },
    );
    return unwrap<{ message: string }>(response.data);
  }

  async removeFMCToken(token: string): Promise<{ message: string }> {
    const response = await axios.delete<APIResponse<{ message: string }>>(
      `/${PREFIX}/fcm-token`,
      { data: { token } },
    );
    return unwrap<{ message: string }>(response.data);
  }

  async getAccountById(id: string): Promise<AccountType> {
    const response = await axios.get<APIResponse<AccountType>>(
      `/${PREFIX}/${id}`,
    );
    return unwrap<AccountType>(response.data);
  }

  // Get profile by username
  async getProfileByUsername(username: string): Promise<ProfileType> {
    const response = await axios.get<APIResponse<ProfileType>>(
      `/${PREFIX}/profile/${username}`,
    );
    return unwrap<ProfileType>(response.data);
  }

  // Update own profile (no need to pass id - backend uses authenticated user)
  async updateProfile(data: UpdateProfileType): Promise<ProfileType> {
    const response = await axios.put<APIResponse<ProfileType>>(
      `/${PREFIX}/profile`,
      data,
    );
    return unwrap<ProfileType>(response.data);
  }

  // ==================== SETTINGS ====================

  // Get user settings
  async getSettings(): Promise<UserSettings> {
    const response = await axios.get<APIResponse<UserSettings>>(
      `/${PREFIX}/settings`,
    );
    return unwrap<UserSettings>(response.data);
  }

  // Toggle activity status visibility
  async toggleActivityStatus(show: boolean): Promise<ProfileType> {
    const response = await axios.patch<APIResponse<ProfileType>>(
      `/${PREFIX}/settings/activity-status`,
      { show },
    );
    return unwrap<ProfileType>(response.data);
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
    return unwrap<{
      message: string;
      selfBlockedAt: string;
      selfBlockExpireAt: string;
    }>(response.data);
  }

  // Cancel self-block
  async unblockSelfAccount(): Promise<{ message: string }> {
    const response = await axios.delete<APIResponse<{ message: string }>>(
      `/${PREFIX}/settings/self-block`,
    );
    return unwrap<{ message: string }>(response.data);
  }
}

export const accountService = new AccountService();
