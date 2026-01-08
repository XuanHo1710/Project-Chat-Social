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
    Divider,
    Button,
    CircularProgress,
    Skeleton,
} from '@mui/material';
import {
    Settings as SettingsIcon,
    MoreHoriz as MoreIcon,
    Groups as GroupsIcon,
    Check as CheckIcon,
    Close as CloseIcon,
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
                return <GroupsIcon sx={{ color: '#1877f2' }} />;
            default:
                return null;
        }
    };

    // Filter notifications
    const filteredNotifications = activeTab === 'unread'
        ? notifications.filter(n => n.status === NotificationStatus.UNREAD)
        : notifications;
    return (
        <Paper
            elevation={8}
            sx={{
                position: 'absolute',
                top: 56,
                right: 0,
                width: 360,
                maxHeight: 600,
                bgcolor: 'white',
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                zIndex: 1300,
            }}
        >
            {/* Header */}
            <Box sx={{ p: 2, borderBottom: '1px solid #e4e6eb' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="h6" fontWeight={700} color="#050505">
                        Thông báo
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                            size="small"
                            onClick={handleMarkAllAsRead}
                            title="Đánh dấu tất cả đã đọc"
                            sx={{
                                color: '#65676b',
                                bgcolor: '#f0f2f5',
                                '&:hover': { bgcolor: '#e4e6eb' },
                            }}
                        >
                            <CheckIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                            size="small"
                            sx={{
                                color: '#65676b',
                                bgcolor: '#f0f2f5',
                                '&:hover': { bgcolor: '#e4e6eb' },
                            }}
                        >
                            <SettingsIcon fontSize="small" />
                        </IconButton>
                    </Box>
                </Box>

                {/* Tabs */}
                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <Box
                        onClick={() => setActiveTab('all')}
                        sx={{
                            px: 2,
                            py: 0.75,
                            borderRadius: 5,
                            bgcolor: activeTab === 'all' ? '#e7f3ff' : '#f0f2f5',
                            color: activeTab === 'all' ? '#1877f2' : '#65676b',
                            fontSize: '15px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: activeTab === 'all' ? '#e7f3ff' : '#e4e6eb' },
                        }}
                    >
                        Tất cả
                    </Box>
                    <Box
                        onClick={() => setActiveTab('unread')}
                        sx={{
                            px: 2,
                            py: 0.75,
                            borderRadius: 5,
                            bgcolor: activeTab === 'unread' ? '#e7f3ff' : '#f0f2f5',
                            color: activeTab === 'unread' ? '#1877f2' : '#65676b',
                            fontSize: '15px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: activeTab === 'unread' ? '#e7f3ff' : '#e4e6eb' },
                        }}
                    >
                        Chưa đọc {unreadCount > 0 && `(${unreadCount})`}
                    </Box>
                </Box>
            </Box>

            {/* Notification List */}
            <Box
                sx={{
                    flex: 1,
                    overflow: 'auto',
                    '&::-webkit-scrollbar': { width: '8px' },
                    '&::-webkit-scrollbar-thumb': {
                        backgroundColor: '#c4c4c4',
                        borderRadius: '4px',
                    },
                }}
            >
                {isLoading ? (
                    <Box sx={{ p: 2 }}>
                        {[1, 2, 3].map(i => (
                            <Box key={i} sx={{ display: 'flex', gap: 2, mb: 2 }}>
                                <Skeleton variant="circular" width={56} height={56} />
                                <Box sx={{ flex: 1 }}>
                                    <Skeleton variant="text" width="80%" />
                                    <Skeleton variant="text" width="60%" />
                                </Box>
                            </Box>
                        ))}
                    </Box>
                ) : filteredNotifications.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography color="#65676b">
                            {activeTab === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo nào'}
                        </Typography>
                    </Box>
                ) : (
                    <List disablePadding>
                        {filteredNotifications.map((notification, index) => (
                            <React.Fragment key={notification._id}>
                                <ListItemButton
                                    onClick={() => handleNotificationClick(notification)}
                                    sx={{
                                        py: 1.5,
                                        px: 2,
                                        bgcolor: notification.status === NotificationStatus.UNREAD ? '#e7f3ff' : 'transparent',
                                        '&:hover': {
                                            bgcolor: notification.status === NotificationStatus.UNREAD ? '#d8e9ff' : '#f0f2f5',
                                        },
                                        flexDirection: 'column',
                                        alignItems: 'flex-start',
                                    }}
                                >
                                    <Box sx={{ display: 'flex', width: '100%', alignItems: 'flex-start' }}>
                                        <ListItemAvatar>
                                            <Box sx={{ position: 'relative' }}>
                                                <Avatar
                                                    src={
                                                        notification.groupId?.avatar ||
                                                        notification.senderId?.avatar ||
                                                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                                            notification.senderId?.firstName || 'U'
                                                        )}&background=1877f2&color=fff`
                                                    }
                                                    sx={{ width: 56, height: 56 }}
                                                />
                                                {getNotificationIcon(notification.type) && (
                                                    <Box
                                                        sx={{
                                                            position: 'absolute',
                                                            bottom: -4,
                                                            right: -4,
                                                            bgcolor: 'white',
                                                            borderRadius: '50%',
                                                            p: 0.5,
                                                            display: 'flex',
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
                                                    fontSize={15}
                                                    fontWeight={notification.status === NotificationStatus.UNREAD ? 600 : 400}
                                                    color="#050505"
                                                    sx={{
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 3,
                                                        WebkitBoxOrient: 'vertical',
                                                        overflow: 'hidden',
                                                    }}
                                                >
                                                    {notification.message}
                                                </Typography>
                                            }
                                            secondary={
                                                <Typography
                                                    variant="body2"
                                                    color={notification.status === NotificationStatus.UNREAD ? '#1877f2' : '#65676b'}
                                                    fontSize={13}
                                                    fontWeight={notification.status === NotificationStatus.UNREAD ? 600 : 400}
                                                    sx={{ mt: 0.5 }}
                                                >
                                                    {formatTime(notification.createdAt)}
                                                </Typography>
                                            }
                                        />
                                        {notification.status === NotificationStatus.UNREAD && (
                                            <Badge
                                                badgeContent=" "
                                                sx={{
                                                    ml: 1,
                                                    mt: 2,
                                                    '& .MuiBadge-badge': {
                                                        backgroundColor: '#1877f2',
                                                        width: 12,
                                                        height: 12,
                                                        borderRadius: '50%',
                                                        minWidth: 12,
                                                    },
                                                }}
                                            />
                                        )}
                                    </Box>

                                    {/* Action buttons for group invitation */}
                                    {notification.type === NotificationType.GROUP_INVITATION &&
                                        notification.actionStatus === 'PENDING' && (
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    gap: 1,
                                                    mt: 1.5,
                                                    ml: 9,
                                                    width: 'calc(100% - 72px)',
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Button
                                                    variant="contained"
                                                    size="small"
                                                    onClick={() => handleRespondToInvitation(notification._id, 'ACCEPT')}
                                                    disabled={respondingId === notification._id}
                                                    sx={{
                                                        flex: 1,
                                                        bgcolor: '#1877f2',
                                                        textTransform: 'none',
                                                        fontWeight: 600,
                                                        '&:hover': { bgcolor: '#166fe5' },
                                                    }}
                                                >
                                                    {respondingId === notification._id ? (
                                                        <CircularProgress size={20} color="inherit" />
                                                    ) : (
                                                        'Tham gia'
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    onClick={() => handleRespondToInvitation(notification._id, 'REJECT')}
                                                    disabled={respondingId === notification._id}
                                                    sx={{
                                                        flex: 1,
                                                        borderColor: '#e4e6eb',
                                                        color: '#050505',
                                                        bgcolor: '#e4e6eb',
                                                        textTransform: 'none',
                                                        fontWeight: 600,
                                                        '&:hover': { bgcolor: '#d8dadf', borderColor: '#d8dadf' },
                                                    }}
                                                >
                                                    Từ chối
                                                </Button>
                                            </Box>
                                        )}

                                    {/* Show status for responded invitations */}
                                    {notification.type === NotificationType.GROUP_INVITATION &&
                                        notification.actionStatus !== 'PENDING' && (
                                            <Typography
                                                sx={{
                                                    ml: 9,
                                                    mt: 1,
                                                    fontSize: 13,
                                                    color: notification.actionStatus === 'ACCEPTED' ? '#42b72a' : '#65676b',
                                                    fontStyle: 'italic',
                                                }}
                                            >
                                                {notification.actionStatus === 'ACCEPTED'
                                                    ? 'Đã tham gia nhóm'
                                                    : 'Đã từ chối lời mời'}
                                            </Typography>
                                        )}
                                </ListItemButton>
                                {index < filteredNotifications.length - 1 && (
                                    <Divider sx={{ borderColor: '#e4e6eb', mx: 2 }} />
                                )}
                            </React.Fragment>
                        ))}
                    </List>
                )}
            </Box>

            {/* Footer */}
            <Box
                sx={{
                    p: 1.5,
                    borderTop: '1px solid #e4e6eb',
                    textAlign: 'center',
                }}
            >
                <Typography
                    onClick={() => router.push('/notifications')}
                    sx={{
                        color: '#1877f2',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        '&:hover': {
                            textDecoration: 'underline',
                        },
                    }}
                >
                    Xem tất cả thông báo
                </Typography>
            </Box>
        </Paper>
    );
}
