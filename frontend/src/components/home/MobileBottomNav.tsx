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
import { useEffect, useState } from 'react';
import { conversationService } from '@/services/conversation.service';
import { notificationService } from '@/services/notification.service';
import { useSocket } from '@/contexts/SocketContext';

const NAV_ITEMS = [
    { path: '/', icon: HomeOutlinedIcon, activeIcon: HomeIcon, label: 'Home' },
    { path: '/friends', icon: PeopleOutlinedIcon, activeIcon: PeopleIcon, label: 'Friends' },
    { path: '/reels', icon: OndemandVideoOutlinedIcon, activeIcon: OndemandVideoIcon, label: 'Watch' },
    { path: '/chat', icon: ChatOutlinedIcon, activeIcon: ChatIcon, label: 'Chat', badgeKey: 'chat' as const },
    { path: '/notifications', icon: NotificationsOutlinedIcon, activeIcon: NotificationsIcon, label: 'Notifications', badgeKey: 'notification' as const },
];

export default function MobileBottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const { socketChat, socketNotification } = useSocket();

    const [chatUnread, setChatUnread] = useState(0);
    const [notifUnread, setNotifUnread] = useState(0);

    useEffect(() => {
        conversationService.unreadCountAllConversationByUserId()
            .then(res => { if (res?.unreadCount) setChatUnread(res.unreadCount); })
            .catch(() => { });
        notificationService.getUnreadCount()
            .then(res => { if (res?.unreadCount) setNotifUnread(res.unreadCount); })
            .catch(() => { });
    }, []);

    useEffect(() => {
        if (!socketChat || !socketNotification) return;

        const onMsg = () => setChatUnread(prev => prev + 1);
        const onNotif = (data: { count: number }) => setNotifUnread(data.count);

        socketChat.on('message:new', onMsg);
        socketNotification.on('unreadCountUpdate', onNotif);
        return () => {
            socketChat.off('message:new', onMsg);
            socketNotification.off('unreadCountUpdate', onNotif);
        };
    }, [socketChat, socketNotification]);

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
