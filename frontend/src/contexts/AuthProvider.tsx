"use client";
import { useAuthStore } from "@/stores/useAuthStore";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import axios from "axios";

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, setUser, logout, setLoading } = useAuthStore();

    useEffect(() => {
        const fetchAccount = async () => {
            if (typeof window === "undefined") return;

            const accessTokenFromLocalStorage = localStorage.getItem("accessToken") || "";

            // Nếu đã có user trong store và có access token thì không fetch lại
            if (user !== null && accessTokenFromLocalStorage !== "") {
                setLoading(false);
                return;
            }

            setLoading(true);

            try {
                // Gọi API route để verify token với cookie
                const res = await axios.post("/api/auth/token", {
                    accessToken: accessTokenFromLocalStorage
                });

                if (res.status === 200 && res.data !== null) {
                    console.log("Fetched account info:", res.data);

                    const { accessToken, data } = res.data;
                    const { account } = data;

                    // Cập nhật access token mới (nếu có refresh)
                    if (accessToken) {
                        localStorage.setItem("accessToken", accessToken);
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
                    if (pathname === "/auth/login" && account) {
                        router.replace("/chat");
                    }
                } else {
                    // Token không hợp lệ
                    localStorage.removeItem("accessToken");
                    logout();

                    if (pathname.startsWith("/chat")) {
                        router.replace("/auth/login");
                    }
                }
            } catch (error) {
                console.error("Failed to fetch account:", error);
                // Clear auth nếu có lỗi
                logout();
                localStorage.removeItem("accessToken");

                if (pathname.startsWith("/chat")) {
                    router.replace("/auth/login");
                }
            } finally {
                setLoading(false);
            }
        };

        fetchAccount();
    }, [router, pathname, user, setUser, logout, setLoading]);

    return <>{children}</>;
}
