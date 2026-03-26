"use client";
import { useAuthStore } from "@/stores/useAuthStore";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import axios from "axios";
import { CLIENT_PATH } from "@/constants/paths";

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { setUser, logout, setLoading, setAccessToken } = useAuthStore();
    const hasCheckedRef = useRef(false);

    useEffect(() => {
        if (hasCheckedRef.current) return;

        const fetchAccount = async () => {
            if (typeof window === "undefined") return;

            // If already have user in store, skip
            const state = useAuthStore.getState();
            if (state.user !== null && state.accessToken !== null) {
                setLoading(false);
                return;
            }

            setLoading(true);
            hasCheckedRef.current = true;

            try {
                // Call API route to verify token with cookie
                const res = await axios.post("/api/auth/token");

                if (res.status === 200 && res.data !== null) {
                    const { accessToken, data } = res.data;
                    const { account } = data;
                    if (accessToken) {
                        setAccessToken(accessToken);
                    }

                    setUser({
                        id: account._id || account.username,
                        username: account.username,
                        fullName: account.fullname || `${account.firstName || ''} ${account.lastName || ''}`.trim(),
                        email: account.email,
                        avatar: account.avatar,
                        role: account.role,
                        gender: account.gender,
                    });

                    // If on login page but already authenticated, redirect to home
                    if (pathname === CLIENT_PATH.LOGIN && account) {
                        router.replace(CLIENT_PATH.HOME);
                    }
                } else {
                    // Token invalid — clear state, let page components handle redirect
                    logout();
                }
            } catch (error) {
                console.error("Failed to fetch account:", error);
                // Clear auth state but don't force redirect — let page components decide
                logout();
            } finally {
                setLoading(false);
            }
        };

        fetchAccount();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <>{children}</>;
}
