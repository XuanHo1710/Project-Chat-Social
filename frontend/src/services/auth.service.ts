import axios from "@/config/axios";
import { LoginRequest, LoginResponseData } from "@/types/auth";
import { APIResponse } from "@/types/common";

class AuthService {
  async login(
    loginData: LoginRequest
  ): Promise<APIResponse<LoginResponseData>> {
    const response = await axios.post<APIResponse<LoginResponseData>>(
      "/auth/login",
      loginData
    );
    return response.data;
  }

  async signup(signupData: {
    username: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<APIResponse<LoginResponseData>> {
    const response = await axios.post<APIResponse<LoginResponseData>>(
      "/auth/signup",
      signupData
    );
    return response.data;
  }

  async logout() {
    try {
      const response = await axios.post("/auth/logout", {});
      return response.data;
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  async getProfile() {
    const response = await axios.get("/auth/profile");
    return response.data;
  }
}

export const authService = new AuthService();
