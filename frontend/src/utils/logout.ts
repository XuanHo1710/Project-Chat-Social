import { QueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/stores/useAuthStore";
import { usePostStore } from "@/stores/usePostStore";
import { useGroupPostStore } from "@/stores/useGroupPostStore";
import { useReactionStore } from "@/stores/useReactionStore";
import { useCommentReactionStore } from "@/stores/useCommentReactionStore";
import { useMessageCacheStore } from "@/stores/useMessageCacheStore";
import { useOnlineStatusStore } from "@/stores/useOnlineStatusStore";
import { authService } from "@/services/auth.service";
import { accountService } from "@/services/account.service";
import { getFirebaseToken } from "@/lib/firebase";

interface PerformLogoutOptions {
    queryClient: QueryClient;
    /** Navigation performed after local state is fully cleared. */
    navigate: () => void;
}

/**
 * Full logout sequence:
 * 1. Remove this device's FCM token (never blocks logout on failure).
 * 2. Call the BFF logout route (/api/auth/logout), which clears session cookies
 *    and revokes the backend session.
 * 3. Reset every client store (auth + domain caches).
 * 4. Clear the TanStack Query cache so no user data survives.
 * 5. Hand control to the caller for navigation.
 *
 * @returns whether the BFF/backend logout call reported success.
 */
export async function performLogout({
    queryClient,
    navigate,
}: PerformLogoutOptions): Promise<boolean> {
    // 1. FCM token cleanup - ignore errors, don't block logout
    try {
        const fcmToken = await getFirebaseToken();
        if (fcmToken) {
            await accountService.removeFMCToken(fcmToken);
        }
    } catch {
        // Ignore FCM cleanup errors
    }

    // 2. BFF logout route (clears cookies / backend session)
    let success = false;
    try {
        const response = await authService.logout();
        success = Boolean(response?.success);
    } catch {
        success = false;
    }

    // 3. Store resets - always clear local state even on API failure
    useAuthStore.getState().logout();
    usePostStore.getState().reset();
    useGroupPostStore.getState().reset();
    useReactionStore.getState().reset();
    useCommentReactionStore.getState().reset();
    useMessageCacheStore.getState().reset();
    useOnlineStatusStore.getState().reset();

    // 4. Drop all cached queries/mutations belonging to the previous user
    queryClient.clear();

    // 5. Navigate (caller decides how)
    navigate();

    return success;
}
