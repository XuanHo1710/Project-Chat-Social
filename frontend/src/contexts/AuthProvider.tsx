"use client";
import { useAuthStore } from "@/stores/useAuthStore";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { ensureAccessToken } from "@/config/axios";
import { CLIENT_PATH } from "@/constants/paths";

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { logout, setLoading } = useAuthStore();
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
                // Single-flight bootstrap shared with the axios instance
                const accessToken = await ensureAccessToken();

                if (!accessToken) {
                    logout();
                    return;
                }

                const account = useAuthStore.getState().user;

                // If on login page but already authenticated, redirect to home
                if (pathname === CLIENT_PATH.LOGIN && account) {
                    router.replace(CLIENT_PATH.HOME);
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
