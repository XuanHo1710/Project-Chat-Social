'use client';

import { useState, useEffect } from 'react';
import { AppBar, Toolbar, Box, InputBase, IconButton, Avatar, Badge, ClickAwayListener, Tooltip, Typography } from '@mui/material';
import {
    Search as SearchIcon,
    Home as HomeIcon,
    HomeOutlined as HomeOutlinedIcon,
    People as PeopleIcon,
    PeopleOutline as PeopleOutlinedIcon,
    OndemandVideo as OndemandVideoIcon,
    OndemandVideoOutlined as OndemandVideoOutlinedIcon,
    Groups as GroupsIcon,
    GroupsOutlined as GroupsOutlinedIcon,
    SportsEsports as GamesIcon,
    SportsEsportsOutlined as GamesOutlinedIcon,
    Apps as AppsIcon,
    Message as MessageIcon,
    Notifications as NotificationsIcon
} from '@mui/icons-material';
import Link from 'next/link';
import { useAuthStore } from '@/stores/useAuthStore';
import { useConversationByUserId } from '@/queries/useConversationQueries';

import AvatarMenu from '../AvatarMenu';
import ChatPopup from '@/components/chats/ChatPopup';
import NotificationPopup from '@/components/NotificationPopup';
import { usePathname } from 'next/navigation';
import { useSocket } from '@/contexts/SocketContext';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/query-keys';
import { ConversationResponseData } from '@/types/conversation';
import { MessageResponse } from '@/types/chat';

export default function Header() {
    const { user } = useAuthStore();
    const pathname = usePathname();
    const [showChatPopup, setShowChatPopup] = useState(false);
    const [showNotificationPopup, setShowNotificationPopup] = useState(false);
    const [showAvatarMenu, setShowAvatarMenu] = useState(false);
    const [chatUnreadCount, setChatUnreadCount] = useState(0);
    const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
    const { socketChat } = useSocket();
    const queryClient = useQueryClient();

    // Lazy load - only fetch conversations when popup is opened
    const { data: listConversation, isLoading: isLoadingConversations, refetch: refetchConversations } = useConversationByUserId(
        showChatPopup ? (user?.id || "") : "" // Only fetch when popup is open
    );

    // Calculate total unread count from conversations
    useEffect(() => {
        if (listConversation?.data && user?.id) {
            const totalUnread = listConversation.data.reduce((acc, conv) => {
                return acc + (conv.unreadCount?.[user.id] || 0);
            }, 0);
            setChatUnreadCount(totalUnread);
        }
    }, [listConversation, user?.id]);

    // Real-time updates for conversations and unread count
    useEffect(() => {
        if (!socketChat || !user?.id) return;

        // Update unread count when new message arrives
        const handleGlobalMessageNew = (msg: MessageResponse) => {
            // Increment unread count if message is not from current user
            const senderId = typeof msg.senderId === 'object' ? msg.senderId._id : msg.senderId;
            if (senderId !== user.id) {
                setChatUnreadCount(prev => prev + 1);
            }

            // Update conversation data if popup is open
            queryClient.setQueryData<{ data: ConversationResponseData[] }>(
                [QUERY_KEYS.CONVERSATION_BY_USER, user.id],
                (oldData) => {
                    if (!oldData?.data) return oldData;

                    return {
                        ...oldData,
                        data: oldData.data.map(conv => {
                            if (conv._id === msg.conversationId) {
                                // Update unread count for this conversation
                                const newUnreadCount = { ...conv.unreadCount };
                                if (senderId !== user.id) {
                                    newUnreadCount[user.id] = (newUnreadCount[user.id] || 0) + 1;
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
        };

        // Handle unread count update from server
        const handleUnreadCountUpdate = (data: { conversationId: string; unreadCount: Record<string, number> }) => {
            const myUnread = data.unreadCount?.[user.id] || 0;
            // Recalculate total unread
            queryClient.setQueryData<{ data: ConversationResponseData[] }>(
                [QUERY_KEYS.CONVERSATION_BY_USER, user.id],
                (oldData) => {
                    if (!oldData?.data) return oldData;

                    const updatedData = oldData.data.map(conv => {
                        if (conv._id === data.conversationId) {
                            return { ...conv, unreadCount: data.unreadCount };
                        }
                        return conv;
                    });

                    // Recalculate total
                    const totalUnread = updatedData.reduce((acc, conv) => {
                        return acc + (conv.unreadCount?.[user.id] || 0);
                    }, 0);
                    setChatUnreadCount(totalUnread);

                    return { ...oldData, data: updatedData };
                }
            );
        };

        // Handle message read - decrease unread count
        const handleMessageRead = (data: { conversationId: string; userId: string }) => {
            if (data.userId === user.id) {
                queryClient.setQueryData<{ data: ConversationResponseData[] }>(
                    [QUERY_KEYS.CONVERSATION_BY_USER, user.id],
                    (oldData) => {
                        if (!oldData?.data) return oldData;

                        const updatedData = oldData.data.map(conv => {
                            if (conv._id === data.conversationId) {
                                return {
                                    ...conv,
                                    unreadCount: { ...conv.unreadCount, [user.id]: 0 }
                                };
                            }
                            return conv;
                        });

                        // Recalculate total
                        const totalUnread = updatedData.reduce((acc, conv) => {
                            return acc + (conv.unreadCount?.[user.id] || 0);
                        }, 0);
                        setChatUnreadCount(totalUnread);

                        return { ...oldData, data: updatedData };
                    }
                );
            }
        };

        socketChat.on("message:new", handleGlobalMessageNew);
        socketChat.on("conversation:unread:update", handleUnreadCountUpdate);
        socketChat.on("message:read", handleMessageRead);

        // Listen for conversation updates to refresh list
        const handleConversationUpdate = () => {
            if (showChatPopup) {
                queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATION_BY_USER, user.id] });
            }
        };

        socketChat.on("conversation:member:added", handleConversationUpdate);
        socketChat.on("conversation:member:removed", handleConversationUpdate);
        socketChat.on("conversation:member:left", handleConversationUpdate);
        socketChat.on("conversation:kicked", handleConversationUpdate);
        socketChat.on("conversation:avatar:updated", handleConversationUpdate);
        socketChat.on("conversation:name:updated", handleConversationUpdate);
        socketChat.on("conversation:nickname:updated", handleConversationUpdate);
        socketChat.on("conversation:settings:updated", handleConversationUpdate);
        socketChat.on("conversation:created", handleConversationUpdate);

        return () => {
            socketChat.off("message:new", handleGlobalMessageNew);
            socketChat.off("conversation:unread:update", handleUnreadCountUpdate);
            socketChat.off("message:read", handleMessageRead);
            socketChat.off("conversation:member:added", handleConversationUpdate);
            socketChat.off("conversation:member:removed", handleConversationUpdate);
            socketChat.off("conversation:member:left", handleConversationUpdate);
            socketChat.off("conversation:kicked", handleConversationUpdate);
            socketChat.off("conversation:avatar:updated", handleConversationUpdate);
            socketChat.off("conversation:name:updated", handleConversationUpdate);
            socketChat.off("conversation:nickname:updated", handleConversationUpdate);
            socketChat.off("conversation:settings:updated", handleConversationUpdate);
            socketChat.off("conversation:created", handleConversationUpdate);
        };
    }, [socketChat, user?.id, queryClient, showChatPopup]);

    // Fetch conversations when popup opens
    useEffect(() => {
        if (showChatPopup && user?.id) {
            refetchConversations();
        }
    }, [showChatPopup, user?.id, refetchConversations]);

    return (
        <AppBar
            position="fixed"
            sx={{
                bgcolor: 'white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                borderBottom: '1px solid #e4e6eb'
            }}
        >
            <Toolbar sx={{ justifyContent: 'space-between', py: 0.5 }}>
                {/* Left Section - Logo & Search */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                    <Link href="/" style={{ textDecoration: 'none' }}>
                        <Box
                            sx={{
                                width: 40,
                                height: 40,
                                borderRadius: '50%',
                                bgcolor: '#1877f2',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '24px',
                                fontWeight: 'bold',
                                color: 'white',
                                cursor: 'pointer',
                                '&:hover': {
                                    opacity: 0.9
                                }
                            }}
                        >
                            f
                        </Box>
                    </Link>

                    <Link href="/search" style={{ textDecoration: 'none' }}>
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                bgcolor: '#f0f2f5',
                                borderRadius: '50px',
                                px: 2,
                                py: 1,
                                maxWidth: 240,
                                width: '100%',
                                cursor: 'pointer',
                                '&:hover': { bgcolor: '#e4e6eb' }
                            }}
                        >
                            <SearchIcon sx={{ color: '#65676b', mr: 1 }} />
                            <Typography
                                sx={{
                                    color: '#65676b',
                                    fontSize: 15
                                }}
                            >
                                Tìm kiếm trên Facebook
                            </Typography>
                        </Box>
                    </Link>
                </Box>

                {/* Center Section - Navigation */}
                <Box
                    sx={{
                        display: { xs: 'none', md: 'flex' },
                        gap: 1,
                        flex: 2,
                        justifyContent: 'center'
                    }}
                >
                    <Tooltip title="Trang chủ" arrow placement="bottom">
                        <Link href="/" style={{ textDecoration: 'none' }}>
                            <IconButton
                                sx={{
                                    px: 4,
                                    py: 1.5,
                                    borderRadius: pathname === '/' ? 0 : 2,
                                    borderBottom: pathname === '/' ? '3px solid #1877f2' : 'none',
                                    color: pathname === '/' ? '#1877f2' : '#65676b',
                                    '&:hover': { bgcolor: '#f0f2f5' }
                                }}
                            >
                                {pathname === '/' ? <HomeIcon sx={{ fontSize: 28 }} /> : <HomeOutlinedIcon sx={{ fontSize: 28 }} />}
                            </IconButton>
                        </Link>
                    </Tooltip>
                    <Tooltip title="Bạn bè" arrow placement="bottom">
                        <Link href="/friends" style={{ textDecoration: 'none' }}>
                            <IconButton
                                sx={{
                                    px: 4,
                                    py: 1.5,
                                    borderRadius: pathname === '/friends' ? 0 : 2,
                                    borderBottom: pathname === '/friends' ? '3px solid #1877f2' : 'none',
                                    color: pathname === '/friends' ? '#1877f2' : '#65676b',
                                    '&:hover': { bgcolor: '#f0f2f5' }
                                }}
                            >
                                {pathname === '/friends' ? <PeopleIcon sx={{ fontSize: 28 }} /> : <PeopleOutlinedIcon sx={{ fontSize: 28 }} />}
                            </IconButton>
                        </Link>
                    </Tooltip>
                    <Tooltip title="Thước phim" arrow placement="bottom">
                        <Link href="/reels" style={{ textDecoration: 'none' }}>
                            <IconButton
                                sx={{
                                    px: 4,
                                    py: 1.5,
                                    borderRadius: pathname === '/reels' ? 0 : 2,
                                    borderBottom: pathname === '/reels' ? '3px solid #1877f2' : 'none',
                                    color: pathname === '/reels' ? '#1877f2' : '#65676b',
                                    '&:hover': { bgcolor: '#f0f2f5' }
                                }}
                            >
                                {pathname === '/reels' ? <OndemandVideoIcon sx={{ fontSize: 28 }} /> : <OndemandVideoOutlinedIcon sx={{ fontSize: 28 }} />}
                            </IconButton>
                        </Link>
                    </Tooltip>
                    <Tooltip title="Nhóm" arrow placement="bottom">
                        <Link href="/groups" style={{ textDecoration: 'none' }}>
                            <IconButton
                                sx={{
                                    px: 4,
                                    py: 1.5,
                                    borderRadius: pathname?.startsWith('/groups') ? 0 : 2,
                                    borderBottom: pathname?.startsWith('/groups') ? '3px solid #1877f2' : 'none',
                                    color: pathname?.startsWith('/groups') ? '#1877f2' : '#65676b',
                                    '&:hover': { bgcolor: '#f0f2f5' }
                                }}
                            >
                                {pathname?.startsWith('/groups') ? <GroupsIcon sx={{ fontSize: 28 }} /> : <GroupsOutlinedIcon sx={{ fontSize: 28 }} />}
                            </IconButton>
                        </Link>
                    </Tooltip>
                    <Tooltip title="Trò chơi" arrow placement="bottom">
                        <Link href="/games" style={{ textDecoration: 'none' }}>
                            <IconButton
                                sx={{
                                    px: 4,
                                    py: 1.5,
                                    borderRadius: pathname === '/games' ? 0 : 2,
                                    borderBottom: pathname === '/games' ? '3px solid #1877f2' : 'none',
                                    color: pathname === '/games' ? '#1877f2' : '#65676b',
                                    '&:hover': { bgcolor: '#f0f2f5' }
                                }}
                            >
                                {pathname === '/games' ? <GamesIcon sx={{ fontSize: 28 }} /> : <GamesOutlinedIcon sx={{ fontSize: 28 }} />}
                            </IconButton>
                        </Link>
                    </Tooltip>
                </Box>

                {/* Right Section - Icons & Avatar */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        flex: 1,
                        justifyContent: 'flex-end',
                        position: 'relative'
                    }}
                >
                    <IconButton
                        sx={{
                            bgcolor: '#e4e6eb',
                            width: 40,
                            height: 40,
                            '&:hover': { bgcolor: '#d8dadf' }
                        }}
                    >
                        <AppsIcon sx={{ color: '#050505' }} />
                    </IconButton>

                    <Box sx={{ position: 'relative' }}>
                        <IconButton
                            onClick={() => {
                                setShowChatPopup(!showChatPopup);
                                setShowNotificationPopup(false);
                            }}
                            sx={{
                                bgcolor: showChatPopup ? '#d8dadf' : '#e4e6eb',
                                width: 40,
                                height: 40,
                                '&:hover': { bgcolor: '#d8dadf' }
                            }}
                        >
                            <Badge badgeContent={chatUnreadCount > 0 ? chatUnreadCount : undefined} color="error">
                                <MessageIcon sx={{ color: '#050505' }} />
                            </Badge>
                        </IconButton>

                        {showChatPopup && (
                            <ClickAwayListener onClickAway={() => setShowChatPopup(false)}>
                                <Box>
                                    <ChatPopup
                                        conversations={listConversation?.data || []}
                                        isLoading={isLoadingConversations}
                                        userId={user?.id}
                                    />
                                </Box>
                            </ClickAwayListener>
                        )}
                    </Box>

                    <Box sx={{ position: 'relative' }}>
                        <IconButton
                            onClick={() => {
                                setShowNotificationPopup(!showNotificationPopup);
                                setShowChatPopup(false);
                            }}
                            sx={{
                                bgcolor: showNotificationPopup ? '#d8dadf' : '#e4e6eb',
                                width: 40,
                                height: 40,
                                '&:hover': { bgcolor: '#d8dadf' }
                            }}
                        >
                            <Badge badgeContent={notificationUnreadCount > 0 ? notificationUnreadCount : undefined} color="error">
                                <NotificationsIcon sx={{ color: '#050505' }} />
                            </Badge>
                        </IconButton>

                        {showNotificationPopup && (
                            <ClickAwayListener onClickAway={() => setShowNotificationPopup(false)}>
                                <Box>
                                    <NotificationPopup onUnreadCountChange={setNotificationUnreadCount} />
                                </Box>
                            </ClickAwayListener>
                        )}
                    </Box>

                    <Box sx={{ position: 'relative' }}>
                        <Avatar
                            onClick={() => {
                                setShowAvatarMenu(!showAvatarMenu);
                                setShowChatPopup(false);
                                setShowNotificationPopup(false);
                            }}
                            sx={{
                                width: 40,
                                height: 40,
                                cursor: 'pointer',
                                border: showAvatarMenu ? '2px solid #1877f2' : 'none'
                            }}
                            alt={user?.fullName || user?.username || 'User'}
                            src={user?.avatar || '/avatar-placeholder.jpg'}
                        />

                        {showAvatarMenu && (
                            <ClickAwayListener onClickAway={() => setShowAvatarMenu(false)}>
                                <Box>
                                    <AvatarMenu onClose={() => setShowAvatarMenu(false)} />
                                </Box>
                            </ClickAwayListener>
                        )}
                    </Box>
                </Box>
            </Toolbar>
        </AppBar>
    );
}
