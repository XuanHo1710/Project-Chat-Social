'use client';

import { useState, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    Box,
    Typography,
    Avatar,
    IconButton,
    Tabs,
    Tab,
    useTheme,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { EmotionType } from '@/types/chat';
import { ConversationParticipant } from '@/types/conversation';

const EMOTION_EMOJI: Record<EmotionType, string> = {
    LIKE: '👍',
    LOVE: '❤️',
    FUNNY: '😆',
    WOW: '😮',
    SAD: '😢',
    ANGRY: '😡',
};

const EMOTION_LABELS: Record<EmotionType, string> = {
    LIKE: 'Thích',
    LOVE: 'Yêu thích',
    FUNNY: 'Haha',
    WOW: 'Wow',
    SAD: 'Buồn',
    ANGRY: 'Phẫn nộ',
};

interface EmotionUser {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    emotionType: EmotionType;
}

interface EmotionListDialogProps {
    open: boolean;
    onClose: () => void;
    emotions: Array<{
        userId: string;
        emotionType: EmotionType;
    }>;
    participants: Array<ConversationParticipant>
}

export default function EmotionListDialog({ open, onClose, emotions, participants }: EmotionListDialogProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [selectedTab, setSelectedTab] = useState<'ALL' | EmotionType>('ALL');

    // Transform emotions to user list with emotion info
    const emotionUsers: EmotionUser[] = useMemo(() => {
        return emotions.map(e => {
            const user = participants.find(p => p.user._id === e.userId);
            if (!user) return null;

            return {
                _id: user.user._id,
                firstName: user.user.firstName || '',
                lastName: user.user.lastName || '',
                avatar: user.user.avatar,
                emotionType: e.emotionType,
            };
        }).filter((u) => u !== null);
    }, [emotions, participants]);

    // Count emotions by type
    const counts = useMemo(() => {
        const result: Record<EmotionType, number> = {
            LIKE: 0, LOVE: 0, FUNNY: 0, WOW: 0, SAD: 0, ANGRY: 0
        };
        emotions.forEach(e => {
            result[e.emotionType] = (result[e.emotionType] || 0) + 1;
        });
        return result;
    }, [emotions]);

    // Get total count
    const totalCount = emotions.length;

    // Get tabs with counts > 0
    const availableTabs = useMemo(() => {
        const tabs: { type: 'ALL' | EmotionType; count: number; emoji?: string }[] = [
            { type: 'ALL', count: totalCount }
        ];

        (Object.keys(counts) as EmotionType[]).forEach(type => {
            if (counts[type] > 0) {
                tabs.push({ type, count: counts[type], emoji: EMOTION_EMOJI[type] });
            }
        });

        return tabs;
    }, [counts, totalCount]);

    // Filter by selected tab
    const filteredUsers = useMemo(() => {
        if (selectedTab === 'ALL') return emotionUsers;
        return emotionUsers.filter(u => u.emotionType === selectedTab);
    }, [emotionUsers, selectedTab]);

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
                borderBottom: `1px solid ${theme.palette.divider}`
            }}>
                <Typography variant="h6" fontWeight={700}>
                    Cảm xúc về tin nhắn
                </Typography>
                <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
                    <CloseIcon />
                </IconButton>
            </Box>

            {/* Tabs */}
            <Box sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
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
                {filteredUsers.length === 0 ? (
                    <Typography color="text.secondary" textAlign="center" py={4}>
                        Chưa có ai bày tỏ cảm xúc
                    </Typography>
                ) : (
                    <Box>
                        {filteredUsers.map((user, index) => (
                            <Box
                                key={`${user._id}-${index}`}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5,
                                    p: 2,
                                    '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }
                                }}
                            >
                                {/* Avatar with emotion badge */}
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
                                        {EMOTION_EMOJI[user.emotionType]}
                                    </Box>
                                </Box>

                                {/* Name */}
                                <Box sx={{ flex: 1 }}>
                                    <Typography fontWeight={500} fontSize={15}>
                                        {user.firstName} {user.lastName}
                                    </Typography>
                                    <Typography fontSize={12} color="text.secondary">
                                        {EMOTION_LABELS[user.emotionType]}
                                    </Typography>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
}
