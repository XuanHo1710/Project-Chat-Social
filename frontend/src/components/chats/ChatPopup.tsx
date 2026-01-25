'use client';

import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    IconButton,
    TextField,
    InputAdornment,
    List,
    ListItemButton,
    ListItemAvatar,
    Avatar,
    ListItemText,
    Badge,
    Tabs,
    Tab,
    Skeleton,
    useTheme,
} from '@mui/material';
import {
    Search as SearchIcon,
    MoreHoriz as MoreIcon,
    VideoCall as VideoIcon,
    Create as CreateIcon,
    NotificationsOff as NotificationsOffIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { formatTime } from '@/utils/formatDate';
import { ConversationResponseData } from '@/types/conversation';
import { CLIENT_PATH } from '@/constants/paths';
import { useAuthStore } from '@/stores/useAuthStore';
import { useOnlineStatusStore } from '@/stores/useOnlineStatusStore';
import { useSocket } from '@/contexts/SocketContext';
import { renderContentWithMentionsPlain } from '@/utils/hashtagParser';
import { useTranslation } from 'react-i18next';


interface ChatPopupProps {
    conversations: ConversationResponseData[];
    isLoading: boolean;
    userId?: string;
}

export default function ChatPopup({ conversations, isLoading, userId }: ChatPopupProps) {
    const router = useRouter();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const { t } = useTranslation();
    const [tabValue, setTabValue] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const { user } = useAuthStore();
    const { socketChat } = useSocket();

    const hoverBg = isDark ? 'rgba(255,255,255,0.1)' : '#f0f2f5';
    const inputBg = isDark ? 'rgba(255,255,255,0.1)' : '#f0f2f5';
    const selectedBg = isDark ? 'rgba(66, 133, 244, 0.3)' : '#e7f3ff';

    const onlineUsers = useOnlineStatusStore(state => state.onlineUsers);
    const setUserOnline = useOnlineStatusStore(state => state.setUserOnline);
    const setUserOffline = useOnlineStatusStore(state => state.setUserOffline);

    // Initialize online status from conversation participants (sync with ChatSidebar)
    useEffect(() => {
        conversations.forEach(conv => {
            conv.participants.forEach(p => {
                // Skip if user is not populated or is current user
                if (!p.user || !p.user._id || p.user._id === user?.id) return;

                const existing = useOnlineStatusStore.getState().onlineUsers[p.user._id];
                if (!existing) {
                    if (p.user.status === 'ACTIVE') {
                        setUserOnline(p.user._id);
                    } else if (p.user.status === 'HIDDEN') {
                        // User has hidden activity status - show as offline without lastActive
                        setUserOffline(p.user._id, undefined);
                    } else if (p.user.lastActive) {
                        setUserOffline(p.user._id, p.user.lastActive);
                    }
                }
            });
        });
    }, [conversations, user?.id, setUserOnline, setUserOffline]);

    // Listen for kicked event
    useEffect(() => {
        if (!socketChat) return;

        const handleKicked = (data: { conversationId: string; kickedByName: string }) => {
            // Toast notification will be shown - conversations will be refetched by parent
            console.log('You were kicked from conversation:', data.conversationId);
        };

        socketChat.on('conversation:kicked', handleKicked);

        // Listen for mute toggle updates to refresh conversation list
        const handleMuteUpdated = (data: { conversationId: string; isMuted: boolean }) => {
            console.log('🔔 Mute status updated:', data);
            // Force re-render by updating conversation data
            // Since conversations prop comes from parent, parent should handle refetch
            // But we can trigger a visual update by listening to this event
        };
        socketChat.on('conversation:mute:updated', handleMuteUpdated);

        return () => {
            socketChat.off('conversation:kicked', handleKicked);
            socketChat.off('conversation:mute:updated', handleMuteUpdated);
        };
    }, [socketChat]);

    const handleConversationClick = (conversationId: string) => {
        router.push(CLIENT_PATH.CHAT_BY_ID(conversationId));
    };

    // Filter conversations (sync logic with ChatSidebar)
    const filteredConversations = conversations.filter((conversation) => {
        // Check if user is in participants
        const currentParticipant = conversation.participants.find(p => p.user?._id === user?.id);
        if (!currentParticipant) return false;

        // For DIRECT chats: hide if kicked or left
        // For GROUP chats: still show even if kicked/left (so user knows they were removed)
        if (conversation.type === 'DIRECT') {
            if (currentParticipant.kickedAt || currentParticipant.leftAt) return false;
        }
        // GROUP chats are shown even if kicked/left

        // Filter by tab
        if (tabValue === 1) {
            // Unread tab - only show conversations with unread messages
            const unreadCount = conversation.unreadCount?.[user?.id || ''] || 0;
            if (unreadCount === 0) return false;
        } else if (tabValue === 2) {
            // Groups tab
            if (conversation.type !== 'GROUP') return false;
        }

        // Filter by search query
        if (conversation.type === 'DIRECT') {
            const chatUser = conversation.participants.find((p) => p.user?._id !== user?.id)?.user;
            const nickname = conversation.participants.find((p) => p.user?._id !== user?.id)?.nickname;
            const fullName = (!nickname || nickname === "")
                ? `${chatUser?.firstName || ''} ${chatUser?.lastName || ''}`.toLowerCase()
                : nickname.toLowerCase();
            return fullName.includes(searchQuery.toLowerCase());
        } else if (conversation.type === 'GROUP') {
            const groupName = conversation.nickname?.toLowerCase() || (t('messenger_popup.groups') || 'nhóm chat');
            return groupName.includes(searchQuery.toLowerCase());
        } else if (conversation.type === 'CHATBOT') {
            return "BOT AI".toLowerCase().includes(searchQuery.toLowerCase());
        }
        return false;
    });

    const getUserStatus = (userId: string, originalStatus?: string, originalLastActive?: string) => {
        const storeStatus = onlineUsers[userId];
        if (storeStatus) {
            return {
                isOnline: storeStatus.isOnline,
                lastActive: typeof storeStatus.lastActive === 'string' ? storeStatus.lastActive : storeStatus.lastActive?.toISOString()
            };
        }
        // Handle HIDDEN status - show as offline without lastActive
        if (originalStatus === 'HIDDEN') {
            return {
                isOnline: false,
                lastActive: undefined
            };
        }
        return {
            isOnline: originalStatus === 'ACTIVE',
            lastActive: originalLastActive
        };
    };

    return (
        <Paper
            elevation={8}
            sx={{
                position: 'absolute',
                top: 56,
                right: 0,
                width: 360,
                height: 500,
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                zIndex: 1300,
            }}
        >
            {/* Header */}
            <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6" fontWeight={700} color="text.primary">
                        {t('messenger_popup.header')}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                            size="small"
                            sx={{
                                color: 'text.secondary',
                                bgcolor: hoverBg,
                            }}
                        >
                            <MoreIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                            size="small"
                            sx={{
                                color: 'text.secondary',
                                bgcolor: hoverBg,
                            }}
                        >
                            <VideoIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                            size="small"
                            sx={{
                                color: 'text.secondary',
                                bgcolor: hoverBg,
                            }}
                        >
                            <CreateIcon fontSize="small" />
                        </IconButton>
                    </Box>
                </Box>

                {/* Search */}
                <TextField
                    fullWidth
                    placeholder={t('messenger_popup.search_placeholder')}
                    size="small"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                            </InputAdornment>
                        ),
                        sx: {
                            borderRadius: 5,
                            bgcolor: inputBg,
                            color: 'text.primary',
                            fontSize: '14px',
                            '& .MuiOutlinedInput-notchedOutline': {
                                border: 'none',
                            },
                        },
                    }}
                    inputProps={{
                        sx: {
                            py: 1,
                            '&::placeholder': {
                                color: 'text.secondary',
                                opacity: 1,
                            },
                        },
                    }}
                />
            </Box>

            {/* Tabs */}
            <Tabs
                value={tabValue}
                onChange={(e, newValue) => setTabValue(newValue)}
                sx={{
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    minHeight: 44,
                    '& .MuiTab-root': {
                        color: 'text.secondary',
                        fontSize: '15px',
                        fontWeight: 600,
                        textTransform: 'none',
                        minHeight: 44,
                        '&.Mui-selected': {
                            color: 'primary.main',
                        },
                    },
                    '& .MuiTabs-indicator': {
                        backgroundColor: theme.palette.primary.main,
                        height: 3,
                    },
                }}
            >
                <Tab label={t('messenger_popup.all')} />
                <Tab label={t('messenger_popup.unread')} />
                <Tab label={t('messenger_popup.groups')} />
            </Tabs>

            {/* Conversation List */}
            <Box
                sx={{
                    flex: 1,
                    overflow: 'auto',
                    '&::-webkit-scrollbar': { width: '8px' },
                    '&::-webkit-scrollbar-thumb': {
                        backgroundColor: isDark ? '#555' : '#c4c4c4',
                        borderRadius: '4px',
                    },
                }}
            >
                {/* Skeleton Loading */}
                {isLoading && (
                    <List disablePadding>
                        {[1, 2, 3, 4, 5].map((item) => (
                            <Box
                                key={item}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5,
                                    py: 1.5,
                                    px: 2,
                                }}
                            >
                                <Skeleton
                                    variant="circular"
                                    width={56}
                                    height={56}
                                    animation="wave"
                                />
                                <Box sx={{ flex: 1 }}>
                                    <Skeleton
                                        variant="text"
                                        width="70%"
                                        height={20}
                                        animation="wave"
                                    />
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Skeleton
                                            variant="text"
                                            width="50%"
                                            height={16}
                                            animation="wave"
                                        />
                                        <Skeleton
                                            variant="text"
                                            width="20%"
                                            height={16}
                                            animation="wave"
                                        />
                                    </Box>
                                </Box>
                            </Box>
                        ))}
                    </List>
                )}

                {/* Empty State */}
                {!isLoading && filteredConversations.length === 0 && (
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            py: 4,
                            px: 2,
                        }}
                    >
                        <Typography
                            sx={{
                                fontSize: 15,
                                color: 'text.secondary',
                                textAlign: 'center',
                            }}
                        >
                            {searchQuery
                                ? t('messenger_popup.no_conversations')
                                : tabValue === 1
                                    ? t('messenger_popup.no_unread')
                                    : tabValue === 2
                                        ? t('messenger_popup.no_groups')
                                        : t('messenger_popup.start_new')}
                        </Typography>
                    </Box>
                )}

                {/* Conversation List */}
                <List disablePadding>
                    {!isLoading &&
                        filteredConversations.map((conversation) => {
                            const isGroup = conversation.type === 'GROUP';
                            const isChatbot = conversation.type === 'CHATBOT';

                            // For DIRECT: get other user info
                            // For GROUP: use group info
                            let displayName = '';
                            let displayAvatar = '';
                            let status: { isOnline: boolean; lastActive: string | undefined } = { isOnline: false, lastActive: undefined };

                            if (isChatbot) {
                                const botParticipant = conversation.participants.find(p => p.user?._id !== user?.id);
                                displayName = "BOT AI";
                                displayAvatar = botParticipant?.user?.avatar || "https://cdn-icons-png.flaticon.com/512/4712/4712027.png";
                                // Bot always online
                                status = { isOnline: true, lastActive: undefined };
                            } else if (isGroup) {
                                displayName = conversation.nickname || (t('messenger_popup.groups') || 'Nhóm chat');
                                displayAvatar = conversation.avatar || '';
                                // Groups don't have online status
                            } else {
                                const otherParticipant = conversation.participants.find((p) => p.user?._id !== user?.id);
                                const chatUser = otherParticipant?.user;
                                const nickname = otherParticipant?.nickname;
                                displayName = (!nickname || nickname === "") ? `${chatUser?.firstName || ''} ${chatUser?.lastName || ''}` : nickname;
                                displayAvatar = chatUser?.avatar || '';
                                status = chatUser?._id ? getUserStatus(chatUser._id, chatUser.status, chatUser.lastActive) : { isOnline: false, lastActive: undefined };
                            }

                            return (
                                <ListItemButton
                                    key={conversation._id}
                                    onClick={() => {
                                        handleConversationClick(conversation._id);
                                    }}
                                    sx={{
                                        py: 1.5,
                                        px: 2,
                                        gap: 1,
                                        bgcolor: 'transparent',
                                        '&:hover': {
                                            bgcolor: hoverBg,
                                        },
                                        '&.Mui-selected': {
                                            bgcolor: selectedBg,
                                            '&:hover': {
                                                bgcolor: selectedBg,
                                            },
                                        },
                                    }}
                                >
                                    <ListItemAvatar>
                                        <Badge
                                            overlap="circular"
                                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                            variant="dot"
                                            sx={{
                                                '& .MuiBadge-badge': {
                                                    backgroundColor: (!isGroup && status.isOnline) || isChatbot ? '#31a24c' : 'transparent',
                                                    border: (!isGroup && status.isOnline) || isChatbot ? `2px solid ${theme.palette.background.paper}` : 'none',
                                                    width: 15,
                                                    borderRadius: '50%',
                                                    height: 15,
                                                },
                                            }}
                                        >
                                            <Avatar
                                                src={displayAvatar || `https://ui-avatars.com/api/?name=${displayName?.[0] || 'U'}&background=1877f2&color=fff`}
                                                sx={{ width: 56, height: 56 }}
                                            />
                                        </Badge>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Typography noWrap fontWeight={600} fontSize={15} color="text.primary">
                                                    {displayName}
                                                </Typography>
                                                {/* Mute bell icon when user has muted this conversation */}
                                                {conversation.mutedBy?.includes(user?.id || '') && (
                                                    <NotificationsOffIcon
                                                        sx={{
                                                            fontSize: 16,
                                                            color: 'text.secondary',
                                                            opacity: 0.7,
                                                            ml: 0.5
                                                        }}
                                                    />
                                                )}
                                            </Box>
                                        }
                                        secondaryTypographyProps={{ component: 'div' }}
                                        secondary={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Typography
                                                    noWrap
                                                    variant="body2"
                                                    color="text.secondary"
                                                    component="span"
                                                    fontSize={13}
                                                    sx={{ flex: 1, maxWidth: '75%' }}
                                                >
                                                    {(() => {
                                                        const lastMsg = conversation.lastMessage;
                                                        if (!lastMsg) return t('messenger_popup.start_new');

                                                        // Get sender prefix for group chats
                                                        const getSenderPrefix = () => {
                                                            if (!isGroup) return '';
                                                            if (lastMsg.senderId === user?.id) return `${t('messenger_popup.you')}: `;
                                                            const sender = conversation.participants.find(p => p.user._id === lastMsg.senderId)?.user;
                                                            return sender ? `${sender.firstName || ''}: ` : '';
                                                        };

                                                        const prefix = getSenderPrefix();

                                                        switch (lastMsg.type) {
                                                            case 'IMAGE':
                                                                return lastMsg.senderId === user?.id ? `${t('messenger_popup.you')} ${t('messenger_popup.sent_image')}` : prefix + t('messenger_popup.sent_image');
                                                            case 'VIDEO':
                                                                return lastMsg.senderId === user?.id ? `${t('messenger_popup.you')} ${t('messenger_popup.sent_video')}` : prefix + t('messenger_popup.sent_video');
                                                            case 'FILE':
                                                                return lastMsg.senderId === user?.id ? `${t('messenger_popup.you')} ${t('messenger_popup.sent_file')}` : prefix + t('messenger_popup.sent_file');
                                                            case 'POST':
                                                                return lastMsg.senderId === user?.id ? `${t('messenger_popup.you')} ${t('messenger_popup.shared_post')}` : prefix + t('messenger_popup.shared_post');
                                                            case 'SYSTEM':
                                                                return lastMsg.content || t('messenger_popup.system_notification');
                                                            case "CHATBOT":
                                                                return t('messenger_popup.ai_message') + (lastMsg.content || t('messenger_popup.start_new'));
                                                            default:
                                                                if (lastMsg.attachments && lastMsg.attachments.length > 0 && !lastMsg.content) {
                                                                    return lastMsg.senderId === user?.id ? `${t('messenger_popup.you')} ${t('messenger_popup.sent_image')}` : prefix + t('messenger_popup.sent_image');
                                                                }
                                                                return prefix + (renderContentWithMentionsPlain(lastMsg.content) || t('messenger_popup.start_new'));
                                                        }
                                                    })()}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary" fontSize={12} sx={{ whiteSpace: 'nowrap' }}>
                                                    · {conversation.lastMessageAt ? formatTime(conversation.lastMessageAt) : ''}
                                                </Typography>
                                            </Box>
                                        }
                                    />
                                    {/* Unread Count Badge */}
                                    {(() => {
                                        const unreadCount = conversation.unreadCount?.[user?.id || ''] || 0;
                                        if (unreadCount > 0) {
                                            return (
                                                <Badge
                                                    badgeContent={unreadCount > 9 ? '9+' : unreadCount}
                                                    sx={{
                                                        '& .MuiBadge-badge': {
                                                            backgroundColor: conversation.mutedBy?.includes(user?.id || '') ? '#76797dff' : '#1877f2',
                                                            color: 'white',
                                                            fontSize: 11,
                                                            fontWeight: 700,
                                                            minWidth: 20,
                                                            height: 20,
                                                            borderRadius: '10px',
                                                        },
                                                    }}
                                                />
                                            );
                                        }
                                        return null;
                                    })()}
                                </ListItemButton>
                            );
                        })}
                </List>
            </Box>

            {/* Footer */}
            <Box
                sx={{
                    p: 1.5,
                    borderTop: `1px solid ${theme.palette.divider}`,
                    textAlign: 'center',
                }}
            >
                <Typography
                    onClick={() => router.push('/chat')}
                    sx={{
                        color: 'primary.main',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        '&:hover': {
                            textDecoration: 'underline',
                        },
                    }}
                >
                    {t('messenger_popup.view_all')}
                </Typography>
            </Box>
        </Paper>
    );
}
