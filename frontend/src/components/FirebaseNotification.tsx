"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { getFirebaseToken, onMessageListener } from "@/lib/firebase";
import { accountService } from "@/services/account.service";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { renderNotification } from "@/utils/notificationText";

// Interface for notification data
export interface NotificationPayloadType {
    notification?: {
        title?: string;
        body?: string;
    };
    data?: {
        conversationId?: string;
        avatar?: string;
        messageId?: string;
        isUserOnline?: string;
        templateKey?: string;
        // The producer sends templated params as a JSON STRING in the FCM data payload,
        // but may also send an object — support both until parse below.
        templateParams?: Record<string, string | number> | string;
    };
}

// Request browser notification permission
const requestNotificationPermission = async (): Promise<boolean> => {
    if (!("Notification" in window)) {
        return false;
    }

    if (Notification.permission === "granted") {
        return true;
    }

    if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        return permission === "granted";
    }

    return false;
};

// Show browser notification when tab is not focused
const showBrowserNotification = (
    title: string,
    body: string,
    avatar: string,
    conversationId: string,
    onClick: () => void
) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const notification = new Notification(title, {
        body,
        icon: avatar || "/logo.png",
        badge: avatar || "/logo.png",
        tag: conversationId || "message",
        requireInteraction: false,
        silent: false,
    });

    notification.onclick = () => {
        window.focus();
        onClick();
        notification.close();
    };

    // Auto close after 5 seconds
    setTimeout(() => notification.close(), 5000);
};

// Parse templateParams which the producer may deliver as a JSON string
const parseTemplateParams = (
    raw: Record<string, string | number> | string | undefined
): Record<string, string | number> | undefined => {
    if (typeof raw === "string") {
        try {
            const parsed: unknown = JSON.parse(raw);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                return parsed as Record<string, string | number>;
            }
        } catch {
            return undefined;
        }
        return undefined;
    }
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        return raw;
    }
    return undefined;
};

export default function FirebaseNotification() {
    const { user } = useAuthStore();
    const router = useRouter();
    const { t } = useTranslation();

    // Use messageId for deduplication instead of conversationId
    const lastNotifiedMessageId = useRef<string>("");
    // Timeout to reset dedup after a short period
    const dedupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const userId = user?.id;
    // Tracks which user login the FCM token was last synced for
    const syncedUserIdRef = useRef<string | null>(null);

    // Init effect (mount/login-scoped): request permission + sync FCM token
    // exactly once per user login — NOT on route changes.
    useEffect(() => {
        if (!userId) {
            // Allow re-sync on next login after logout
            syncedUserIdRef.current = null;
            return;
        }
        if (syncedUserIdRef.current === userId) return;
        syncedUserIdRef.current = userId;

        // Request notification permission
        requestNotificationPermission();

        const syncToken = async () => {
            try {
                const token = await getFirebaseToken();
                if (token) {
                    await accountService.updateFMCToken(token);
                }
            } catch (error) {
                console.error("Failed to sync FCM token", error);
            }
        };

        syncToken();
    }, [userId]);

    // Foreground-message listener effect: deliberately has NO pathname/router-location
    // dependencies (location is read inside the callback), so navigating between
    // routes never tears down/re-subscribes or re-triggers the token sync above.
    useEffect(() => {
        if (!userId) return;

        // Listen for Foreground Messages
        // Only show browser notification when tab is NOT focused (e.g., user is on another tab)
        // When tab IS focused, socket handles real-time messages (tab title + favicon badge)
        const unsubscribe = onMessageListener((payload: NotificationPayloadType) => {
            const rawTitle = payload?.notification?.title || "";
            const rawBody = payload?.notification?.body || "";
            let title = rawTitle || t("chat.new_message");
            let body = rawBody;
            if (payload?.data?.templateKey) {
                const rendered = renderNotification(
                    {
                        templateKey: payload.data.templateKey,
                        templateParams: parseTemplateParams(payload.data.templateParams),
                        title: rawTitle,
                        message: rawBody,
                    },
                    t
                );
                title = rendered.title || title;
                body = rendered.message || body;
            }
            const conversationId = payload?.data?.conversationId || "";
            const avatar = payload?.data?.avatar || "";
            const messageId = payload?.data?.messageId || "";

            // Deduplication check using messageId
            if (messageId && lastNotifiedMessageId.current === messageId) {
                return;
            }

            // Don't show notification if user is currently viewing this conversation
            const currentPath = window.location.pathname;
            const isInSameChat = conversationId && currentPath === `/chat/${conversationId}`;
            if (isInSameChat) {
                return;
            }

            // Update dedup ref
            lastNotifiedMessageId.current = messageId;

            // Reset dedup after 3 seconds to allow same conversation notifications later
            if (dedupTimeoutRef.current) {
                clearTimeout(dedupTimeoutRef.current);
            }
            dedupTimeoutRef.current = setTimeout(() => {
                lastNotifiedMessageId.current = "";
            }, 3000);

            // Only show notification when tab is NOT focused
            // When focused, the socket-based tab title/favicon badge handles it
            if (!document.hasFocus()) {
                showBrowserNotification(
                    title,
                    body,
                    avatar,
                    conversationId,
                    () => {
                        router.push(`/chat/${conversationId}`);
                    }
                );
            }
        });

        return () => {
            lastNotifiedMessageId.current = "";
            if (dedupTimeoutRef.current) {
                clearTimeout(dedupTimeoutRef.current);
            }
            if (typeof unsubscribe === "function") {
                unsubscribe();
            }
        };
    }, [userId, router, t]);

    return null;
}
