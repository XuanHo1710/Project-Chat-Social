'use client';

import React from 'react';
import {
    Box,
    Paper,
    Typography,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Divider,
    Avatar,
} from '@mui/material';
import {
    Person as PersonIcon,
    Settings as SettingsIcon,
    Feedback as FeedbackIcon,
    Logout as LogoutIcon,
    KeyboardArrowRight as ArrowRightIcon,
} from '@mui/icons-material';
import { useAuthStore } from '@/stores/useAuthStore';
import { authService } from '@/services/auth.service';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { CLIENT_PATH } from '@/constants/paths';

interface AvatarMenuProps {
    onClose: () => void;
}

export default function AvatarMenu({ onClose }: AvatarMenuProps) {
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const router = useRouter();

    const handleLogout = async () => {
        onClose();
        const response = await authService.logout();
        if (response.statusCode === 201) {
            logout();
            toast.success('Đã đăng xuất thành công!');
            router.push(CLIENT_PATH.LOGIN);
        } else {
            toast.error('Đăng xuất thất bại. Vui lòng thử lại.');
        }
    };

    return (
        <Paper
            elevation={8}
            sx={{
                position: 'absolute',
                top: 56,
                right: 0,
                width: 360,
                bgcolor: 'white',
                borderRadius: 2,
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                zIndex: 1300,
            }}
        >
            {/* User Profile Section */}
            <Box
                sx={{
                    p: 2,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1,
                        borderRadius: 2,
                        cursor: 'pointer',
                        '&:hover': {
                            bgcolor: '#f0f2f5',
                        },
                    }}
                >
                    <Avatar
                        src={
                            user?.avatar ||
                            `https://ui-avatars.com/api/?name=${user?.username || 'User'}&background=1877f2&color=fff`
                        }
                        sx={{ width: 60, height: 60 }}
                    />
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" fontWeight={600} color="#050505">
                            {user?.fullName || user?.username}
                        </Typography>
                        <Typography variant="body2" color="#65676b">
                            Xem trang cá nhân của bạn
                        </Typography>
                    </Box>
                </Box>
            </Box>

            <Divider />

            {/* Menu Items */}
            <List disablePadding sx={{ py: 1 }}>
                <ListItemButton
                    sx={{
                        py: 1.5,
                        px: 2,
                        '&:hover': {
                            bgcolor: '#f0f2f5',
                        },
                    }}
                >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                        <Box
                            sx={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                bgcolor: '#e4e6eb',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <SettingsIcon sx={{ fontSize: 20, color: '#050505' }} />
                        </Box>
                    </ListItemIcon>
                    <ListItemText
                        primary="Cài đặt và quyền riêng tư"
                        primaryTypographyProps={{
                            fontSize: '15px',
                            fontWeight: 500,
                            color: '#050505',
                        }}
                    />
                    <ArrowRightIcon sx={{ color: '#65676b', fontSize: 20 }} />
                </ListItemButton>

                <ListItemButton
                    sx={{
                        py: 1.5,
                        px: 2,
                        '&:hover': {
                            bgcolor: '#f0f2f5',
                        },
                    }}
                >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                        <Box
                            sx={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                bgcolor: '#e4e6eb',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <FeedbackIcon sx={{ fontSize: 20, color: '#050505' }} />
                        </Box>
                    </ListItemIcon>
                    <ListItemText
                        primary="Trợ giúp và hỗ trợ"
                        primaryTypographyProps={{
                            fontSize: '15px',
                            fontWeight: 500,
                            color: '#050505',
                        }}
                    />
                    <ArrowRightIcon sx={{ color: '#65676b', fontSize: 20 }} />
                </ListItemButton>

                <ListItemButton
                    sx={{
                        py: 1.5,
                        px: 2,
                        '&:hover': {
                            bgcolor: '#f0f2f5',
                        },
                    }}
                >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                        <Box
                            sx={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                bgcolor: '#e4e6eb',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <PersonIcon sx={{ fontSize: 20, color: '#050505' }} />
                        </Box>
                    </ListItemIcon>
                    <ListItemText
                        primary="Màn hình và trợ năng"
                        primaryTypographyProps={{
                            fontSize: '15px',
                            fontWeight: 500,
                            color: '#050505',
                        }}
                    />
                    <ArrowRightIcon sx={{ color: '#65676b', fontSize: 20 }} />
                </ListItemButton>

                <ListItemButton
                    sx={{
                        py: 1.5,
                        px: 2,
                        '&:hover': {
                            bgcolor: '#f0f2f5',
                        },
                    }}
                >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                        <Box
                            sx={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                bgcolor: '#e4e6eb',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <FeedbackIcon sx={{ fontSize: 20, color: '#050505' }} />
                        </Box>
                    </ListItemIcon>
                    <ListItemText
                        primary="Đóng góp ý kiến"
                        primaryTypographyProps={{
                            fontSize: '15px',
                            fontWeight: 500,
                            color: '#050505',
                        }}
                    />
                    <ArrowRightIcon sx={{ color: '#65676b', fontSize: 20 }} />
                </ListItemButton>

                <ListItemButton
                    onClick={handleLogout}
                    sx={{
                        py: 1.5,
                        px: 2,
                        '&:hover': {
                            bgcolor: '#f0f2f5',
                        },
                    }}
                >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                        <Box
                            sx={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                bgcolor: '#e4e6eb',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <LogoutIcon sx={{ fontSize: 20, color: '#050505' }} />
                        </Box>
                    </ListItemIcon>
                    <ListItemText
                        primary="Đăng xuất"
                        primaryTypographyProps={{
                            fontSize: '15px',
                            fontWeight: 500,
                            color: '#050505',
                        }}
                    />
                </ListItemButton>
            </List>

            {/* Footer */}
            <Box sx={{ p: 2, bgcolor: '#f0f2f5' }}>
                <Typography variant="caption" color="#65676b" fontSize={11}>
                    Quyền riêng tư · Điều khoản · Quảng cáo · Lựa chọn quảng cáo · Cookie · Xem thêm · Meta © 2025
                </Typography>
            </Box>
        </Paper>
    );
}
