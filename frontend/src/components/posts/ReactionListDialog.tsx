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
    const [loading, setLoading] = useState(false);
    const [reactions, setReactions] = useState<Reaction[]>([]);
    const [counts, setCounts] = useState<Record<ReactionType, number>>({
        LIKE: 0, LOVE: 0, HAHA: 0, WOW: 0, SAD: 0, ANGRY: 0
    });
    const [friends, setFriends] = useState<string[]>([]);
    const [selectedTab, setSelectedTab] = useState<'ALL' | ReactionType>('ALL');
    const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());
    const { socketRelationship } = useSocket();

    // Fetch reactions and friends list
    const fetchData = useCallback(async () => {
        if (!open || !postId) return;

        setLoading(true);
        try {
            const [reactionsData, friendsData] = await Promise.all([
                getPostReactions(postId, 1, 100),
                relationshipService.getFriends()
            ]);

            setReactions(reactionsData.data);
            setCounts(reactionsData.counts);

            // Extract friend IDs
            const friendIds = (friendsData.data || []).map((f: FriendType) => f._id);
            setFriends(friendIds);
        } catch (error) {
            console.error('Failed to fetch reactions:', error);
        } finally {
            setLoading(false);
        }
    }, [open, postId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Transform reactions to user list with friend status
    const reactionUsers: ReactionUser[] = useMemo(() => {
        const users = reactions.map(r => ({
            _id: r.userId._id,
            firstName: r.userId.firstName,
            lastName: r.userId.lastName,
            avatar: r.userId.avatar,
            reactionType: r.type,
            isFriend: friends.includes(r.userId._id) || r.userId._id === userId
        }));

        // Sort: friends first, then non-friends
        return users.sort((a, b) => {
            if (a._id === userId) return -1; // Current user first
            if (b._id === userId) return 1;
            if (a.isFriend && !b.isFriend) return -1;
            if (!a.isFriend && b.isFriend) return 1;
            return 0;
        });
    }, [reactions, friends, userId]);

    // Filter by selected tab
    const filteredUsers = useMemo(() => {
        if (selectedTab === 'ALL') return reactionUsers;
        return reactionUsers.filter(u => u.reactionType === selectedTab);
    }, [reactionUsers, selectedTab]);

    // Handle add friend
    const handleAddFriend = async (friendId: string) => {
        if (pendingRequests.has(friendId)) return;

        setPendingRequests(prev => new Set(prev).add(friendId));

        try {
            if (socketRelationship) {
                socketRelationship.emit('relationship:add', {
                    userId,
                    friendId
                });
            } else {
                await relationshipService.addFriend(userId, friendId);
            }
        } catch (error) {
            console.error('Failed to add friend:', error);
            setPendingRequests(prev => {
                const newSet = new Set(prev);
                newSet.delete(friendId);
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
                    bgcolor: '#fff',
                    color: 'black',
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
                <IconButton onClick={onClose} sx={{ color: '#b0b3b8' }}>
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
                            color: '#b0b3b8',
                            textTransform: 'none',
                            minWidth: 'auto',
                            px: 2,
                            '&.Mui-selected': { color: '#2e89ff' }
                        },
                        '& .MuiTabs-indicator': { bgcolor: '#2e89ff' }
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
                    <Typography color="#b0b3b8" textAlign="center" py={4}>
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
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
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
                                        startIcon={<PersonAddIcon />}
                                        disabled={pendingRequests.has(user._id)}
                                        onClick={() => handleAddFriend(user._id)}
                                        sx={{
                                            bgcolor: '#3a3b3c',
                                            color: 'white',
                                            textTransform: 'none',
                                            fontWeight: 600,
                                            fontSize: 13,
                                            '&:hover': { bgcolor: '#4e4f50' },
                                            '&.Mui-disabled': {
                                                bgcolor: '#3a3b3c',
                                                color: '#65676b'
                                            }
                                        }}
                                    >
                                        {pendingRequests.has(user._id) ? 'Đã gửi' : 'Thêm bạn bè'}
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
