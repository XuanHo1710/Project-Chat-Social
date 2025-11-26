import axios from "@/config/axios";
import { LoginRequest, LoginResponseData } from "@/types/auth";
import { APIResponse } from "@/types/common";

class AuthService {
    async login(loginData: LoginRequest): Promise<APIResponse<LoginResponseData>> {
        const response = await axios.post<APIResponse<LoginResponseData>>("/auth/login", loginData);

        // Only store access token in localStorage
        // User data will be fetched from /api/auth/me via refresh_token cookie
        if (response.data?.data.access_token) {
            localStorage.setItem("accessToken", response.data.data.access_token);
        }

        return response.data;
    }

    async logout() {
        // Clear access token
        localStorage.removeItem("accessToken");

        // Call backend logout to clear cookies
        try {
            await axios.post("/auth/logout");
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
