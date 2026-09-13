'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    Box,
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
    CircularProgress,
    Tabs,
    Tab,
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    DoneAll as DoneAllIcon,
    Groups as GroupsIcon,
    Comment as CommentIcon,
    ReplyOutlined as ReplyIcon,
} from '@mui/icons-material';
import { notificationService } from '@/services/notification.service';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import { timeAgo } from '@/utils/formatDate';
import { Notification, NotificationEnum } from '@/types/notification';
import { useTranslation } from 'react-i18next';
import { useSocket } from '@/contexts/SocketContext';
import { toast } from 'sonner';
import { renderNotification } from '@/utils/notificationText';

export default function NotificationsPage() {
    const router = useRouter();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const { user } = useAuthStore();
    const { socketNotification } = useSocket();
    const { t } = useTranslation();

    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [activeTab, setActiveTab] = useState(0); // 0=all, 1=unread, 2=invitations
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
    const listRef = useRef<HTMLDivElement>(null);

    const tabMap = ['all', 'unread', 'invitations'] as const;

    // Socket listener
    useEffect(() => {
        if (!socketNotification) return;

        const onNew = (notification: Notification) => {
            setNotifications(prev => {
                const idx = prev.findIndex(n => n._id === notification._id);
                if (idx >= 0) {
                    const updated = [...prev];
                    updated.splice(idx, 1);
                    return [notification, ...updated];
                }
                return [notification, ...prev];
            });
        };

        const onCount = ({ count }: { count: number }) => setUnreadCount(count);

        socketNotification.on('newNotification', onNew);
        socketNotification.on('unreadCountUpdate', onCount);
        return () => {
            socketNotification.off('newNotification', onNew);
            socketNotification.off('unreadCountUpdate', onCount);
        };
    }, [socketNotification]);

    // Load notifications
    const loadNotifications = useCallback(async (tabIndex: number, page = 1) => {
        try {
            if (page === 1) setIsLoading(true);
            else setIsLoadingMore(true);

            const tab = tabMap[tabIndex];
            const status = tab === 'unread' ? 'UNREAD' : undefined;
            const type = tab === 'invitations' ? 'GROUP_INVITATION' : undefined;

            const res = await notificationService.getNotifications(page, 15, status, type);

            if (page === 1) {
                setNotifications(res.notifications);
            } else {
                setNotifications(prev => [...prev, ...res.notifications]);
            }
            setUnreadCount(res.unreadCount);
            setPagination({ page: res.page, totalPages: res.totalPages });
        } catch {
            // silent
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, []);

    useEffect(() => {
        loadNotifications(activeTab);
    }, [activeTab, loadNotifications]);

    // Infinite scroll
    const handleScroll = useCallback(() => {
        const el = listRef.current;
        if (!el || isLoadingMore || pagination.page >= pagination.totalPages) return;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
            loadNotifications(activeTab, pagination.page + 1);
        }
    }, [activeTab, pagination, isLoadingMore, loadNotifications]);

    useEffect(() => {
        const el = listRef.current;
        if (!el) return;
        el.addEventListener('scroll', handleScroll);
        return () => el.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

    // Actions
    const handleMarkAsRead = async (id: string) => {
        try {
            await notificationService.markAsRead(id);
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, status: 'READ' as const } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch { /* silent */ }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await notificationService.markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, status: 'READ' as const })));
            setUnreadCount(0);
            toast.success(t('notifications.marked_all_read'));
        } catch { /* silent */ }
    };

    const handleClick = (n: Notification) => {
        if (n.status === 'UNREAD') handleMarkAsRead(n._id);
        if (n.groupId) {
            router.push(`/groups/${n.groupId._id}`);
        } else if (n.postId) {
            // Build URL with postId and optionally commentId for comment-type notifications
            const isCommentType = ['POST_COMMENTED', 'COMMENT_REPLIED', 'COMMENT_REACTED'].includes(n.type);
            const params = new URLSearchParams({ postId: n.postId });
            if (isCommentType && n.commentId) {
                params.set('commentId', n.commentId);
            }
            if (isCommentType) {
                params.set('openComments', '1');
            }
            router.push(`/?${params.toString()}`);
        }
    };

    const handleRespondInvitation = async (accept: boolean, id: string) => {
        try {
            await notificationService.respondToGroupInvitation(id, accept ? 'ACCEPT' : 'REJECT');
            setNotifications(prev => prev.map(n => n._id === id ? {
                ...n, actionStatus: accept ? 'ACCEPTED' : 'REJECTED', status: 'READ' as const,
                message: accept ? t('notifications.accepted_invitation') : t('notifications.declined_invitation'),
                templateKey: undefined,
                templateParams: undefined,
            } : n));
        } catch {
            toast.error(t('common.error'));
        }
    };

    const getIcon = (type: NotificationEnum, reactionType?: string) => {
        switch (type) {
            case 'COMMENT_REPLIED':
            case 'POST_COMMENTED':
                return <CommentIcon sx={{ color: 'white', fontSize: 14 }} />;
            case 'POST_REACTED':
            case 'COMMENT_REACTED':
                return reactionType;
            case 'POST_SHARED':
                return <ReplyIcon sx={{ color: 'white', fontSize: 14 }} />;
            case 'GROUP_INVITATION':
            case 'GROUP_ROLE_CHANGED':
            case 'GROUP_OWNERSHIP_TRANSFERRED':
                return <GroupsIcon sx={{ color: 'white', fontSize: 14 }} />;
            default:
                return null;
        }
    };

    const getIconBg = (type: NotificationEnum) => {
        if (type === 'COMMENT_REPLIED' || type === 'POST_COMMENTED') return 'green';
        if (type === 'POST_REACTED' || type === 'COMMENT_REACTED') return theme.palette.background.paper;
        return theme.palette.primary.main;
    };

    // Group by time
    const today: Notification[] = [];
    const earlier: Notification[] = [];
    const now = Date.now();
    notifications.forEach(n => {
        const diff = now - new Date(n.updatedAt || n.createdAt).getTime();
        (diff < 86400000 ? today : earlier).push(n);
    });

    const renderItem = (n: Notification) => {
        const text = renderNotification(n, t);
        return (
        <ListItemButton
            key={n._id}
            onClick={() => handleClick(n)}
            sx={{
                py: 1.2, px: 2, gap: 1.5, borderRadius: '8px', mx: 1,
                bgcolor: n.status === 'UNREAD'
                    ? alpha(theme.palette.primary.main, isDark ? 0.15 : 0.08)
                    : 'transparent',
                '&:hover': {
                    bgcolor: n.status === 'UNREAD'
                        ? alpha(theme.palette.primary.main, isDark ? 0.2 : 0.12)
                        : 'action.hover'
                },
            }}
        >
            <ListItemAvatar sx={{ minWidth: 56 }}>
                <Box sx={{ position: 'relative', width: 48, height: 48 }}>
                    {n.senderIds && n.senderIds.length > 1 ? (
                        <Box sx={{ position: 'relative', width: 48, height: 48 }}>
                            {n.senderIds.slice(0, 2).map((s, i) => (
                                <Avatar key={s._id} src={s.avatar || ''} sx={{
                                    width: 32, height: 32, position: 'absolute',
                                    border: `2px solid ${theme.palette.background.paper}`,
                                    ...(i === 0 ? { top: 0, left: 0, zIndex: 2 } : { bottom: 0, right: 0, zIndex: 1 }),
                                }} />
                            ))}
                        </Box>
                    ) : (
                        <Avatar src={n.groupId?.avatar || n.senderIds?.[0]?.avatar || ''} sx={{ width: 48, height: 48 }} />
                    )}
                    {getIcon(n.type, n.typeReaction) && (
                        <Box sx={{
                            position: 'absolute', bottom: -2, right: -2,
                            bgcolor: getIconBg(n.type), borderRadius: '50%',
                            width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: `2px solid ${theme.palette.background.paper}`, zIndex: 5,
                        }}>
                            {getIcon(n.type, n.typeReaction)}
                        </Box>
                    )}
                </Box>
            </ListItemAvatar>
            <ListItemText
                primary={
                    <>
                        <Typography sx={{
                            fontSize: 14, fontWeight: n.status === 'UNREAD' ? 600 : 400,
                            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                            lineHeight: 1.3,
                        }}>
                            {text.title}
                        </Typography>
                        {text.message && (
                            <Typography sx={{
                                fontSize: 12, color: 'text.secondary', mt: 0.25,
                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                            }}>
                                {text.message}
                            </Typography>
                        )}
                    </>
                }
                secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                        {n.type === 'GROUP_INVITATION' && n.actionStatus === 'PENDING' ? (
                            <>
                                <Button size="small" variant="contained" onClick={(e) => { e.stopPropagation(); handleRespondInvitation(true, n._id); }}
                                    sx={{ textTransform: 'none', fontSize: 12, borderRadius: 1, px: 1.5, mr: 0.5 }}>
                                    {t('friends.accept')}
                                </Button>
                                <Button size="small" variant="outlined" color="error" onClick={(e) => { e.stopPropagation(); handleRespondInvitation(false, n._id); }}
                                    sx={{ textTransform: 'none', fontSize: 12, borderRadius: 1, px: 1.5 }}>
                                    {t('friends.decline')}
                                </Button>
                            </>
                        ) : (
                            <Typography sx={{ fontSize: 12, color: n.status === 'UNREAD' ? 'primary.main' : 'text.secondary', fontWeight: n.status === 'UNREAD' ? 600 : 400 }}>
                                {timeAgo(new Date(n.updatedAt || n.createdAt))}
                            </Typography>
                        )}
                    </Box>
                }
            />
            {n.status === 'UNREAD' && (
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }} />
            )}
        </ListItemButton>
        );
    };

    const renderSection = (title: string, items: Notification[]) => {
        if (!items.length) return null;
        return (
            <Box>
                <Typography sx={{ px: 2, pt: 1.5, pb: 0.5, fontSize: 15, fontWeight: 700, color: 'text.primary' }}>
                    {title}
                </Typography>
                <List disablePadding>{items.map(renderItem)}</List>
            </Box>
        );
    };

    return (
        <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Box sx={{
                position: 'sticky', top: 0, zIndex: 10,
                bgcolor: 'background.paper', borderBottom: `1px solid ${theme.palette.divider}`,
                px: 2, py: 1.5,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <IconButton onClick={() => router.back()} sx={{ display: { xs: 'flex', md: 'none' } }}>
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography sx={{ fontSize: { xs: 20, sm: 24 }, fontWeight: 700 }}>
                        {t('notifications.notifications')}
                    </Typography>
                </Box>
                {unreadCount > 0 && (
                    <IconButton onClick={handleMarkAllAsRead} size="small"
                        sx={{ bgcolor: 'action.hover', width: 36, height: 36 }}>
                        <DoneAllIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                )}
            </Box>

            {/* Tabs */}
            <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}
                sx={{
                    px: 2, minHeight: 40,
                    '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 40, fontSize: 14 },
                }}>
                <Tab label={t('notifications.all')} />
                <Tab label={t('notifications.unread')} />
                <Tab label={t('notifications.invitations')} />
            </Tabs>

            {/* Content */}
            <Box ref={listRef} sx={{ flex: 1, overflow: 'auto', pb: { xs: '72px', md: 2 } }}>
                {isLoading ? (
                    <Box sx={{ p: 2 }}>
                        {[...Array(6)].map((_, i) => (
                            <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 2, px: 1 }}>
                                <Skeleton variant="circular" width={48} height={48} />
                                <Box sx={{ flex: 1 }}>
                                    <Skeleton width="80%" height={18} />
                                    <Skeleton width="60%" height={18} />
                                    <Skeleton width="30%" height={14} sx={{ mt: 0.5 }} />
                                </Box>
                            </Box>
                        ))}
                    </Box>
                ) : notifications.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
                        <Typography sx={{ fontSize: 48, mb: 1 }}>🔔</Typography>
                        <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>
                            {activeTab === 1 ? t('notifications.no_unread')
                                : activeTab === 2 ? t('notifications.no_invitations')
                                    : t('notifications.no_notifications')}
                        </Typography>
                    </Box>
                ) : (
                    <>
                        {renderSection(t('notifications.today'), today)}
                        {renderSection(t('notifications.earlier'), earlier)}
                        {isLoadingMore && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                                <CircularProgress size={24} />
                            </Box>
                        )}
                    </>
                )}
            </Box>
        </Box>
    );
}
