'use client';

import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Box,
    Avatar,
    Typography,
    IconButton,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Divider,
    CircularProgress,
    Tabs,
    Tab,
    Badge,
} from '@mui/material';
import {
    Close as CloseIcon,
    Visibility as VisibilityIcon,
    FavoriteBorder as HeartIcon,
} from '@mui/icons-material';
import { StoryViewer, Story } from '@/types/story';
import { timeAgo } from '@/utils/formatDate';

interface StoryViewersModalProps {
    open: boolean;
    onClose: () => void;
    viewers: StoryViewer[];
    isLoading: boolean;
    totalViews: number;
    stories?: Story[];
    currentStoryIndex?: number;
    onStorySelect?: (index: number) => void;
}

// Styled online indicator
const OnlineIndicator = ({ isOnline }: { isOnline?: boolean }) => (
    <Box
        sx={{
            position: 'absolute',
            bottom: 2,
            right: 2,
            width: 12,
            height: 12,
            borderRadius: '50%',
            bgcolor: isOnline ? '#31a24c' : '#bdbdbd',
            border: '2px solid white',
        }}
    />
);

export default function StoryViewersModal({
    open,
    onClose,
    viewers,
    isLoading,
    totalViews,
    stories = [],
    currentStoryIndex = 0,
    onStorySelect,
}: StoryViewersModalProps) {
    const [tabValue, setTabValue] = useState(0);

    // Group viewers by reaction
    const viewersWithReaction = viewers.filter(v => v.reaction);
    const viewersWithoutReaction = viewers.filter(v => !v.reaction);

    // Get unique reaction types with counts
    const reactionCounts = viewersWithReaction.reduce((acc, v) => {
        if (v.reaction) {
            acc[v.reaction] = (acc[v.reaction] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);

    const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    const displayViewers = tabValue === 0
        ? viewers
        : tabValue === 1
            ? viewersWithReaction
            : viewersWithoutReaction;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xs"
            fullWidth
            PaperProps={{
                sx: {
                    bgcolor: 'white',
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                    overflow: 'hidden',
                },
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                pb: 1,
                px: 2,
                pt: 2,
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography variant="h6" fontWeight={700} fontSize={18}>
                        Chi tiết về tin
                    </Typography>
                </Box>
                <IconButton
                    onClick={onClose}
                    size="small"
                    sx={{
                        bgcolor: '#e4e6eb',
                        '&:hover': { bgcolor: '#d8dadf' }
                    }}
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>

            {/* Story Thumbnails Preview */}
            {stories.length > 0 && (
                <Box sx={{
                    px: 2,
                    py: 1.5,
                    display: 'flex',
                    gap: 1,
                    overflowX: 'auto',
                    bgcolor: '#f5f5f5',
                    '&::-webkit-scrollbar': { height: 4 },
                    '&::-webkit-scrollbar-thumb': { bgcolor: '#bdbdbd', borderRadius: 2 },
                }}>
                    {stories.map((story, idx) => (
                        <Box
                            key={story._id}
                            onClick={() => onStorySelect?.(idx)}
                            sx={{
                                position: 'relative',
                                width: 48,
                                height: 72,
                                borderRadius: 1.5,
                                overflow: 'hidden',
                                cursor: 'pointer',
                                flexShrink: 0,
                                border: idx === currentStoryIndex ? '2px solid #0866ff' : '2px solid transparent',
                                transition: 'all 0.2s',
                                '&:hover': {
                                    transform: 'scale(1.05)',
                                },
                            }}
                        >
                            {story.type === 'VIDEO' ? (
                                <video
                                    src={story.mediaUrl}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                    }}
                                />
                            ) : (
                                <Box
                                    component="img"
                                    src={story.mediaUrl}
                                    alt=""
                                    sx={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                    }}
                                />
                            )}
                            {/* View count overlay */}
                            <Box sx={{
                                position: 'absolute',
                                bottom: 2,
                                left: 2,
                                right: 2,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.3,
                                bgcolor: 'rgba(0,0,0,0.6)',
                                borderRadius: 0.5,
                                px: 0.5,
                            }}>
                                <VisibilityIcon sx={{ fontSize: 10, color: 'white' }} />
                                <Typography sx={{ fontSize: 9, color: 'white', fontWeight: 500 }}>
                                    {story.viewCount || 0}
                                </Typography>
                            </Box>
                        </Box>
                    ))}
                </Box>
            )}

            {/* Tabs for filtering */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs
                    value={tabValue}
                    onChange={handleTabChange}
                    variant="fullWidth"
                    sx={{
                        minHeight: 44,
                        '& .MuiTab-root': {
                            minHeight: 44,
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: 14,
                        },
                    }}
                >
                    <Tab
                        label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <VisibilityIcon sx={{ fontSize: 18 }} />
                                <span>Tất cả ({totalViews})</span>
                            </Box>
                        }
                    />
                    <Tab
                        label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {Object.keys(reactionCounts).length > 0 ? (
                                    Object.entries(reactionCounts).slice(0, 3).map(([emoji]) => (
                                        <span key={emoji} style={{ fontSize: 14 }}>{emoji}</span>
                                    ))
                                ) : (
                                    <HeartIcon sx={{ fontSize: 18 }} />
                                )}
                                <span>({viewersWithReaction.length})</span>
                            </Box>
                        }
                    />
                    <Tab
                        label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <span>Chỉ xem ({viewersWithoutReaction.length})</span>
                            </Box>
                        }
                    />
                </Tabs>
            </Box>

            <DialogContent sx={{ p: 0, maxHeight: 350, minHeight: 200 }}>
                {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4, minHeight: 200 }}>
                        <CircularProgress size={32} />
                    </Box>
                ) : displayViewers.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center', minHeight: 200, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                        <Box sx={{
                            width: 64,
                            height: 64,
                            borderRadius: '50%',
                            bgcolor: '#f0f2f5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mb: 2,
                        }}>
                            <VisibilityIcon sx={{ fontSize: 32, color: '#bcc0c4' }} />
                        </Box>
                        <Typography color="text.secondary" fontWeight={500}>
                            {tabValue === 0 ? 'Chưa có ai xem tin này' :
                                tabValue === 1 ? 'Chưa có ai bày tỏ cảm xúc' :
                                    'Không có người xem nào'}
                        </Typography>
                    </Box>
                ) : (
                    <List disablePadding>
                        {displayViewers.map((viewer, index) => (
                            <ListItem
                                key={viewer.userId || index}
                                sx={{
                                    py: 1.5,
                                    px: 2,
                                    '&:hover': { bgcolor: '#f5f5f5' },
                                    cursor: 'pointer',
                                    borderBottom: index < displayViewers.length - 1 ? '1px solid #f0f0f0' : 'none',
                                }}
                            >
                                <ListItemAvatar>
                                    <Box sx={{ position: 'relative' }}>
                                        <Avatar
                                            src={viewer.user?.avatar}
                                            sx={{ width: 48, height: 48 }}
                                        />
                                        {/* Online indicator */}
                                        <OnlineIndicator isOnline={viewer.user?.status === 'ACTIVE'} />
                                        {/* Reaction badge */}
                                        {viewer.reaction && (
                                            <Box
                                                sx={{
                                                    position: 'absolute',
                                                    bottom: -4,
                                                    right: -4,
                                                    fontSize: 16,
                                                    bgcolor: 'white',
                                                    borderRadius: '50%',
                                                    width: 24,
                                                    height: 24,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                                                }}
                                            >
                                                {viewer.reaction}
                                            </Box>
                                        )}
                                    </Box>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography fontWeight={600} fontSize={15}>
                                                {viewer.user?.firstName || 'Người dùng'} {viewer.user?.lastName || ''}
                                            </Typography>
                                            {viewer.user?.status === 'ACTIVE' && (
                                                <Typography
                                                    component="span"
                                                    sx={{
                                                        fontSize: 11,
                                                        color: '#31a24c',
                                                        fontWeight: 500,
                                                    }}
                                                >
                                                    Đang hoạt động
                                                </Typography>
                                            )}
                                        </Box>
                                    }
                                    secondary={
                                        <Typography variant="body2" color="text.secondary" fontSize={13}>
                                            {viewer.viewedAt ? timeAgo(new Date(viewer.viewedAt)) : ''}
                                        </Typography>
                                    }
                                    sx={{ ml: 1.5 }}
                                />
                            </ListItem>
                        ))}
                    </List>
                )}
            </DialogContent>
        </Dialog>
    );
}
