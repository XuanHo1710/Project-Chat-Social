import axios from "@/config/axios";
import {
  AccountCardFriendType,
  ProfileType,
  UpdateProfileType,
} from "@/types/account";
import { APIResponse, PageResponse } from "@/types/common";

const PREFIX = "account";

class AccountService {
  async getAccountsByPage(
    params?: Record<string, string | number | boolean | Array<string>>
  ) {
    const response = await axios.get<
      APIResponse<PageResponse<AccountCardFriendType>>
    >(`/${PREFIX}`, { params });
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
}

export const accountService = new AccountService();
