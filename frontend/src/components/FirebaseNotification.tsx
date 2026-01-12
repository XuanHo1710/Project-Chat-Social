"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { getFirebaseToken, onMessageListener } from "@/lib/firebase";
import { accountService } from "@/services/account.service";
import { useRouter, usePathname } from "next/navigation";
import {
    Snackbar,
    Box,
    Avatar,
    Typography,
    IconButton,
    Paper,
    Slide,
    keyframes,
    useTheme,
} from "@mui/material";
import {
    Close as CloseIcon,
    Chat as ChatIcon,
} from "@mui/icons-material";
import type { SlideProps } from "@mui/material/Slide";

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
    };
}

// Interface for notification state
interface NotificationState {
    open: boolean;
    title: string;
    body: string;
    avatar: string;
    conversationId: string;
}

// Keyframe animations
const slideInRight = keyframes`
    0% {
        transform: translateX(100%);
        opacity: 0;
    }
    100% {
        transform: translateX(0);
        opacity: 1;
    }
`;

const slideOutRight = keyframes`
    0% {
        transform: translateX(0);
        opacity: 1;
    }
    100% {
        transform: translateX(100%);
        opacity: 0;
    }
`;

const pulse = keyframes`
    0% {
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15), 0 0 0 0 rgba(24, 119, 242, 0.4);
    }
    70% {
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15), 0 0 0 10px rgba(24, 119, 242, 0);
    }
    100% {
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15), 0 0 0 0 rgba(24, 119, 242, 0);
    }
`;

// Slide transition from right
function SlideTransition(props: SlideProps) {
    return <Slide {...props} direction="left" />;
}

// Request browser notification permission
const requestNotificationPermission = async (): Promise<boolean> => {
    if (!("Notification" in window)) {
        console.log("Browser does not support notifications");
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

export default function FirebaseNotification() {
    const { user } = useAuthStore();
    const router = useRouter();
    const pathname = usePathname();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#f0f0f0';
    const headerBg = isDark ? 'rgba(255,255,255,0.05)' : '#fafafa';
    const hoverBg = isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb';
    const [notification, setNotification] = useState<NotificationState>({
        open: false,
        title: "",
        body: "",
        avatar: "",
        conversationId: "",
    });
    const [isClosing, setIsClosing] = useState(false);

    // Handle close notification with animation
    const handleClose = useCallback((_event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === "clickaway") {
            return;
        }
        setIsClosing(true);
        setTimeout(() => {
            setNotification((prev) => ({ ...prev, open: false }));
            setIsClosing(false);
        }, 300);
    }, []);

    // Handle click on notification
    const handleNotificationClick = useCallback(() => {
        if (notification.conversationId) {
            router.push(`/chat/${notification.conversationId}`);
        }
        handleClose();
    }, [notification.conversationId, router, handleClose]);

    const initialized = useRef(false);
    // Use messageId for deduplication instead of conversationId
    const lastNotifiedMessageId = useRef<string>("");
    // Timeout to reset dedup after a short period
    const dedupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!user || initialized.current) return;
        initialized.current = true;

        // Request notification permission
        requestNotificationPermission();

        // 1. Get Token & Save to Backend
        const syncToken = async () => {
            try {
                const token = await getFirebaseToken();
                if (token) {
                    await accountService.updateFMCToken(token);
                    console.log("FCM Token synced with backend");
                }
            } catch (error) {
                console.error("Failed to sync FCM token", error);
            }
        };

        syncToken();

        // 2. Listen for Foreground Messages - Chỉ hiển thị khi tab đang focus
        const unsubscribe = onMessageListener((payload: NotificationPayloadType) => {
            console.log("Foreground Message received:", payload);
            const title = payload?.notification?.title || "Tin nhắn mới";
            const body = payload?.notification?.body || "";
            const conversationId = payload?.data?.conversationId || "";
            const avatar = payload?.data?.avatar || "";
            const messageId = payload?.data?.messageId || "";

            // Deduplication check using messageId
            if (messageId && lastNotifiedMessageId.current === messageId) {
                console.log("Duplicate notification blocked:", messageId);
                return;
            }

            // Don't show notification if user is currently viewing this conversation
            const currentPath = window.location.pathname;
            const isInSameChat = conversationId && currentPath === `/chat/${conversationId}`;
            if (isInSameChat) {
                console.log("User is in same chat, skipping notification");
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

            // Foreground message - chỉ hiện in-app notification vì tab đang focus
            // Service Worker sẽ KHÔNG hiển thị notification khi foreground
            // Nên ta chỉ cần hiển thị in-app notification
            setNotification({
                open: true,
                title,
                body,
                avatar,
                conversationId,
            });
        });

        return () => {
            initialized.current = false;
            lastNotifiedMessageId.current = "";
            if (dedupTimeoutRef.current) {
                clearTimeout(dedupTimeoutRef.current);
            }
            if (typeof unsubscribe === "function") {
                unsubscribe();
            }
        };
    }, [user, router, pathname]);

    return (
        <Snackbar
            open={notification.open}
            autoHideDuration={5000}
            onClose={handleClose}
            anchorOrigin={{ vertical: "top", horizontal: "right" }}
            TransitionComponent={SlideTransition}
            sx={{
                mt: 8,
                mr: 2,
            }}
        >
            <Paper
                elevation={8}
                onClick={handleNotificationClick}
                sx={{
                    width: 360,
                    bgcolor: "background.paper",
                    borderRadius: "8px",
                    cursor: notification.conversationId ? "pointer" : "default",
                    overflow: "hidden",
                    animation: isClosing
                        ? `${slideOutRight} 0.3s ease-out forwards`
                        : `${slideInRight} 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), ${pulse} 2s ease-in-out`,
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    "&:hover": notification.conversationId ? {
                        transform: "translateY(-2px) scale(1.01)",
                        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2), 0 0 1px rgba(0, 0, 0, 0.2)",
                    } : {},
                }}
            >
                {/* Header with close button */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        px: 1.5,
                        py: 1,
                        borderBottom: `1px solid ${borderColor}`,
                        bgcolor: headerBg,
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Box
                            sx={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                bgcolor: "#22c55e",
                                animation: "pulse 2s infinite",
                                "@keyframes pulse": {
                                    "0%, 100%": { opacity: 1 },
                                    "50%": { opacity: 0.5 },
                                },
                            }}
                        />
                        <Typography
                            sx={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "text.secondary",
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                            }}
                        >
                            Tin nhắn mới
                        </Typography>
                    </Box>
                    <IconButton
                        size="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleClose();
                        }}
                        sx={{
                            width: 26,
                            height: 26,
                            color: "text.secondary",
                            transition: "all 0.2s ease",
                            "&:hover": {
                                bgcolor: hoverBg,
                                color: "text.primary",
                                transform: "rotate(90deg)",
                            },
                        }}
                    >
                        <CloseIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                </Box>

                {/* Content */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        p: 2,
                    }}
                >
                    {/* Avatar */}
                    <Box sx={{ position: "relative" }}>
                        {notification.avatar ? (
                            <Avatar
                                src={notification.avatar}
                                alt={notification.title}
                                sx={{
                                    width: 52,
                                    height: 52,
                                    flexShrink: 0,
                                    border: `2px solid ${borderColor}`,
                                }}
                            />
                        ) : (
                            <Avatar
                                sx={{
                                    width: 52,
                                    height: 52,
                                    bgcolor: "#1877f2",
                                    color: "#ffffff",
                                    fontWeight: 700,
                                    fontSize: 20,
                                    flexShrink: 0,
                                }}
                            >
                                {notification.title.charAt(0).toUpperCase()}
                            </Avatar>
                        )}
                        {/* Online indicator */}
                        <Box
                            sx={{
                                position: "absolute",
                                bottom: 2,
                                right: 2,
                                width: 12,
                                height: 12,
                                borderRadius: "50%",
                                bgcolor: "#22c55e",
                                border: `2px solid ${theme.palette.background.paper}`,
                            }}
                        />
                    </Box>

                    {/* Text Content */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                            sx={{
                                fontSize: 15,
                                fontWeight: 600,
                                color: "text.primary",
                                lineHeight: 1.3,
                                mb: 0.3,
                            }}
                        >
                            {notification.title}
                        </Typography>
                        <Typography
                            sx={{
                                fontSize: 14,
                                color: "text.secondary",
                                lineHeight: 1.4,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                            }}
                        >
                            {notification.body}
                        </Typography>
                    </Box>
                </Box>

                {/* Footer Action */}
                {notification.conversationId && (
                    <Box
                        sx={{
                            px: 2,
                            pb: 1.5,
                            pt: 0,
                        }}
                    >
                        <Box
                            onClick={(e) => {
                                e.stopPropagation();
                                handleNotificationClick();
                            }}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 1,
                                py: 1.2,
                                px: 2,
                                bgcolor: "#1877f2",
                                borderRadius: "8px",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                "&:hover": {
                                    bgcolor: "#166fe5",
                                    transform: "scale(1.02)",
                                },
                                "&:active": {
                                    transform: "scale(0.98)",
                                },
                            }}
                        >
                            <ChatIcon sx={{ fontSize: 18, color: "#ffffff" }} />
                            <Typography
                                sx={{
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: "#ffffff",
                                }}
                            >
                                Trả lời tin nhắn
                            </Typography>
                        </Box>
                    </Box>
                )}
            </Paper>
        </Snackbar>
    );
}
