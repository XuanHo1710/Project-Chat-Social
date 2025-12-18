"use client";
import { useAuthStore } from "@/stores/useAuthStore";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import axios from "axios";
import { CLIENT_PATH } from "@/constants/paths";

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, setUser, logout, setLoading, setAccessToken, accessToken } = useAuthStore();

    useEffect(() => {
        const fetchAccount = async () => {
            if (typeof window === "undefined") return;
            // Nếu đã có user trong store và có access token thì không fetch lại
            if (user !== null && accessToken !== null) {
                setLoading(false);
                return;
            }

            setLoading(true);

            try {
                // Gọi API route để verify token với cookie
                const res = await axios.post("/api/auth/token");

                if (res.status === 200 && res.data !== null) {
                    console.log("Token valid, account data:", res.data);
                    const { accessToken, data } = res.data;
                    const { account } = data;

                    // Cập nhật access token mới (nếu có refresh)
                    if (accessToken) {
                        setAccessToken(accessToken);
                    }

                    // Set user vào Zustand store
                    setUser({
                        id: account._id || account.username,
                        username: account.username,
                        fullName: account.fullname || `${account.firstName || ''} ${account.lastName || ''}`.trim(),
                        email: account.email,
                        avatar: account.avatar,
                        role: account.role,
                        gender: account.gender,
                    });

                    // Redirect logic
                    if (pathname === CLIENT_PATH.LOGIN && account) {
                        router.replace(CLIENT_PATH.HOME);
                    }
                } else {
                    logout();

                    if (pathname.startsWith("/") && !pathname.startsWith("/auth")) {
                        router.replace(CLIENT_PATH.LOGIN);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch account:", error);
                // Clear auth nếu có lỗi
                logout();

                if (pathname.startsWith("/") && !pathname.startsWith("/auth")) {
                    router.replace(CLIENT_PATH.LOGIN);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchAccount();
    }, [router, pathname, user, setUser, logout, setLoading, setAccessToken, accessToken]);

    return <>{children}</>;
}
