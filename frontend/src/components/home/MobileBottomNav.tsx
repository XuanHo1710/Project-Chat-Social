'use client';

import { Box, Badge, useTheme } from '@mui/material';
import {
    Home as HomeIcon,
    HomeOutlined as HomeOutlinedIcon,
    People as PeopleIcon,
    PeopleOutline as PeopleOutlinedIcon,
    OndemandVideo as OndemandVideoIcon,
    OndemandVideoOutlined as OndemandVideoOutlinedIcon,
    ChatBubble as ChatIcon,
    ChatBubbleOutline as ChatOutlinedIcon,
    Notifications as NotificationsIcon,
    NotificationsOutlined as NotificationsOutlinedIcon,
} from '@mui/icons-material';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { conversationService } from '@/services/conversation.service';
import { notificationService } from '@/services/notification.service';
import { useSocket } from '@/contexts/SocketContext';
import { useAuthStore } from '@/stores/useAuthStore';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/query-keys';
import type { ConversationResponseData } from '@/types/conversation';
import type { MessageResponse } from '@/types/chat';

const NAV_ITEMS = [
    { path: '/', icon: HomeOutlinedIcon, activeIcon: HomeIcon, label: 'Home' },
    { path: '/friends', icon: PeopleOutlinedIcon, activeIcon: PeopleIcon, label: 'Friends' },
    { path: '/reels', icon: OndemandVideoOutlinedIcon, activeIcon: OndemandVideoIcon, label: 'Watch' },
    { path: '/chat', icon: ChatOutlinedIcon, activeIcon: ChatIcon, label: 'Chat', badgeKey: 'chat' as const },
    { path: '/notifications', icon: NotificationsOutlinedIcon, activeIcon: NotificationsIcon, label: 'Notifications', badgeKey: 'notification' as const },
];

type ConversationsCache = { data: ConversationResponseData[] };

// --- Unread projection helpers (mirror Header.tsx) ---

/**
 * Total unread across conversations: skips conversations muted/restricted by
 * the current user, and optionally skips one conversation entirely (the
 * currently open chat route).
 */
function computeTotalUnread(
    conversations: ConversationResponseData[],
    userId: string,
    excludeConversationId?: string
): number {
    return conversations.reduce((acc, conv) => {
        if (excludeConversationId && conv._id === excludeConversationId) return acc;
        if (conv.mutedBy?.includes(userId) || conv.isRestricted) return acc;
        return acc + (conv.unreadCount?.[userId] || 0);
    }, 0);
}

export default function MobileBottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const { socketChat, socketNotification } = useSocket();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const userId = user?.id;

    // The chat route currently open - its unread is never counted in the badge
    const activeConversationId = pathname?.match(/^\/chat\/([^/]+)$/)?.[1];

    // Fallback count until the shared conversations cache has data
    const [chatUnreadFallback, setChatUnreadFallback] = useState(0);
    const [notifUnread, setNotifUnread] = useState(0);

    useEffect(() => {
        conversationService.unreadCountAllConversationByUserId()
            .then(res => { if (res?.unreadCount) setChatUnreadFallback(res.unreadCount); })
            .catch(() => { });
        notificationService.getUnreadCount()
            .then(res => { if (res?.unreadCount) setNotifUnread(res.unreadCount); })
            .catch(() => { });
    }, []);

    // Read-only observer over the same conversations cache Header projects
    // into; re-renders this component whenever that cache changes.
    const { data: conversationsCache } = useQuery<ConversationsCache>({
        queryKey: [QUERY_KEYS.CONVERSATION_BY_USER, userId],
        queryFn: skipToken,
    });

    // Badge derived from projected cache state (falls back to the seeded
    // endpoint value while the cache is empty)
    const chatUnread = useMemo(() => {
        const conversations = conversationsCache?.data;
        if (!userId || !conversations) return chatUnreadFallback;
        return computeTotalUnread(conversations, userId, activeConversationId);
    }, [conversationsCache, userId, activeConversationId, chatUnreadFallback]);

    useEffect(() => {
        if (!socketChat || !socketNotification || !userId) return;

        // New message - mirror Header's cache projection, then apply badge rules:
        // ignore own messages, muted/restricted conversations and the open chat.
        const onMsg = (msg: MessageResponse) => {
            const senderId = typeof msg.senderId === 'object' ? msg.senderId._id : msg.senderId;

            queryClient.setQueryData<ConversationsCache>(
                [QUERY_KEYS.CONVERSATION_BY_USER, userId],
                (oldData) => {
                    if (!oldData?.data) return oldData;

                    return {
                        ...oldData,
                        data: oldData.data.map(conv => {
                            if (conv._id === msg.conversationId) {
                                const newUnreadCount = { ...conv.unreadCount };
                                if (senderId !== userId) {
                                    newUnreadCount[userId] = (newUnreadCount[userId] || 0) + 1;
                                }

                                return {
                                    ...conv,
                                    lastMessage: {
                                        _id: msg._id,
                                        type: msg.type,
                                        content: msg.content || '',
                                        createdAt: new Date(msg.createdAt),
                                        senderId: senderId,
                                        attachments: msg.attachments?.map(a => typeof a === 'string' ? a : a.url),
                                    },
                                    lastMessageAt: new Date(msg.createdAt),
                                    unreadCount: newUnreadCount,
                                };
                            }
                            return conv;
                        }).sort((a, b) => {
                            const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
                            const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
                            return timeB - timeA;
                        })
                    };
                }
            );

            if (
                senderId !== userId &&
                !msg.isMuted &&
                !msg.isRestricted &&
                msg.conversationId !== activeConversationId
            ) {
                setChatUnreadFallback(prev => prev + 1);
            }
        };

        // Server-driven unread reset for a conversation -> project into cache
        const onUnreadUpdate = (data: { conversationId: string; unreadCount: Record<string, number> }) => {
            queryClient.setQueryData<ConversationsCache>(
                [QUERY_KEYS.CONVERSATION_BY_USER, userId],
                (oldData) => {
                    if (!oldData?.data) return oldData;

                    return {
                        ...oldData,
                        data: oldData.data.map(conv =>
                            conv._id === data.conversationId
                                ? { ...conv, unreadCount: data.unreadCount }
                                : conv
                        ),
                    };
                }
            );
        };

        // Messages read - zero out own counter for that conversation
        const onMsgRead = (data: { conversationId: string; readByUserId?: string }) => {
            if (data.readByUserId !== userId) return;

            queryClient.setQueryData<ConversationsCache>(
                [QUERY_KEYS.CONVERSATION_BY_USER, userId],
                (oldData) => {
                    if (!oldData?.data) return oldData;

                    return {
                        ...oldData,
                        data: oldData.data.map(conv =>
                            conv._id === data.conversationId
                                ? { ...conv, unreadCount: { ...conv.unreadCount, [userId]: 0 } }
                                : conv
                        ),
                    };
                }
            );
        };

        // Mute toggle - keep mutedBy in the cache fresh so projections stay correct
        const onMuteUpdated = (data: { conversationId: string; userId: string; isMuted: boolean }) => {
            queryClient.setQueryData<ConversationsCache>(
                [QUERY_KEYS.CONVERSATION_BY_USER, userId],
                (oldData) => {
                    if (!oldData?.data) return oldData;

                    return {
                        ...oldData,
                        data: oldData.data.map(conv => {
                            if (conv._id === data.conversationId) {
                                const currentMutedBy = conv.mutedBy || [];
                                let newMutedBy: string[];

                                if (data.isMuted) {
                                    newMutedBy = currentMutedBy.includes(data.userId)
                                        ? currentMutedBy
                                        : [...currentMutedBy, data.userId];
                                } else {
                                    newMutedBy = currentMutedBy.filter(id => id !== data.userId);
                                }

                                return { ...conv, mutedBy: newMutedBy };
                            }
                            return conv;
                        })
                    };
                }
            );
        };

        const onNotif = (data: { count: number }) => setNotifUnread(data.count);

        socketChat.on('message:new', onMsg);
        socketChat.on('conversation:unread:updated', onUnreadUpdate);
        socketChat.on('conversation:unread:reset', onUnreadUpdate);
        socketChat.on('message:read:updated', onMsgRead);
        socketChat.on('conversation:mute:updated', onMuteUpdated);
        socketNotification.on('unreadCountUpdate', onNotif);
        return () => {
            socketChat.off('message:new', onMsg);
            socketChat.off('conversation:unread:updated', onUnreadUpdate);
            socketChat.off('conversation:unread:reset', onUnreadUpdate);
            socketChat.off('message:read:updated', onMsgRead);
            socketChat.off('conversation:mute:updated', onMuteUpdated);
            socketNotification.off('unreadCountUpdate', onNotif);
        };
    }, [socketChat, socketNotification, userId, queryClient, activeConversationId]);

    const isActive = (path: string) => {
        if (path === '/') return pathname === '/';
        return pathname?.startsWith(path) ?? false;
    };

    const getBadge = (key?: 'chat' | 'notification') => {
        if (key === 'chat') return chatUnread;
        if (key === 'notification') return notifUnread;
        return 0;
    };

    // Hide on chat detail pages (already fullscreen with back button)
    const isChatDetail = pathname?.match(/^\/chat\/[^/]+$/);

    return (
        <Box
            sx={{
                display: isChatDetail ? 'none' : { xs: 'flex', md: 'none' },
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 1300,
                bgcolor: 'background.paper',
                borderTop: `1px solid ${theme.palette.divider}`,
                height: 56,
                alignItems: 'center',
                justifyContent: 'space-around',
                px: 1,
                // iOS safe area
                paddingBottom: 'env(safe-area-inset-bottom)',
                boxShadow: isDark ? '0 -1px 8px rgba(0,0,0,0.3)' : '0 -1px 8px rgba(0,0,0,0.08)',
            }}
        >
            {NAV_ITEMS.map((item) => {
                const active = isActive(item.path);
                const Icon = active ? item.activeIcon : item.icon;
                const badgeCount = getBadge(item.badgeKey);

                return (
                    <Box
                        key={item.path}
                        onClick={() => router.push(item.path)}
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flex: 1,
                            height: '100%',
                            cursor: 'pointer',
                            color: active ? 'primary.main' : 'text.secondary',
                            position: 'relative',
                            transition: 'color 0.2s',
                            '&::before': active ? {
                                content: '""',
                                position: 'absolute',
                                top: 0,
                                left: '20%',
                                right: '20%',
                                height: 3,
                                borderRadius: '0 0 4px 4px',
                                bgcolor: 'primary.main',
                            } : {},
                            WebkitTapHighlightColor: 'transparent',
                        }}
                    >
                        <Badge
                            badgeContent={badgeCount > 0 ? badgeCount : undefined}
                            color="error"
                            max={99}
                        >
                            <Icon sx={{ fontSize: 26 }} />
                        </Badge>
                    </Box>
                );
            })}
        </Box>
    );
}
