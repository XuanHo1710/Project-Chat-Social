'use client';

import { useEffect } from 'react';
import { Box, Typography, Avatar, Badge } from '@mui/material';
import { MoreHoriz as MoreIcon, VideoCall as VideoIcon, Search as SearchIcon } from '@mui/icons-material';
import { useDisplayListFriends } from '@/queries/useRelationshipQueries';
import { useAuthStore } from '@/stores/useAuthStore';
import { useOnlineStatusStore, formatLastActive } from '@/stores/useOnlineStatusStore';

export default function RightSidebar() {
    const { user } = useAuthStore();
    const { data: friends, isLoading: isLoadingFriends } = useDisplayListFriends(user?.id || "");

    // Online status store - just read, don't subscribe to socket here
    const onlineUsers = useOnlineStatusStore(state => state.onlineUsers);
    const setUserOnline = useOnlineStatusStore(state => state.setUserOnline);
    const setUserOffline = useOnlineStatusStore(state => state.setUserOffline);

    // Initialize status from friend data (only when friends load)
    useEffect(() => {
        if (friends?.data) {
            friends.data.forEach(friend => {
                // Only initialize if not already in store
                const existing = useOnlineStatusStore.getState().onlineUsers[friend._id];
                if (!existing) {
                    if (friend.status === 'ACTIVE') {
                        setUserOnline(friend._id);
                    } else if (friend.status === 'HIDDEN') {
                        // User has hidden activity status - show as offline without lastActive
                        setUserOffline(friend._id, undefined);
                    } else if (friend.lastActive) {
                        setUserOffline(friend._id, friend.lastActive);
                    }
                }
            });
        }
    }, [friends?.data, setUserOnline, setUserOffline]);

    // Get status with real-time updates
    const getFriendStatus = (friendId: string, friendStatus: string, friendLastActive?: string) => {
        const storeStatus = onlineUsers[friendId];
        if (storeStatus) {
            return {
                isOnline: storeStatus.isOnline,
                lastActive: storeStatus.lastActive
            };
        }
        // Handle HIDDEN status - show as offline without lastActive
        if (friendStatus === 'HIDDEN') {
            return {
                isOnline: false,
                lastActive: undefined
            };
        }
        return {
            isOnline: friendStatus === 'ACTIVE',
            lastActive: friendLastActive
        };
    };

    return (
        <Box
            sx={{
                width: 280,
                height: 'calc(100vh - 56px)',
                position: 'fixed',
                right: 0,
                top: 56,
                overflowY: 'auto',
                pt: 2,
                px: 2,
                bgcolor: '#f0f2f5',
                zIndex: 100,
                display: { xs: 'none', xl: 'block' },
                '&::-webkit-scrollbar': {
                    width: '8px',
                },
                '&::-webkit-scrollbar-thumb': {
                    backgroundColor: '#b8b8b8',
                    borderRadius: '4px',
                },
            }}
        >
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography sx={{ fontSize: '17px', fontWeight: 600, color: '#65676b' }}>
                    Người liên hệ
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Box
                        sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: '#e4e6eb' },
                        }}
                    >
                        <VideoIcon sx={{ fontSize: '20px', color: '#65676b' }} />
                    </Box>
                    <Box
                        sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: '#e4e6eb' },
                        }}
                    >
                        <SearchIcon sx={{ fontSize: '20px', color: '#65676b' }} />
                    </Box>
                    <Box
                        sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: '#e4e6eb' },
                        }}
                    >
                        <MoreIcon sx={{ fontSize: '20px', color: '#65676b' }} />
                    </Box>
                </Box>
            </Box>

            {/* Contacts List */}
            <Box>
                {!isLoadingFriends && friends?.data && friends.data.length > 0 &&
                    friends.data.map(friend => {
                        const status = getFriendStatus(friend._id, friend.status, friend.lastActive);
                        const lastActiveLabel = !status.isOnline ? formatLastActive(status.lastActive) : null;

                        return (
                            <Box
                                key={friend._id}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5,
                                    py: 1,
                                    px: 1,
                                    borderRadius: 2,
                                    cursor: 'pointer',
                                    '&:hover': {
                                        bgcolor: '#e4e6eb',
                                    },
                                }}
                            >
                                <Badge
                                    overlap="circular"
                                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                    variant="dot"
                                    sx={{
                                        '& .MuiBadge-badge': {
                                            backgroundColor: status.isOnline ? '#31a24c' : 'transparent',
                                            border: status.isOnline ? '2px solid white' : 'none',
                                            width: 12,
                                            height: 12,
                                            borderRadius: '50%',
                                        },
                                    }}
                                >
                                    <Avatar
                                        src={friend.avatar || ""}
                                        sx={{ width: 36, height: 36 }}
                                    >
                                        {friend.firstName?.[0]}
                                    </Avatar>
                                </Badge>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography
                                        sx={{
                                            fontSize: '15px',
                                            fontWeight: 500,
                                            color: '#050505',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {friend.firstName + " " + friend.lastName}
                                    </Typography>
                                    {/* Show "X phút" or "X giờ" if offline */}
                                    {lastActiveLabel && (
                                        <Typography
                                            sx={{
                                                fontSize: '12px',
                                                color: '#65676b',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {lastActiveLabel}
                                        </Typography>
                                    )}
                                </Box>
                            </Box>
                        );
                    })
                }
            </Box>
        </Box>
    );
}
