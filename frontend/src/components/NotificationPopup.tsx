'use client';

import React from 'react';
import {
    Box,
    Paper,
    Typography,
    IconButton,
    List,
    ListItemButton,
    ListItemAvatar,
    Avatar,
    ListItemText,
    Badge,
    Divider,
} from '@mui/material';
import {
    Settings as SettingsIcon,
    MoreHoriz as MoreIcon,
} from '@mui/icons-material';

const notifications = [
    {
        id: 1,
        user: 'Bây giờ trong GIẢI ĐỀ TOEIC ETS 2024 CÙNG CÔ...',
        content: 'Sáng sớm mở điện thoại ra nhận được tin mừng...',
        time: '1 ngày · 8 cảm xúc · 1 bình luận',
        avatar: '/notification1.jpg',
        unread: true,
    },
    {
        id: 2,
        user: 'Bây giờ trong GIẢI ĐỀ TOEIC ETS 2024 CÙNG CÔ...',
        content: 'Tin vui chiều thứ 7 cuối tuần với 735 điểm Toeic...',
        time: '2 ngày · 22 cảm xúc · 2 bình luận',
        avatar: '/notification2.jpg',
        unread: true,
    },
    {
        id: 3,
        user: 'Bây giờ trong GIẢI ĐỀ TOEIC ETS 2024 CÙNG CÔ...',
        content: 'TỐI NAY 18G30 có Thầm sẽ có buổi dạy ONLINE...',
        time: '4 ngày · 136 cảm xúc · 10 bình luận',
        avatar: '/notification3.jpg',
        unread: true,
    },
    {
        id: 4,
        user: 'Bây giờ trong GIẢI ĐỀ TOEIC ETS 2024 CÙNG CÔ...',
        content: 'Mơ ước đầu Toeic 450 để ra trường nhưng th...',
        time: '5 ngày',
        avatar: '/notification4.jpg',
        unread: true,
    },
    {
        id: 5,
        user: 'Quản trị viên đã thay đổi quyền riêng tư của nhóm',
        content: 'GAME ONLINE ✓ từ riêng tư thành công khai.',
        time: '5 ngày',
        avatar: '/notification5.jpg',
        unread: true,
    },
];

export default function NotificationPopup() {
    return (
        <Paper
            elevation={8}
            sx={{
                position: 'absolute',
                top: 56,
                right: 0,
                width: 360,
                maxHeight: 600,
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
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="h6" fontWeight={700} color="#050505">
                        Thông báo
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
                            <SettingsIcon fontSize="small" />
                        </IconButton>
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
                    </Box>
                </Box>

                {/* Tabs */}
                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <Box
                        sx={{
                            px: 2,
                            py: 0.75,
                            borderRadius: 5,
                            bgcolor: '#e7f3ff',
                            color: '#1877f2',
                            fontSize: '15px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        Tất cả
                    </Box>
                    <Box
                        sx={{
                            px: 2,
                            py: 0.75,
                            borderRadius: 5,
                            bgcolor: '#f0f2f5',
                            color: '#65676b',
                            fontSize: '15px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: '#e4e6eb' },
                        }}
                    >
                        Chưa đọc
                    </Box>
                </Box>
            </Box>

            {/* Section Header */}
            <Box
                sx={{
                    px: 2,
                    py: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <Typography variant="body2" fontWeight={600} color="#050505">
                    Trước đó
                </Typography>
                <Typography
                    variant="body2"
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
                    Xem tất cả
                </Typography>
            </Box>

            {/* Notification List */}
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
                    {notifications.map((notification, index) => (
                        <React.Fragment key={notification.id}>
                            <ListItemButton
                                sx={{
                                    py: 1.5,
                                    px: 2,
                                    bgcolor: notification.unread ? '#e7f3ff' : 'transparent',
                                    '&:hover': {
                                        bgcolor: notification.unread ? '#d8e9ff' : '#f0f2f5',
                                    },
                                }}
                            >
                                <ListItemAvatar>
                                    <Avatar
                                        src={`https://ui-avatars.com/api/?name=User${notification.id}&background=1877f2&color=fff`}
                                        sx={{ width: 56, height: 56 }}
                                    />
                                </ListItemAvatar>
                                <ListItemText
                                    primary={
                                        <Typography
                                            fontSize={15}
                                            fontWeight={notification.unread ? 600 : 400}
                                            color="#050505"
                                            sx={{
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <strong>{notification.user}</strong> {notification.content}
                                        </Typography>
                                    }
                                    secondary={
                                        <Typography
                                            variant="body2"
                                            color="#65676b"
                                            fontSize={13}
                                            sx={{ mt: 0.5 }}
                                        >
                                            {notification.time}
                                        </Typography>
                                    }
                                />
                                {notification.unread && (
                                    <Badge
                                        badgeContent=" "
                                        sx={{
                                            ml: 1,
                                            '& .MuiBadge-badge': {
                                                backgroundColor: '#1877f2',
                                                width: 12,
                                                height: 12,
                                                borderRadius: '50%',
                                                minWidth: 12,
                                            },
                                        }}
                                    />
                                )}
                            </ListItemButton>
                            {index < notifications.length - 1 && (
                                <Divider sx={{ borderColor: '#e4e6eb', mx: 2 }} />
                            )}
                        </React.Fragment>
                    ))}
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
                    sx={{
                        color: '#65676b',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        '&:hover': {
                            textDecoration: 'underline',
                        },
                    }}
                >
                    Xem thông báo trước đó
                </Typography>
            </Box>
        </Paper>
    );
}
