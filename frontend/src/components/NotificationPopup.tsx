'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    Box,
    Paper,
    Typography,
    IconButton,
    List,
    ListItemButton,
    ListItemAvatar,
    Avatar,
    ListItemText,
    Skeleton,
    useTheme,
    alpha,
    Button,
} from '@mui/material';
import {
    MoreHoriz as MoreIcon,
    Groups as GroupsIcon,
} from '@mui/icons-material';
import { notificationService } from '@/services/notification.service';

import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/useAuthStore';
import { timeAgo } from '@/utils/formatDate';
import { Notification, NotificationEnum } from '@/types/notification';

interface NotificationPopupProps {
    onUnreadCountChange?: (count: number) => void;
}

export default function NotificationPopup({ onUnreadCountChange }: NotificationPopupProps) {
    const router = useRouter();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const { user, accessToken } = useAuthStore();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);
    const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
    const socketRef = useRef<Socket | null>(null);


    const hoverBg = isDark ? 'rgba(255,255,255,0.1)' : 'action.hover';
    const selectedBg = isDark ? alpha(theme.palette.primary.main, 0.3) : alpha(theme.palette.primary.main, 0.1);

    // Connect to notification socket
    useEffect(() => {
        if (user?.id && accessToken) {
            if (socketRef.current) return; // đã connect rồi thì thôi

            const backendUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
            const newSocket = io(`${backendUrl}/notifications`, {
                query: { userId: user.id },
                transports: ['websocket'],
                reconnection: true,
            });

            socketRef.current = newSocket;


            newSocket.on('connect', () => {
                console.log('Connected to notification socket');
            });

            newSocket.on('newNotification', (notification: Notification) => {
                setNotifications(prev => [notification, ...prev]);
                setUnreadCount(prev => {
                    const newCount = prev + 1;
                    onUnreadCountChange?.(newCount);
                    return newCount;
                });
                toast.info(notification.title, {
                    description: notification.message,
                });
            });

            newSocket.on('unreadCountUpdate', ({ count }: { count: number }) => {
                setUnreadCount(count);
                onUnreadCountChange?.(count);
            });


            return () => {
                newSocket.disconnect();
                socketRef.current = null;

            };
        }
    }, [user?.id, accessToken, onUnreadCountChange]);

    // Load notifications
    const loadNotifications = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await notificationService.getNotifications(1, 20);
            setNotifications(response.notifications);
            setUnreadCount(response.unreadCount);
            onUnreadCountChange?.(response.unreadCount);
        } catch (error) {
            console.error('Failed to load notifications:', error);
        } finally {
            setIsLoading(false);
        }
    }, [onUnreadCountChange]);

    useEffect(() => {
        loadNotifications();
    }, [loadNotifications]);


    // Mark as read
    const handleMarkAsRead = async (notificationId: string) => {
        try {
            await notificationService.markAsRead(notificationId);
            setNotifications(prev =>
                prev.map(n =>
                    n._id === notificationId ? { ...n, status: "READ" } : n
                )
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
            onUnreadCountChange?.(Math.max(0, unreadCount - 1));
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
    };

    // Mark all as read
    const handleMarkAllAsRead = async () => {
        try {
            await notificationService.markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, status: "READ" })));
            setUnreadCount(0);
            onUnreadCountChange?.(0);
            toast.success('Đã đánh dấu tất cả là đã đọc');
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    // Navigate to related content
    const handleNotificationClick = (notification: Notification) => {
        // Mark as read first
        if (notification.status === "UNREAD") {
            handleMarkAsRead(notification._id);
        }

        // Navigate based on notification type
        if (notification.groupId) {
            router.push(`/groups/${notification.groupId._id}`);
        }
    };

    // Format time
    const formatTime = (date: string) => {
        try {
            return timeAgo(new Date(date));
        } catch {
            return '';
        }
    };

    // Get notification icon
    const getNotificationIcon = (type: NotificationEnum) => {
        switch (type) {
            case "GROUP_INVITATION":
            case "GROUP_ROLE_CHANGED":
            case "GROUP_OWNERSHIP_TRANSFERRED":
                return <GroupsIcon sx={{ color: 'white', fontSize: 14 }} />;
            default:
                return null;
        }
    };

    // Filter notifications
    const filteredNotifications = activeTab === 'unread'
        ? notifications.filter(n => n.status === "UNREAD")
        : notifications;

    // Group notifications by time
    const groupNotificationsByTime = () => {
        const now = new Date();
        const today: Notification[] = [];
        const earlier: Notification[] = [];

        filteredNotifications.forEach(n => {
            const notifDate = new Date(n.createdAt);
            const diffHours = (now.getTime() - notifDate.getTime()) / (1000 * 60 * 60);
            if (diffHours < 24) {
                today.push(n);
            } else {
                earlier.push(n);
            }
        });

        return { today, earlier };
    };

    const { today, earlier } = groupNotificationsByTime();
    console.log('Rendered NotificationPopup with notifications:', notifications);

    // Handle accept/decline group invitation
    const handleAcceptInvitedGroup = async (accept: boolean, notificationId: string) => {
        try {
            await notificationService.respondToGroupInvitation(notificationId, accept ? "ACCEPT" : "REJECT");
            setNotifications(prev => prev.map(n => n._id === notificationId
                ? {
                    ...n,
                    actionStatus: accept ? 'ACCEPTED' : 'REJECTED',
                    status: "READ",
                    message: accept ? 'Bạn đã chấp nhận lời mời tham gia nhóm.' : 'Bạn đã từ chối lời mời tham gia nhóm.'
                }
                : n
            ));
        } catch {
            toast.error('Đã có lỗi xảy ra. Vui lòng thử lại sau.');
        }


    }

    // Render notification item
    const renderNotificationItem = (notification: Notification) => (
        <ListItemButton
            key={notification._id}
            onClick={() => handleNotificationClick(notification)}
            sx={{
                py: 1.5,
                px: 1.5,
                mx: 1,
                gap: 1.5,
                borderRadius: '8px',
                bgcolor: notification.status === "UNREAD" ? (isDark ? alpha(theme.palette.primary.main, 0.15) : alpha(theme.palette.primary.main, 0.08)) : 'transparent',
                '&:hover': {
                    bgcolor: notification.status === "UNREAD" ? (isDark ? alpha(theme.palette.primary.main, 0.2) : alpha(theme.palette.primary.main, 0.12)) : 'action.hover',
                },
            }}
        >
            <ListItemAvatar sx={{ minWidth: 64 }}>
                <Box sx={{ position: 'relative' }}>
                    <Avatar
                        src={
                            notification.groupId?.avatar ||
                            notification.senderId?.avatar ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                notification.senderId?.firstName || 'U'
                            )}&background=1877f2&color=fff`
                        }
                        sx={{ width: 60, height: 60 }}
                    />
                    {getNotificationIcon(notification.type) && (
                        <Box
                            sx={{
                                position: 'absolute',
                                bottom: -2,
                                right: -2,
                                bgcolor: 'primary.main',
                                borderRadius: '50%',
                                width: 24,
                                height: 24,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: `2px solid ${theme.palette.background.paper}`,
                            }}
                        >
                            {getNotificationIcon(notification.type)}
                        </Box>
                    )}
                </Box>
            </ListItemAvatar>
            <ListItemText
                primary={
                    <Typography
                        sx={{
                            fontSize: 15,
                            fontWeight: notification.status === "UNREAD" ? 600 : 400,
                            color: 'text.primary',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.3,
                        }}
                    >
                        {notification.message}
                    </Typography>
                }
                secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        {notification.type === "GROUP_INVITATION" && notification.actionStatus === 'PENDING' ? (
                            <>

                                {/* Chấp nhận */}
                                <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleAcceptInvitedGroup(true, notification._id);
                                    }}
                                    sx={{
                                        textTransform: 'none',
                                        fontSize: 12,
                                        borderRadius: 1,
                                        px: 1,
                                        color: 'primary.main',
                                        borderColor: 'primary.main',
                                        backgroundColor: 'transparent',
                                        boxShadow: 'none',
                                        '&:hover': {
                                            backgroundColor: 'primary.main',
                                            color: '#fff',
                                            borderColor: 'primary.main',
                                            boxShadow: 'none',
                                        },
                                    }}
                                >
                                    Chấp nhận
                                </Button>


                                {/* Từ chối */}
                                <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleAcceptInvitedGroup(false, notification._id);
                                    }}
                                    sx={{
                                        textTransform: 'none',
                                        fontSize: 12,
                                        borderRadius: 1,
                                        px: 1,
                                        color: 'error.main',
                                        borderColor: 'error.main',
                                        backgroundColor: 'transparent',
                                        boxShadow: 'none',
                                        '&:hover': {
                                            backgroundColor: 'error.main',
                                            color: '#fff',
                                            borderColor: 'error.main',
                                            boxShadow: 'none',
                                        },
                                    }}
                                >
                                    Từ chối
                                </Button>


                                <Typography
                                    sx={{
                                        fontSize: 13,
                                        color: notification.status === "UNREAD" ? 'primary.main' : 'text.secondary',
                                        fontWeight: notification.status === "UNREAD" ? 600 : 400,
                                    }}
                                >
                                    {formatTime(notification.createdAt)}
                                </Typography>
                            </>
                        ) :
                            <Typography
                                sx={{
                                    fontSize: 13,
                                    color: notification.status === "UNREAD" ? 'primary.main' : 'text.secondary',
                                    fontWeight: notification.status === "UNREAD" ? 600 : 400,
                                }}
                            >
                                {formatTime(notification.createdAt)}
                            </Typography>
                        }
                    </Box>
                }
            />
            {notification.status === "UNREAD" && (
                <Box
                    sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                        ml: 1,
                        flexShrink: 0,
                    }}
                />
            )}
        </ListItemButton>
    );

    return (
        <Paper
            elevation={8}
            sx={{
                position: 'absolute',
                top: 56,
                right: 0,
                width: 400,
                maxHeight: 'calc(100vh - 70px)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                zIndex: 1300,
            }}
        >
            {/* Header */}
            <Box sx={{ px: 2, pt: 2.5, pb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography sx={{ fontSize: 24, fontWeight: 700, color: 'text.primary' }}>
                        Thông báo
                    </Typography>
                    <IconButton
                        size="small"
                        onClick={handleMarkAllAsRead}
                        sx={{
                            width: 36,
                            height: 36,
                            bgcolor: 'action.hover',
                        }}
                    >
                        <MoreIcon sx={{ fontSize: 20, color: 'text.primary' }} />
                    </IconButton>
                </Box>

                {/* Tabs */}
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Box
                        onClick={() => setActiveTab('all')}
                        sx={{
                            px: 2,
                            py: 1,
                            borderRadius: '20px',
                            bgcolor: activeTab === 'all' ? selectedBg : 'transparent',
                            color: activeTab === 'all' ? 'primary.main' : 'text.secondary',
                            fontSize: 15,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            '&:hover': { bgcolor: activeTab === 'all' ? selectedBg : hoverBg },
                        }}
                    >
                        Tất cả
                    </Box>
                    <Box
                        onClick={() => setActiveTab('unread')}
                        sx={{
                            px: 2,
                            py: 1,
                            borderRadius: '20px',
                            bgcolor: activeTab === 'unread' ? selectedBg : 'transparent',
                            color: activeTab === 'unread' ? 'primary.main' : 'text.secondary',
                            fontSize: 15,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            '&:hover': { bgcolor: activeTab === 'unread' ? selectedBg : hoverBg },
                        }}
                    >
                        Chưa đọc
                    </Box>
                </Box>
            </Box>

            {/* Notification List */}
            <Box
                sx={{
                    flex: 1,
                    overflow: 'auto',
                    '&::-webkit-scrollbar': { width: 8 },
                    '&::-webkit-scrollbar-thumb': {
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        borderRadius: 4,
                    },
                }}
            >
                {isLoading ? (
                    <Box sx={{ p: 1 }}>
                        {[1, 2, 3, 4].map(i => (
                            <Box key={i} sx={{ display: 'flex', gap: 1.5, p: 1, mx: 1 }}>
                                <Skeleton variant="circular" width={56} height={56} />
                                <Box sx={{ flex: 1 }}>
                                    <Skeleton variant="text" width="90%" height={20} />
                                    <Skeleton variant="text" width="70%" height={20} />
                                    <Skeleton variant="text" width="40%" height={16} />
                                </Box>
                            </Box>
                        ))}
                    </Box>
                ) : filteredNotifications.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography sx={{ color: 'text.secondary', fontSize: 15 }}>
                            {activeTab === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo nào'}
                        </Typography>
                    </Box>
                ) : (
                    <List disablePadding>
                        {/* New notifications */}
                        {today.length > 0 && (
                            <>
                                <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Typography sx={{ fontWeight: 600, fontSize: 17, color: 'text.primary' }}>
                                        Mới
                                    </Typography>
                                    <Typography
                                        onClick={() => router.push('/notifications')}
                                        sx={{
                                            color: 'primary.main',
                                            fontSize: 15,
                                            cursor: 'pointer',
                                            '&:hover': { textDecoration: 'underline' }
                                        }}
                                    >
                                        Xem tất cả
                                    </Typography>
                                </Box>
                                {today.map(notification => renderNotificationItem(notification))}
                            </>
                        )}

                        {/* Earlier notifications */}
                        {earlier.length > 0 && (
                            <>
                                <Box sx={{ px: 2, py: 1, mt: 1 }}>
                                    <Typography sx={{ fontWeight: 600, fontSize: 17, color: 'text.primary' }}>
                                        Trước đó
                                    </Typography>
                                </Box>
                                {earlier.map(notification => renderNotificationItem(notification))}
                            </>
                        )}

                        {/* If no today notifications but has earlier */}
                        {today.length === 0 && earlier.length > 0 && (
                            <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Typography sx={{ fontWeight: 600, fontSize: 17, color: 'text.primary' }}>
                                    Tất cả thông báo
                                </Typography>
                                <Typography
                                    onClick={() => router.push('/notifications')}
                                    sx={{
                                        color: 'primary.main',
                                        fontSize: 15,
                                        cursor: 'pointer',
                                        '&:hover': { textDecoration: 'underline' }
                                    }}
                                >
                                    Xem tất cả
                                </Typography>
                            </Box>
                        )}
                    </List>
                )}
            </Box>
        </Paper>
    );
}
