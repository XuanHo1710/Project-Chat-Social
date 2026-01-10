'use client';

import React, { useEffect, useState, useCallback } from 'react';
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
    Badge,
    Button,
    CircularProgress,
    Skeleton,
} from '@mui/material';
import {
    MoreHoriz as MoreIcon,
    Groups as GroupsIcon,
} from '@mui/icons-material';
import { notificationService } from '@/services/notification.service';
import { Notification, NotificationType, NotificationStatus } from '@/types/notification';

import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/useAuthStore';
import { timeAgo } from '@/utils/formatDate';

interface NotificationPopupProps {
    onUnreadCountChange?: (count: number) => void;
}

export default function NotificationPopup({ onUnreadCountChange }: NotificationPopupProps) {
    const router = useRouter();
    const { user, accessToken } = useAuthStore();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);
    const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
    const [respondingId, setRespondingId] = useState<string | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);

    // Connect to notification socket
    useEffect(() => {
        if (user?.id && accessToken) {
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';
            const newSocket = io(`${backendUrl}/notifications`, {
                query: { userId: user.id },
                transports: ['websocket'],
            });

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

            setSocket(newSocket);

            return () => {
                newSocket.disconnect();
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

    // Handle group invitation response
    const handleRespondToInvitation = async (notificationId: string, action: 'ACCEPT' | 'REJECT') => {
        setRespondingId(notificationId);
        try {
            await notificationService.respondToGroupInvitation(notificationId, action);
            setNotifications(prev =>
                prev.map(n =>
                    n._id === notificationId
                        ? { ...n, actionStatus: action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED', status: NotificationStatus.READ }
                        : n
                )
            );
            toast.success(action === 'ACCEPT' ? 'Đã tham gia nhóm' : 'Đã từ chối lời mời');

            // Refresh to update unread count
            const countResponse = await notificationService.getUnreadCount();
            setUnreadCount(countResponse.unreadCount);
            onUnreadCountChange?.(countResponse.unreadCount);
        } catch {
            toast.error('Không thể xử lý lời mời');
        } finally {
            setRespondingId(null);
        }
    };

    // Mark as read
    const handleMarkAsRead = async (notificationId: string) => {
        try {
            await notificationService.markAsRead(notificationId);
            setNotifications(prev =>
                prev.map(n =>
                    n._id === notificationId ? { ...n, status: NotificationStatus.READ } : n
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
            setNotifications(prev => prev.map(n => ({ ...n, status: NotificationStatus.READ })));
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
        if (notification.status === NotificationStatus.UNREAD) {
            handleMarkAsRead(notification._id);
        }

        // Navigate based on notification type
        if (notification.groupId && notification.type !== NotificationType.GROUP_INVITATION) {
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
    const getNotificationIcon = (type: NotificationType) => {
        switch (type) {
            case NotificationType.GROUP_INVITATION:
            case NotificationType.GROUP_ROLE_CHANGED:
            case NotificationType.GROUP_OWNERSHIP_TRANSFERRED:
                return <GroupsIcon sx={{ color: 'white', fontSize: 14 }} />;
            default:
                return null;
        }
    };

    // Filter notifications
    const filteredNotifications = activeTab === 'unread'
        ? notifications.filter(n => n.status === NotificationStatus.UNREAD)
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

    // Render notification item
    const renderNotificationItem = (notification: Notification) => (
        <ListItemButton
            key={notification._id}
            onClick={() => handleNotificationClick(notification)}
            sx={{
                py: 1.5,
                px: 1.5,
                mx: 1,
                borderRadius: '8px',
                bgcolor: notification.status === NotificationStatus.UNREAD ? 'rgba(24, 119, 242, 0.08)' : 'transparent',
                '&:hover': {
                    bgcolor: notification.status === NotificationStatus.UNREAD ? 'rgba(24, 119, 242, 0.12)' : '#f0f2f5',
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
                                bgcolor: '#1877f2',
                                borderRadius: '50%',
                                width: 24,
                                height: 24,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '2px solid white',
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
                            fontWeight: notification.status === NotificationStatus.UNREAD ? 600 : 400,
                            color: '#050505',
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
                        <Typography
                            sx={{
                                fontSize: 13,
                                color: notification.status === NotificationStatus.UNREAD ? '#1877f2' : '#65676b',
                                fontWeight: notification.status === NotificationStatus.UNREAD ? 600 : 400,
                            }}
                        >
                            {formatTime(notification.createdAt)}
                        </Typography>
                        {notification.type === NotificationType.GROUP_INVITATION && notification.actionStatus === 'PENDING' && (
                            <>
                                <Typography sx={{ color: '#65676b', fontSize: 13 }}>·</Typography>
                                <Typography sx={{ color: '#65676b', fontSize: 13 }}>
                                    {/* {notification.totalReacts || 0} cảm xúc */}
                                </Typography>
                                <Typography sx={{ color: '#65676b', fontSize: 13 }}>·</Typography>
                                <Typography sx={{ color: '#65676b', fontSize: 13 }}>
                                    {/* {notification.totalComments || 0} bình luận */}
                                </Typography>
                            </>
                        )}
                    </Box>
                }
            />
            {notification.status === NotificationStatus.UNREAD && (
                <Box
                    sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        bgcolor: '#1877f2',
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
                bgcolor: 'white',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 12px 28px 0 rgba(0, 0, 0, 0.2), 0 2px 4px 0 rgba(0, 0, 0, 0.1), inset 0 0 0 1px rgba(255,255,255,0.5)',
                zIndex: 1300,
            }}
        >
            {/* Header */}
            <Box sx={{ px: 2, pt: 2.5, pb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#050505' }}>
                        Thông báo
                    </Typography>
                    <IconButton
                        size="small"
                        onClick={handleMarkAllAsRead}
                        sx={{
                            width: 36,
                            height: 36,
                            bgcolor: '#e4e6eb',
                            '&:hover': { bgcolor: '#d8dadf' },
                        }}
                    >
                        <MoreIcon sx={{ fontSize: 20, color: '#050505' }} />
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
                            bgcolor: activeTab === 'all' ? '#e7f3ff' : 'transparent',
                            color: activeTab === 'all' ? '#1877f2' : '#65676b',
                            fontSize: 15,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            '&:hover': { bgcolor: activeTab === 'all' ? '#e7f3ff' : '#f0f2f5' },
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
                            bgcolor: activeTab === 'unread' ? '#e7f3ff' : 'transparent',
                            color: activeTab === 'unread' ? '#1877f2' : '#65676b',
                            fontSize: 15,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            '&:hover': { bgcolor: activeTab === 'unread' ? '#e7f3ff' : '#f0f2f5' },
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
                        <Typography sx={{ color: '#65676b', fontSize: 15 }}>
                            {activeTab === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo nào'}
                        </Typography>
                    </Box>
                ) : (
                    <List disablePadding>
                        {/* New notifications */}
                        {today.length > 0 && (
                            <>
                                <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Typography sx={{ fontWeight: 600, fontSize: 17, color: '#050505' }}>
                                        Mới
                                    </Typography>
                                    <Typography
                                        onClick={() => router.push('/notifications')}
                                        sx={{
                                            color: '#1877f2',
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
                                    <Typography sx={{ fontWeight: 600, fontSize: 17, color: '#050505' }}>
                                        Trước đó
                                    </Typography>
                                </Box>
                                {earlier.map(notification => renderNotificationItem(notification))}
                            </>
                        )}

                        {/* If no today notifications but has earlier */}
                        {today.length === 0 && earlier.length > 0 && (
                            <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Typography sx={{ fontWeight: 600, fontSize: 17, color: '#050505' }}>
                                    Tất cả thông báo
                                </Typography>
                                <Typography
                                    onClick={() => router.push('/notifications')}
                                    sx={{
                                        color: '#1877f2',
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
