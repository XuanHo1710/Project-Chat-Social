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
} from '@mui/material';
import {
    Search as SearchIcon,
    MoreHoriz as MoreIcon,
    VideoCall as VideoIcon,
    Create as CreateIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { formatTime } from '@/utils/formatDate';
import { ConversationResponseData } from '@/types/conversation';
import { CLIENT_PATH } from '@/constants/paths';
import { useAuthStore } from '@/stores/useAuthStore';
import { useOnlineStatusStore } from '@/stores/useOnlineStatusStore';
import { useSocket } from '@/contexts/SocketContext';


interface ChatPopupProps {
    conversations: ConversationResponseData[];
    isLoading: boolean;
    userId?: string;
}

export default function ChatPopup({ conversations, isLoading, userId }: ChatPopupProps) {
    const router = useRouter();
    const [tabValue, setTabValue] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const { user } = useAuthStore();
    const { socketChat } = useSocket();

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

        return () => {
            socketChat.off('conversation:kicked', handleKicked);
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
            const groupName = conversation.nickname?.toLowerCase() || 'nhóm chat';
            return groupName.includes(searchQuery.toLowerCase());
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
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6" fontWeight={700} color="#050505">
                        Đoạn chat
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                            size="small"
                            sx={{
                                color: '#65676b',
                                bgcolor: '#f0f2f5',
                                '&:hover': { bgcolor: '#e4e6eb' },
                            }}
                        >
                            <MoreIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                            size="small"
                            sx={{
                                color: '#65676b',
                                bgcolor: '#f0f2f5',
                                '&:hover': { bgcolor: '#e4e6eb' },
                            }}
                        >
                            <VideoIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                            size="small"
                            sx={{
                                color: '#65676b',
                                bgcolor: '#f0f2f5',
                                '&:hover': { bgcolor: '#e4e6eb' },
                            }}
                        >
                            <CreateIcon fontSize="small" />
                        </IconButton>
                    </Box>
                </Box>

                {/* Search */}
                <TextField
                    fullWidth
                    placeholder="Tìm kiếm trên Messenger"
                    size="small"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon sx={{ color: '#65676b', fontSize: 18 }} />
                            </InputAdornment>
                        ),
                        sx: {
                            borderRadius: 5,
                            bgcolor: '#f0f2f5',
                            color: '#050505',
                            fontSize: '14px',
                            '& .MuiOutlinedInput-notchedOutline': {
                                border: 'none',
                            },
                            '&:hover': {
                                bgcolor: '#e4e6eb',
                            },
                            '&.Mui-focused': {
                                bgcolor: '#e4e6eb',
                            },
                        },
                    }}
                    inputProps={{
                        sx: {
                            py: 1,
                            '&::placeholder': {
                                color: '#65676b',
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
                    borderBottom: '1px solid #e4e6eb',
                    minHeight: 44,
                    '& .MuiTab-root': {
                        color: '#65676b',
                        fontSize: '15px',
                        fontWeight: 600,
                        textTransform: 'none',
                        minHeight: 44,
                        '&.Mui-selected': {
                            color: '#1877f2',
                        },
                    },
                    '& .MuiTabs-indicator': {
                        backgroundColor: '#1877f2',
                        height: 3,
                    },
                }}
            >
                <Tab label="Tất cả" />
                <Tab label="Chưa đọc" />
                <Tab label="Nhóm" />
            </Tabs>

            {/* Conversation List */}
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
                <List disablePadding>
                    {!isLoading &&
                        filteredConversations.map((conversation) => {
                            const isGroup = conversation.type === 'GROUP';

                            // For DIRECT: get other user info
                            // For GROUP: use group info
                            let displayName = '';
                            let displayAvatar = '';
                            let status: { isOnline: boolean; lastActive: string | undefined } = { isOnline: false, lastActive: undefined };

                            if (isGroup) {
                                displayName = conversation.nickname || 'Nhóm chat';
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
                                            bgcolor: '#f0f2f5',
                                        },
                                        '&.Mui-selected': {
                                            bgcolor: '#e7f3ff',
                                            '&:hover': {
                                                bgcolor: '#e7f3ff',
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
                                                    backgroundColor: !isGroup && status.isOnline ? '#31a24c' : 'transparent',
                                                    border: !isGroup && status.isOnline ? '2px solid white' : 'none',
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
                                                <Typography noWrap fontWeight={600} fontSize={15} color="#050505">
                                                    {displayName}
                                                </Typography>
                                                {isGroup && (
                                                    <Typography fontSize={12} color="#65676b">
                                                        ({conversation.participants.filter(p => !p.kickedAt && !p.leftAt).length})
                                                    </Typography>
                                                )}
                                            </Box>
                                        }
                                        secondaryTypographyProps={{ component: 'div' }}
                                        secondary={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Typography
                                                    noWrap
                                                    variant="body2"
                                                    color="#65676b"
                                                    component="span"
                                                    fontSize={13}
                                                    sx={{ flex: 1, maxWidth: '75%' }}
                                                >
                                                    {(() => {
                                                        const lastMsg = conversation.lastMessage;
                                                        if (!lastMsg) return 'Bắt đầu cuộc trò chuyện mới';

                                                        // Get sender prefix for group chats
                                                        const getSenderPrefix = () => {
                                                            if (!isGroup) return '';
                                                            if (lastMsg.senderId === user?.id) return 'Bạn: ';
                                                            const sender = conversation.participants.find(p => p.user._id === lastMsg.senderId)?.user;
                                                            return sender ? `${sender.firstName || ''}: ` : '';
                                                        };

                                                        const prefix = getSenderPrefix();

                                                        switch (lastMsg.type) {
                                                            case 'IMAGE':
                                                                return lastMsg.senderId === user?.id ? 'Bạn đã gửi một ảnh' : prefix + 'đã gửi một ảnh';
                                                            case 'VIDEO':
                                                                return lastMsg.senderId === user?.id ? 'Bạn đã gửi một video' : prefix + 'đã gửi một video';
                                                            case 'FILE':
                                                                return lastMsg.senderId === user?.id ? 'Bạn đã gửi một tệp' : prefix + 'đã gửi một tệp';
                                                            case 'POST':
                                                                return lastMsg.senderId === user?.id ? 'Bạn đã chia sẻ bài viết' : prefix + 'đã chia sẻ bài viết';
                                                            case 'SYSTEM':
                                                                return lastMsg.content || 'Thông báo';
                                                            default:
                                                                if (lastMsg.attachments && lastMsg.attachments.length > 0 && !lastMsg.content) {
                                                                    return lastMsg.senderId === user?.id ? 'Bạn đã gửi ảnh' : prefix + 'đã gửi ảnh';
                                                                }
                                                                return prefix + (lastMsg.content || 'Bắt đầu cuộc trò chuyện mới');
                                                        }
                                                    })()}
                                                </Typography>
                                                <Typography variant="caption" color="#65676b" fontSize={12} sx={{ whiteSpace: 'nowrap' }}>
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
                                                            backgroundColor: '#1877f2',
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
                    borderTop: '1px solid #e4e6eb',
                    textAlign: 'center',
                }}
            >
                <Typography
                    onClick={() => router.push('/chat')}
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
                    Xem tất cả trong Messenger
                </Typography>
            </Box>
        </Paper>
    );
}
