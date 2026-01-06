'use client';

import React from 'react';
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
} from '@mui/material';
import { Close as CloseIcon, Visibility as VisibilityIcon } from '@mui/icons-material';
import { StoryViewer } from '@/types/story';
import { timeAgo } from '@/utils/formatDate';

interface StoryViewersModalProps {
    open: boolean;
    onClose: () => void;
    viewers: StoryViewer[];
    isLoading: boolean;
    totalViews: number;
}

export default function StoryViewersModal({
    open,
    onClose,
    viewers,
    isLoading,
    totalViews,
}: StoryViewersModalProps) {
    // Group viewers by reaction
    const viewersWithReaction = viewers.filter(v => v.reaction);
    const viewersWithoutReaction = viewers.filter(v => !v.reaction);

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
                },
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                pb: 1,
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        bgcolor: '#e4e6eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <VisibilityIcon sx={{ color: '#65676b' }} />
                    </Box>
                    <Box>
                        <Typography variant="h6" fontWeight={700} fontSize={18}>
                            Chi tiết về tin
                        </Typography>
                        <Typography variant="body2" color="text.secondary" fontSize={13}>
                            {totalViews} người đã xem
                        </Typography>
                    </Box>
                </Box>
                <IconButton onClick={onClose} sx={{
                    bgcolor: '#e4e6eb',
                    '&:hover': { bgcolor: '#d8dadf' }
                }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <Divider />
            <DialogContent sx={{ p: 0, maxHeight: 400, minHeight: 200 }}>
                {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4, minHeight: 200 }}>
                        <CircularProgress size={32} />
                    </Box>
                ) : viewers.length === 0 ? (
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
                            Chưa có ai xem tin này
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            Khi có người xem, họ sẽ xuất hiện ở đây
                        </Typography>
                    </Box>
                ) : (
                    <>
                        {/* Viewers with reactions */}
                        {viewersWithReaction.length > 0 && (
                            <>
                                <Box sx={{ px: 2, py: 1.5, bgcolor: '#f5f5f5' }}>
                                    <Typography variant="subtitle2" fontWeight={600} fontSize={13} color="#65676b">
                                        ĐÃ BÀY TỎ CẢM XÚC
                                    </Typography>
                                </Box>
                                <List disablePadding>
                                    {viewersWithReaction.map((viewer, index) => (
                                        <ListItem
                                            key={viewer.userId || index}
                                            sx={{
                                                py: 1.5,
                                                px: 2,
                                                '&:hover': { bgcolor: '#f5f5f5' },
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <ListItemAvatar>
                                                <Box sx={{ position: 'relative' }}>
                                                    <Avatar
                                                        src={viewer.user?.avatar}
                                                        sx={{ width: 44, height: 44 }}
                                                    />
                                                    <Box
                                                        sx={{
                                                            position: 'absolute',
                                                            bottom: -2,
                                                            right: -2,
                                                            fontSize: 18,
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
                                                </Box>
                                            </ListItemAvatar>
                                            <ListItemText
                                                primary={
                                                    <Typography fontWeight={500}>
                                                        {viewer.user?.firstName || 'Người dùng'} {viewer.user?.lastName || ''}
                                                    </Typography>
                                                }
                                                secondary={viewer.viewedAt ? timeAgo(new Date(viewer.viewedAt)) : ''}
                                                sx={{ ml: 1 }}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            </>
                        )}

                        {/* Viewers without reactions */}
                        {viewersWithoutReaction.length > 0 && (
                            <>
                                <Box sx={{ px: 2, py: 1.5, bgcolor: '#f5f5f5' }}>
                                    <Typography variant="subtitle2" fontWeight={600} fontSize={13} color="#65676b">
                                        ĐÃ XEM
                                    </Typography>
                                </Box>
                                <List disablePadding>
                                    {viewersWithoutReaction.map((viewer, index) => (
                                        <ListItem
                                            key={viewer.userId || index}
                                            sx={{
                                                py: 1.5,
                                                px: 2,
                                                '&:hover': { bgcolor: '#f5f5f5' },
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <ListItemAvatar>
                                                <Avatar
                                                    src={viewer.user?.avatar}
                                                    sx={{ width: 44, height: 44 }}
                                                />
                                            </ListItemAvatar>
                                            <ListItemText
                                                primary={
                                                    <Typography fontWeight={500}>
                                                        {viewer.user?.firstName || 'Người dùng'} {viewer.user?.lastName || ''}
                                                    </Typography>
                                                }
                                                secondary={viewer.viewedAt ? timeAgo(new Date(viewer.viewedAt)) : ''}
                                                sx={{ ml: 1 }}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            </>
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
