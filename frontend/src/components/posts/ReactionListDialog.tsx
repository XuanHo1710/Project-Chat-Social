'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    Box,
    Typography,
    Avatar,
    IconButton,
    Tabs,
    Tab,
    Button,
    CircularProgress,
    useTheme,
} from '@mui/material';
import { Close as CloseIcon, PersonAdd as PersonAddIcon } from '@mui/icons-material';
import { getPostReactions } from '@/services/reaction.service';
import { relationshipService } from '@/services/relationship.service';
import { Reaction, ReactionType, ReactionUser } from '@/types/reaction';
import { FriendType } from '@/types/account';
import { useSocket } from '@/contexts/SocketContext';

const REACTION_EMOJI: Record<ReactionType, string> = {
    LIKE: '👍',
    LOVE: '❤️',
    HAHA: '😆',
    WOW: '😮',
    SAD: '😢',
    ANGRY: '😡',
};

interface ReactionListDialogProps {
    open: boolean;
    onClose: () => void;
    postId: string;
    userId: string;
}


export default function ReactionListDialog({ open, onClose, postId, userId }: ReactionListDialogProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const hoverBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
    const [loading, setLoading] = useState(false);
    const [reactions, setReactions] = useState<Reaction[]>([]);
    const [counts, setCounts] = useState<Record<ReactionType, number>>({
        LIKE: 0, LOVE: 0, HAHA: 0, WOW: 0, SAD: 0, ANGRY: 0
    });
    const [friends, setFriends] = useState<string[]>([]);
    const [sentRequests, setSentRequests] = useState<string[]>([]);
    const [selectedTab, setSelectedTab] = useState<'ALL' | ReactionType>('ALL');
    const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());
    const { socketRelationship, socketReaction } = useSocket();

    // Fetch reactions and friends list
    const fetchData = useCallback(async () => {
        if (!open || !postId) return;

        setLoading(true);
        try {
            const [reactionsData, friendsData, sentData] = await Promise.all([
                getPostReactions(postId, 1, 100),
                relationshipService.getFriends(),
                relationshipService.getSentFriendRequests()
            ]);

            const reactionsDataAfterFilter = reactionsData.data.filter(reaction => reaction.userId !== null);

            setReactions(reactionsDataAfterFilter);
            setCounts(reactionsData.counts);

            // Extract friend IDs
            const friendIds = (friendsData.data || []).map((f: FriendType) => f._id);
            setFriends(friendIds);

            // Extract sent request IDs
            const sentIds = (sentData.data || []).map((f: FriendType) => f._id);
            setSentRequests(sentIds);
        } catch (error) {
            console.error('Failed to fetch reactions:', error);
        } finally {
            setLoading(false);
        }
    }, [open, postId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Subscribe to reaction updates when dialog opens
    useEffect(() => {
        if (!open || !socketReaction || !postId) return;

        // Subscribe to post reaction updates
        socketReaction.emit('post:subscribe', { postId });

        // Listen for reaction updates
        const handleReactionUpdated = (data: { postId: string; userId: string; action: string; type: ReactionType }) => {
            if (data.postId === postId) {
                // Refetch reactions when there's an update
                fetchData();
            }
        };

        socketReaction.on('reaction:updated', handleReactionUpdated);

        return () => {
            socketReaction.emit('post:unsubscribe', { postId });
            socketReaction.off('reaction:updated', handleReactionUpdated);
        };
    }, [open, socketReaction, postId, fetchData]);

    // Listen for friend request updates
    useEffect(() => {
        if (!socketRelationship) return;

        const handleFriendSent = (data: FriendType[]) => {
            const sentIds = data.map(f => f._id);
            setSentRequests(sentIds);
        };

        const handleFriendsList = (data: FriendType[]) => {
            const friendIds = data.map(f => f._id);
            setFriends(friendIds);
        };

        socketRelationship.on('friend:sent', handleFriendSent);
        socketRelationship.on('friend:friends', handleFriendsList);

        return () => {
            socketRelationship.off('friend:sent', handleFriendSent);
            socketRelationship.off('friend:friends', handleFriendsList);
        };
    }, [socketRelationship]);

    // Transform reactions to user list with friend status
    const reactionUsers: ReactionUser[] = useMemo(() => {
        const users = reactions.map(r => ({
            _id: r.userId._id,
            firstName: r.userId.firstName,
            lastName: r.userId.lastName,
            avatar: r.userId.avatar,
            reactionType: r.type,
            isFriend: friends.includes(r.userId._id) || r.userId._id === userId,
            hasSentRequest: sentRequests.includes(r.userId._id)
        }));

        // Sort: current user first, then friends, then non-friends
        return users.sort((a, b) => {
            if (a._id === userId) return -1; // Current user first
            if (b._id === userId) return 1;
            if (a.isFriend && !b.isFriend) return -1;
            if (!a.isFriend && b.isFriend) return 1;
            return 0;
        });
    }, [reactions, friends, sentRequests, userId]);

    // Filter by selected tab
    const filteredUsers = useMemo(() => {
        if (selectedTab === 'ALL') return reactionUsers;
        return reactionUsers.filter(u => u.reactionType === selectedTab);
    }, [reactionUsers, selectedTab]);

    // Handle add friend - send via socket
    const handleAddFriend = async (targetUserId: string) => {
        if (pendingRequests.has(targetUserId) || sentRequests.includes(targetUserId)) return;

        setPendingRequests(prev => new Set(prev).add(targetUserId));

        try {
            if (socketRelationship) {
                // Emit friend request: current user (userId) sends to target user (targetUserId)
                socketRelationship.emit('friend:request', {
                    userId: userId,       // người gửi lời mời (current user)
                    friendId: targetUserId // người nhận lời mời
                });
            } else {
                await relationshipService.addFriend(userId, targetUserId);
            }
        } catch (error) {
            console.error('Failed to add friend:', error);
            setPendingRequests(prev => {
                const newSet = new Set(prev);
                newSet.delete(targetUserId);
                return newSet;
            });
        }
    };

    // Get total count
    const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

    // Get tabs with counts > 0
    const availableTabs = useMemo(() => {
        const tabs: { type: 'ALL' | ReactionType; count: number; emoji?: string }[] = [
            { type: 'ALL', count: totalCount }
        ];

        (Object.keys(counts) as ReactionType[]).forEach(type => {
            if (counts[type] > 0) {
                tabs.push({ type, count: counts[type], emoji: REACTION_EMOJI[type] });
            }
        });

        return tabs;
    }, [counts, totalCount]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    borderRadius: 3,
                    maxHeight: '80vh'
                }
            }}
        >
            {/* Header */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 2,
            }}>
                <Typography variant="h6" fontWeight={700}>
                    Cảm xúc về bài viết
                </Typography>
                <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
                    <CloseIcon />
                </IconButton>
            </Box>

            {/* Tabs */}
            <Box>
                <Tabs
                    value={selectedTab}
                    onChange={(_, v) => setSelectedTab(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                        '& .MuiTab-root': {
                            color: 'text.secondary',
                            textTransform: 'none',
                            minWidth: 'auto',
                            px: 2,
                            '&.Mui-selected': { color: 'primary.main' }
                        },
                        '& .MuiTabs-indicator': { bgcolor: 'primary.main' }
                    }}
                >
                    {availableTabs.map(tab => (
                        <Tab
                            key={tab.type}
                            value={tab.type}
                            label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    {tab.emoji && <span>{tab.emoji}</span>}
                                    {tab.type === 'ALL' ? 'Tất cả' : ''}
                                    <Typography component="span" fontSize={14}>
                                        {tab.count}
                                    </Typography>
                                </Box>
                            }
                        />
                    ))}
                </Tabs>
            </Box>

            {/* Content */}
            <DialogContent sx={{ p: 0 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress size={32} />
                    </Box>
                ) : filteredUsers.length === 0 ? (
                    <Typography color="text.secondary" textAlign="center" py={4}>
                        Chưa có ai bày tỏ cảm xúc
                    </Typography>
                ) : (
                    <Box>
                        {filteredUsers.map(user => (
                            <Box
                                key={user._id}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5,
                                    p: 2,
                                    '&:hover': { bgcolor: hoverBg }
                                }}
                            >
                                {/* Avatar with reaction badge */}
                                <Box sx={{ position: 'relative' }}>
                                    <Avatar src={user.avatar} sx={{ width: 40, height: 40 }} />
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            bottom: -2,
                                            right: -2,
                                            fontSize: 14,
                                            lineHeight: 1
                                        }}
                                    >
                                        {REACTION_EMOJI[user.reactionType]}
                                    </Box>
                                </Box>

                                {/* Name */}
                                <Typography
                                    sx={{
                                        flex: 1,
                                        fontWeight: 500,
                                    }}
                                >
                                    {user.firstName} {user.lastName}
                                </Typography>

                                {/* Add Friend Button - only show for non-friends and not self */}
                                {user._id !== userId && !user.isFriend && (
                                    <Button
                                        variant="contained"
                                        size="small"
                                        startIcon={!user.hasSentRequest && !pendingRequests.has(user._id) ? <PersonAddIcon /> : undefined}
                                        disabled={user.hasSentRequest || pendingRequests.has(user._id)}
                                        onClick={() => handleAddFriend(user._id)}
                                        sx={{
                                            bgcolor: user.hasSentRequest || pendingRequests.has(user._id) ? '#e4e6eb' : '#e7f3ff',
                                            color: user.hasSentRequest || pendingRequests.has(user._id) ? '#65676b' : '#1877f2',
                                            textTransform: 'none',
                                            fontWeight: 600,
                                            fontSize: 13,
                                            boxShadow: 'none',
                                            '&:hover': {
                                                bgcolor: user.hasSentRequest || pendingRequests.has(user._id) ? '#e4e6eb' : '#d0e8ff',
                                                boxShadow: 'none'
                                            },
                                            '&.Mui-disabled': {
                                                bgcolor: '#e4e6eb',
                                                color: '#65676b'
                                            }
                                        }}
                                    >
                                        {user.hasSentRequest || pendingRequests.has(user._id) ? 'Đã gửi lời mời' : 'Thêm bạn bè'}
                                    </Button>
                                )}
                            </Box>
                        ))}
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
}
