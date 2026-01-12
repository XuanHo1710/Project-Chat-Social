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
    CircularProgress,
    useTheme,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { getCommentReactions } from '@/services/reaction.service';
import { Reaction, ReactionType } from '@/types/reaction';
import { useSocket } from '@/contexts/SocketContext';

const REACTION_EMOJI: Record<ReactionType, string> = {
    LIKE: '👍',
    LOVE: '❤️',
    HAHA: '😆',
    WOW: '😮',
    SAD: '😢',
    ANGRY: '😡',
};

interface CommentReactionListDialogProps {
    open: boolean;
    onClose: () => void;
    commentId: string;
}

export default function CommentReactionListDialog({ open, onClose, commentId }: CommentReactionListDialogProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [loading, setLoading] = useState(false);
    const [reactions, setReactions] = useState<Reaction[]>([]);
    const [counts, setCounts] = useState<Record<ReactionType, number>>({
        LIKE: 0, LOVE: 0, HAHA: 0, WOW: 0, SAD: 0, ANGRY: 0
    });
    const [selectedTab, setSelectedTab] = useState<'ALL' | ReactionType>('ALL');
    const { socketReaction } = useSocket();

    // Theme helpers
    const borderColor = theme.palette.divider;
    const secondaryText = theme.palette.text.secondary;
    const bgHover = isDark ? 'rgba(255,255,255,0.05)' : '#f0f2f5';

    // Fetch reactions
    const fetchData = useCallback(async () => {
        if (!open || !commentId) return;

        setLoading(true);
        try {
            const reactionsData = await getCommentReactions(commentId, 1, 100);
            setReactions(reactionsData.data);
            setCounts(reactionsData.counts);
        } catch (error) {
            console.error('Failed to fetch comment reactions:', error);
        } finally {
            setLoading(false);
        }
    }, [open, commentId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Subscribe to comment reaction updates
    useEffect(() => {
        if (!open || !socketReaction || !commentId) return;

        // Listen for comment reaction updates
        const handleReactionUpdated = (data: { commentId: string }) => {
            if (data.commentId === commentId) {
                fetchData();
            }
        };

        socketReaction.on('comment:reaction:result', handleReactionUpdated);

        return () => {
            socketReaction.off('comment:reaction:result', handleReactionUpdated);
        };
    }, [open, socketReaction, commentId, fetchData]);

    // Transform reactions to user list
    const reactionUsers = useMemo(() => {
        return reactions.map(r => ({
            _id: r.userId._id,
            firstName: r.userId.firstName,
            lastName: r.userId.lastName,
            avatar: r.userId.avatar,
            reactionType: r.type,
        }));
    }, [reactions]);

    // Filter by selected tab
    const filteredUsers = useMemo(() => {
        if (selectedTab === 'ALL') return reactionUsers;
        return reactionUsers.filter(u => u.reactionType === selectedTab);
    }, [reactionUsers, selectedTab]);

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
            maxWidth="xs"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 2,
                    maxHeight: '70vh',
                }
            }}
        >
            {/* Header */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 2,
                borderBottom: `1px solid ${borderColor}`
            }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Cảm xúc
                </Typography>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </Box>

            {/* Tabs */}
            <Tabs
                value={selectedTab}
                onChange={(_, val) => setSelectedTab(val)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                    borderBottom: `1px solid ${borderColor}`,
                    minHeight: 48,
                    '& .MuiTab-root': {
                        minHeight: 48,
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: 14,
                    }
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
                                <Typography component="span" sx={{ fontSize: 13, color: secondaryText }}>
                                    {tab.count}
                                </Typography>
                            </Box>
                        }
                    />
                ))}
            </Tabs>

            <DialogContent sx={{ p: 0 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress size={32} />
                    </Box>
                ) : filteredUsers.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4, color: secondaryText }}>
                        Chưa có cảm xúc nào
                    </Box>
                ) : (
                    <Box sx={{ py: 1 }}>
                        {filteredUsers.map((user) => (
                            <Box
                                key={user._id}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5,
                                    px: 2,
                                    py: 1,
                                    cursor: 'pointer',
                                    '&:hover': { bgcolor: bgHover }
                                }}
                            >
                                <Box sx={{ position: 'relative' }}>
                                    <Avatar src={user.avatar} sx={{ width: 40, height: 40 }}>
                                        {user.firstName?.[0]}
                                    </Avatar>
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            bottom: -2,
                                            right: -2,
                                            fontSize: 14,
                                            lineHeight: 1,
                                        }}
                                    >
                                        {REACTION_EMOJI[user.reactionType]}
                                    </Box>
                                </Box>
                                <Typography sx={{ fontWeight: 500, flex: 1 }}>
                                    {user.firstName} {user.lastName}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
}
