'use client';

import React, { useState, useEffect } from 'react';
import {
    Box,
    Avatar,
    Typography,
    IconButton,
    TextField,
    InputAdornment,
    List,
    ListItemButton,
    ListItemAvatar,
    ListItemText,
    Badge,
    Menu,
    MenuItem,
    Divider,
    useTheme,
} from '@mui/material';
import {
    Search as SearchIcon,
    MoreVert as MoreVertIcon,
    Logout as LogoutIcon,
    Person as PersonIcon,
    Settings as SettingsIcon,
    Edit as EditIcon,
    NotificationsOff as NotificationsOffIcon,
} from '@mui/icons-material';
import { useAuthStore } from '@/stores/useAuthStore';
import { authService } from '@/services/auth.service';
import { toast } from 'sonner';
import { formatChatTimestamp } from '@/utils/formatDate';
import { ConversationResponseData } from '@/types/conversation';
import { useRouter } from 'next/navigation';
import { CLIENT_PATH } from '@/constants/paths';
import { useOnlineStatusStore } from '@/stores/useOnlineStatusStore';
import { useSocket } from '@/contexts/SocketContext';
import { renderContentWithMentionsPlain } from '@/utils/hashtagParser';
import { useTranslation } from 'react-i18next';

interface SelectedConversation {
    _id: string;
    fullName: string;
    avatar: string;
    status: 'online' | 'offline';
    otherId: string;
    lastActive?: string;
    type?: 'DIRECT' | 'GROUP' | 'CHATBOT';
}

interface ChatSidebarProps {
    conversations: ConversationResponseData[];
    isLoading: boolean;
    selectedConversationId?: string;
    onSelectConversation: (conversation: SelectedConversation) => void;
    isMobileVisible?: boolean; // For mobile: show/hide sidebar
    onMobileClose?: () => void; // For mobile: callback to close sidebar
}

export default function ChatSidebar({
    conversations,
    isLoading,
    selectedConversationId,
    onSelectConversation,
    isMobileVisible = true,
    onMobileClose,
}: ChatSidebarProps) {
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const router = useRouter();
    const { socketChat } = useSocket();

    const hoverBg = isDark ? 'rgba(255,255,255,0.1)' : '#f0f2f5';
    const inputBg = isDark ? 'rgba(255,255,255,0.1)' : '#f0f2f5';
    const selectedBg = isDark ? 'rgba(66, 133, 244, 0.3)' : '#e7f3ff';
    const scrollbarColor = isDark ? 'rgba(255,255,255,0.3)' : '#c4c4c4';
    const { t } = useTranslation();

    // Online status store - just read, don't subscribe to socket here
    const onlineUsers = useOnlineStatusStore(state => state.onlineUsers);
    const setUserOnline = useOnlineStatusStore(state => state.setUserOnline);
    const setUserOffline = useOnlineStatusStore(state => state.setUserOffline);


    // Initialize from conversation participants (only once when conversations load)
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
            toast.error(t('chat.kicked_from_group', { name: data.kickedByName }));
            // If currently viewing the kicked conversation, navigate away
            if (selectedConversationId === data.conversationId) {
                router.push(CLIENT_PATH.CHAT);
            }
        };

        socketChat.on('conversation:kicked', handleKicked);

        return () => {
            socketChat.off('conversation:kicked', handleKicked);
        };
    }, [socketChat, selectedConversationId, router, t]);

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = async () => {
        handleMenuClose();
        const response = await authService.logout();
        if (response.statusCode === 201) {
            logout();
            toast.success(t('auth.logout_success'));
            router.push(CLIENT_PATH.LOGIN);
        } else {
            toast.error(t('auth.logout_failed'));
        }
    };

    const filteredConversations = conversations.filter((conversation) => {
        // Kiểm tra user có trong participants
        const currentParticipant = conversation.participants.find(p => p.user?._id === user?.id);
        if (!currentParticipant) return false;

        // For DIRECT chats: hide if kicked or left
        // For GROUP chats: still show even if kicked/left (so user knows they were removed)
        if (conversation.type === 'DIRECT') {
            if (currentParticipant.kickedAt || currentParticipant.leftAt) return false;
            const chatUser = conversation.participants.find((p) => p.user?._id !== user?.id)?.user;
            const nickname = conversation.participants.find((p) => p.user?._id !== user?.id)?.nickname;
            const fullName = (!nickname || nickname === "") ? `${chatUser?.firstName || ''} ${chatUser?.lastName || ''}`.toLowerCase() : nickname.toLowerCase();
            return fullName.includes(searchQuery.toLowerCase());
        } else if (conversation.type === 'GROUP') {
            // Hiển thị nhóm (kể cả đã bị kick hoặc rời)
            const groupName = conversation.nickname?.toLowerCase() || 'nhóm chat';
            return groupName.includes(searchQuery.toLowerCase());
        } else if (conversation.type === 'CHATBOT') {
            // Search logic for Chatbot
            const name = "BOT AI";
            return name.toLowerCase().includes(searchQuery.toLowerCase());
        }
        return false;
    });

    // Get real-time status for a user
    const getUserStatus = (userId: string, originalStatus?: string, originalLastActive?: string): { isOnline: boolean; lastActive: string | undefined } => {
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
        <Box
            className="chat-sidebar"
            sx={{
                width: { xs: '100vw', md: '360px' },
                minWidth: { xs: '100vw', md: '360px' },
                maxWidth: { xs: '100vw', md: '360px' },
                flexShrink: 0,
                height: '100vh',
                bgcolor: 'background.paper',
                borderRight: { xs: 'none', md: `1px solid ${theme.palette.divider}` },
                display: isMobileVisible ? 'flex' : { xs: 'none', md: 'flex' },
                flexDirection: 'column',
                position: { xs: 'fixed', md: 'relative' },
                top: 0,
                left: 0,
                zIndex: { xs: 1000, md: 'auto' },
            }}
        >
            {/* User Profile Header */}
            <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton
                            onClick={() => router.push('/')}
                            sx={{ p: 0 }}
                        >
                            <Box
                                sx={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: '50%',
                                    bgcolor: '#1877f2', // Facebook blue
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '24px',
                                    fontWeight: 'bold',
                                    color: 'white',
                                }}
                            >
                                f
                            </Box>
                        </IconButton>
                        <Typography variant="h5" fontWeight={700} color="text.primary">
                            {t('chat.chats')}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                            size="small"
                            sx={{
                                color: 'text.secondary',
                                bgcolor: hoverBg,
                            }}
                        >
                            <MoreVertIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                            size="small"
                            sx={{
                                color: 'text.secondary',
                                bgcolor: hoverBg,
                            }}
                        >
                            <EditIcon fontSize="small" />
                        </IconButton>
                    </Box>
                </Box>

                {/* User Info */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        p: 1.5,
                        borderRadius: 2,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: hoverBg },
                    }}
                    onClick={handleMenuOpen}
                >
                    <Badge
                        overlap="circular"
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        variant="dot"
                        sx={{
                            '& .MuiBadge-badge': {
                                backgroundColor: '#31a24c',
                                border: `2px solid ${theme.palette.background.paper}`,
                                width: 15,
                                borderRadius: '50%',
                                height: 15,
                            },
                        }}
                    >
                        <Avatar
                            src={user?.avatar || ''}
                            sx={{ width: 40, height: 40 }}
                        />
                    </Badge>
                    <Box sx={{ flex: 1 }}>
                        <Typography fontWeight={600} fontSize={15} color="text.primary">
                            {user?.fullName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" fontSize={13}>
                            {t('common.active')}
                        </Typography>
                    </Box>
                    <MoreVertIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                </Box>

                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleMenuClose}
                    PaperProps={{
                        sx: {
                            borderRadius: 2,
                            mt: 1,
                            minWidth: 200,
                        },
                    }}
                >
                    <MenuItem
                        onClick={handleMenuClose}
                        sx={{
                            py: 1.5,
                        }}
                    >
                        <PersonIcon sx={{ mr: 2, color: 'text.secondary' }} fontSize="small" />
                        {t('profile.profile')}
                    </MenuItem>
                    <MenuItem
                        onClick={handleMenuClose}
                        sx={{
                            py: 1.5,
                        }}
                    >
                        <SettingsIcon sx={{ mr: 2, color: 'text.secondary' }} fontSize="small" />
                        {t('common.settings')}
                    </MenuItem>
                    <Divider sx={{ my: 0.5 }} />
                    <MenuItem
                        onClick={handleLogout}
                        sx={{
                            py: 1.5,
                        }}
                    >
                        <LogoutIcon sx={{ mr: 2, color: 'text.secondary' }} fontSize="small" />
                        {t('auth.logout')}
                    </MenuItem>
                </Menu>

                {/* Search Field */}
                <TextField
                    fullWidth
                    placeholder={t('chat.search_messenger')}
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
                    sx={{ mt: 2 }}
                />
            </Box>

            {/* Conversation List */}
            <Box
                sx={{
                    flex: 1,
                    overflow: 'auto',
                    '&::-webkit-scrollbar': { width: '8px' },
                    '&::-webkit-scrollbar-thumb': {
                        backgroundColor: scrollbarColor,
                        borderRadius: '4px',
                    },
                }}
            >
                <List disablePadding>
                    {!isLoading &&
                        filteredConversations.map((conversation) => {
                            const isGroup = conversation.type === 'GROUP';
                            const isChatbot = conversation.type === 'CHATBOT';
                            const isSelected = conversation._id === selectedConversationId;

                            // For DIRECT: get other user info
                            // For GROUP: use group info
                            let displayName = '';
                            let displayAvatar = '';
                            let status: { isOnline: boolean; lastActive: string | undefined } = { isOnline: false, lastActive: undefined };
                            let otherId = '';

                            if (isChatbot) {
                                const botParticipant = conversation.participants.find(p => p.user?._id !== user?.id);
                                displayName = "BOT AI";
                                displayAvatar = botParticipant?.user?.avatar || "https://cdn-icons-png.flaticon.com/512/4712/4712027.png";
                                // Bot always online
                                status = { isOnline: true, lastActive: undefined };
                                otherId = botParticipant?.user?._id || '';
                            } else if (isGroup) {
                                displayName = conversation.nickname || t('chat.group_chat');
                                displayAvatar = conversation.avatar || ``;
                                // Groups don't have online status
                            } else {
                                const otherParticipant = conversation.participants.find((p) => p.user?._id !== user?.id);
                                const chatUser = otherParticipant?.user;
                                const nickname = otherParticipant?.nickname;
                                displayName = (!nickname || nickname === "") ? `${chatUser?.firstName || ''} ${chatUser?.lastName || ''}` : nickname;
                                displayAvatar = chatUser?.avatar || "";
                                status = chatUser?._id ? getUserStatus(chatUser._id, chatUser.status, chatUser.lastActive) : { isOnline: false, lastActive: undefined };
                                otherId = chatUser?._id || '';
                            }

                            return (
                                <ListItemButton
                                    key={conversation._id}
                                    selected={isSelected}
                                    onClick={() => {
                                        onSelectConversation({
                                            _id: conversation._id,
                                            fullName: displayName,
                                            avatar: displayAvatar,
                                            status: status.isOnline ? 'online' : 'offline',
                                            otherId,
                                            lastActive: status.lastActive,
                                            type: conversation.type,
                                        });
                                        // Close sidebar on mobile after selection
                                        if (onMobileClose) {
                                            onMobileClose();
                                        }
                                    }}
                                    sx={{
                                        py: 1.5,
                                        px: 2,
                                        gap: 1,
                                        bgcolor: isSelected ? selectedBg : 'transparent',
                                        '&:hover': {
                                            bgcolor: isSelected ? selectedBg : hoverBg,
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
                                                src={displayAvatar}
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
                                                        if (!lastMsg) return t('chat.start_new_conversation');

                                                        // Get sender name for group chats
                                                        const getSenderPrefix = () => {
                                                            if (!isGroup) return '';
                                                            if (lastMsg.senderId === user?.id) return t('common.you') + ': ';
                                                            const sender = conversation.participants.find(p => p.user._id === lastMsg.senderId)?.user;
                                                            return sender ? `${sender.firstName || ''}: ` : '';
                                                        };

                                                        const prefix = getSenderPrefix();

                                                        switch (lastMsg.type) {
                                                            case 'IMAGE':
                                                                return lastMsg.senderId === user?.id ? t('chat.you_sent_image') : prefix + t('chat.sent_image');
                                                            case 'VIDEO':
                                                                return lastMsg.senderId === user?.id ? t('chat.you_sent_video') : prefix + t('chat.sent_video');
                                                            case 'FILE':
                                                                return lastMsg.senderId === user?.id ? t('chat.you_sent_file') : prefix + t('chat.sent_file');
                                                            case 'POST':
                                                                return lastMsg.senderId === user?.id ? t('chat.you_shared_post') : prefix + t('chat.shared_post');
                                                            case 'SYSTEM':
                                                                return lastMsg.content || t('chat.notification');
                                                            case "CHATBOT":
                                                                return "AI Assistant: " + (lastMsg.content || t('chat.message_from_chatbot'));
                                                            default:
                                                                if (lastMsg.attachments && lastMsg.attachments.length > 0 && !lastMsg.content) {
                                                                    return lastMsg.senderId === user?.id ? t('chat.you_sent_image') : prefix + t('chat.sent_image');
                                                                }
                                                                return prefix + (renderContentWithMentionsPlain(lastMsg.content) || t('chat.start_new_conversation'));
                                                        }
                                                    })()}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary" fontSize={12} sx={{ whiteSpace: 'nowrap' }}>
                                                    · {conversation.lastMessageAt ? formatChatTimestamp(conversation.lastMessageAt) : ''}
                                                </Typography>
                                            </Box>
                                        }
                                    />
                                    {/* Unread Count Badge */}
                                    {(() => {
                                        const unreadCount = conversation.unreadCount?.[user?.id || ''] || 0;
                                        if (unreadCount > 0 && !isSelected) {
                                            return (
                                                <Badge
                                                    badgeContent={unreadCount > 9 ? '9+' : unreadCount}
                                                    sx={{
                                                        '& .MuiBadge-badge': {
                                                            backgroundColor: conversation.mutedBy?.includes(user?.id || '') ? '#76797dff' : '#1877f2',
                                                            color: 'white',
                                                            fontSize: 12,
                                                            fontWeight: 700,
                                                            width: 20,
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
        </Box>
    );
}
