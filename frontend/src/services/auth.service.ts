import axios from "@/config/axios";

export interface LoginRequest {
    username: string;
    password: string;
}

export interface LoginResponseData {
    access_token: string;
    refresh_token?: string;
    payload: {
        fullname: string;
        gender?: string;
        role?: string;
        username: string;
    };
}

export interface LoginResponse {
    data: LoginResponseData;
    message?: string;
    statusCode?: number;
}

class AuthService {
    async login(loginData: LoginRequest): Promise<LoginResponse> {
        const response = await axios.post<LoginResponse>("/auth/login", loginData);

        // Only store access token in localStorage
        // User data will be fetched from /api/auth/me via refresh_token cookie
        if (response.data?.data?.access_token) {
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
