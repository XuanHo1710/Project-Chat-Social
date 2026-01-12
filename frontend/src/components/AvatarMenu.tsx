'use client';

import React, { useState } from 'react';
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
    Radio,
    RadioGroup,
    FormControlLabel,
    IconButton,
    useTheme,
} from '@mui/material';
import {
    Settings as SettingsIcon,
    Feedback as FeedbackIcon,
    Logout as LogoutIcon,
    KeyboardArrowRight as ArrowRightIcon,
    ArrowBack as ArrowBackIcon,
    DarkMode as DarkModeIcon,
    LightMode as LightModeIcon,
    TextFields as TextFieldsIcon,
    HelpOutline as HelpIcon,
} from '@mui/icons-material';
import { useAuthStore } from '@/stores/useAuthStore';
import { useThemeStore, ThemeMode, FontSize } from '@/stores/useThemeStore';
import { authService } from '@/services/auth.service';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { CLIENT_PATH } from '@/constants/paths';

interface AvatarMenuProps {
    onClose: () => void;
}

type MenuPanel = 'main' | 'display';

export default function AvatarMenu({ onClose }: AvatarMenuProps) {
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const router = useRouter();
    const muiTheme = useTheme();
    const isDark = muiTheme.palette.mode === 'dark';

    const [activePanel, setActivePanel] = useState<MenuPanel>('main');

    // Theme store
    const { mode, fontSize, setMode, setFontSize, actualTheme } = useThemeStore();

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

    const handleViewProfile = () => {
        onClose();
        if (user?.username) {
            router.push(CLIENT_PATH.PROFILE_BY_USERNAME(user.username));
        }
    };

    const handleOpenSettings = () => {
        onClose();
        router.push('/settings');
    };

    const handleOpenDisplaySettings = () => {
        setActivePanel('display');
    };

    const handleBackToMain = () => {
        setActivePanel('main');
    };

    const handleThemeChange = (newMode: ThemeMode) => {
        setMode(newMode);
    };

    const handleFontSizeChange = (newSize: FontSize) => {
        setFontSize(newSize);
    };

    const iconBoxStyle = {
        width: 36,
        height: 36,
        borderRadius: '50%',
        bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    };

    // Main Menu Panel
    const MainMenuPanel = () => (
        <Box>
            {/* User Profile Section */}
            <Box sx={{ p: 2, boxShadow: 1 }}>
                <Box
                    onClick={handleViewProfile}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1,
                        borderRadius: 2,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                    }}
                >
                    <Avatar
                        src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.username || 'User'}&background=1877f2&color=fff`}
                        sx={{ width: 60, height: 60 }}
                    />
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" fontWeight={600} color="text.primary">
                            {user?.fullName || user?.username}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Xem trang cá nhân của bạn
                        </Typography>
                    </Box>
                </Box>
            </Box>

            <Divider />

            {/* Menu Items */}
            <List disablePadding sx={{ py: 1 }}>
                <ListItemButton onClick={handleOpenSettings} sx={{ py: 1.5, px: 2 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                        <Box sx={iconBoxStyle}>
                            <SettingsIcon sx={{ fontSize: 20, color: 'text.primary' }} />
                        </Box>
                    </ListItemIcon>
                    <ListItemText primary="Cài đặt và quyền riêng tư" primaryTypographyProps={{ fontSize: '15px', fontWeight: 500, color: 'text.primary' }} />
                    <ArrowRightIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                </ListItemButton>

                <ListItemButton sx={{ py: 1.5, px: 2 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                        <Box sx={iconBoxStyle}>
                            <HelpIcon sx={{ fontSize: 20, color: 'text.primary' }} />
                        </Box>
                    </ListItemIcon>
                    <ListItemText primary="Trợ giúp và hỗ trợ" primaryTypographyProps={{ fontSize: '15px', fontWeight: 500, color: 'text.primary' }} />
                    <ArrowRightIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                </ListItemButton>

                <ListItemButton onClick={handleOpenDisplaySettings} sx={{ py: 1.5, px: 2 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                        <Box sx={iconBoxStyle}>
                            {actualTheme === 'dark' ? (
                                <DarkModeIcon sx={{ fontSize: 20, color: 'text.primary' }} />
                            ) : (
                                <LightModeIcon sx={{ fontSize: 20, color: 'text.primary' }} />
                            )}
                        </Box>
                    </ListItemIcon>
                    <ListItemText primary="Màn hình và trợ năng" primaryTypographyProps={{ fontSize: '15px', fontWeight: 500, color: 'text.primary' }} />
                    <ArrowRightIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                </ListItemButton>

                <ListItemButton sx={{ py: 1.5, px: 2 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                        <Box sx={iconBoxStyle}>
                            <FeedbackIcon sx={{ fontSize: 20, color: 'text.primary' }} />
                        </Box>
                    </ListItemIcon>
                    <ListItemText primary="Đóng góp ý kiến" primaryTypographyProps={{ fontSize: '15px', fontWeight: 500, color: 'text.primary' }} />
                    <ArrowRightIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                </ListItemButton>

                <ListItemButton onClick={handleLogout} sx={{ py: 1.5, px: 2 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                        <Box sx={iconBoxStyle}>
                            <LogoutIcon sx={{ fontSize: 20, color: 'text.primary' }} />
                        </Box>
                    </ListItemIcon>
                    <ListItemText primary="Đăng xuất" primaryTypographyProps={{ fontSize: '15px', fontWeight: 500, color: 'text.primary' }} />
                </ListItemButton>
            </List>

            {/* Footer */}
            <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
                <Typography variant="caption" color="text.secondary" fontSize={11}>
                    Quyền riêng tư · Điều khoản · Quảng cáo · Lựa chọn quảng cáo · Cookie · Xem thêm · Meta © 2025
                </Typography>
            </Box>
        </Box>
    );

    // Display Settings Panel
    const DisplaySettingsPanel = () => (
        <Box>
            {/* Header with back button */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <IconButton onClick={handleBackToMain} size="small">
                    <ArrowBackIcon sx={{ color: 'text.primary' }} />
                </IconButton>
                <Typography variant="h6" fontWeight={700} color="text.primary">
                    Màn hình và trợ năng
                </Typography>
            </Box>

            {/* Dark Mode Section */}
            <Box sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                    <Box sx={{ ...iconBoxStyle, bgcolor: 'action.hover' }}>
                        <DarkModeIcon sx={{ fontSize: 20, color: 'text.primary' }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" fontWeight={600} color="text.primary">
                            Chế độ tối
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Điều chỉnh giao diện của ứng dụng để giảm độ chói và cho đôi mắt được nghỉ ngơi.
                        </Typography>

                        <RadioGroup value={mode} onChange={(e) => handleThemeChange(e.target.value as ThemeMode)}>
                            <FormControlLabel
                                value="light"
                                control={<Radio size="small" />}
                                label={<Typography color="text.primary" fontSize={15}>Tắt</Typography>}
                                sx={{ mb: 0.5 }}
                            />
                            <FormControlLabel
                                value="dark"
                                control={<Radio size="small" />}
                                label={<Typography color="text.primary" fontSize={15}>Bật</Typography>}
                                sx={{ mb: 0.5 }}
                            />
                            <Box>
                                <FormControlLabel
                                    value="system"
                                    control={<Radio size="small" />}
                                    label={<Typography color="text.primary" fontSize={15}>Tự động</Typography>}
                                />
                                <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mt: -0.5 }}>
                                    Chúng tôi sẽ tự động điều chỉnh màn hình theo cài đặt hệ thống trên thiết bị của bạn.
                                </Typography>
                            </Box>
                        </RadioGroup>
                    </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Compact Mode Section */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Box sx={{ ...iconBoxStyle, bgcolor: 'action.hover' }}>
                        <TextFieldsIcon sx={{ fontSize: 20, color: 'text.primary' }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" fontWeight={600} color="text.primary">
                            Chế độ Thu gọn
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Giảm kích thước phông chữ để có thêm nội dung vừa với màn hình.
                        </Typography>

                        <RadioGroup value={fontSize} onChange={(e) => handleFontSizeChange(e.target.value as FontSize)}>
                            <FormControlLabel
                                value="normal"
                                control={<Radio size="small" />}
                                label={<Typography color="text.primary" fontSize={15}>Tắt</Typography>}
                                sx={{ mb: 0.5 }}
                            />
                            <FormControlLabel
                                value="compact"
                                control={<Radio size="small" />}
                                label={<Typography color="text.primary" fontSize={15}>Bật</Typography>}
                            />
                        </RadioGroup>
                    </Box>
                </Box>
            </Box>
        </Box>
    );

    return (
        <Paper
            elevation={8}
            sx={{
                position: 'absolute',
                top: 56,
                right: 0,
                width: 360,
                borderRadius: 2,
                overflow: 'hidden',
                zIndex: 1300,
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    width: '200%',
                    transform: activePanel === 'main' ? 'translateX(0)' : 'translateX(-50%)',
                    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            >
                <Box sx={{ width: '50%', flexShrink: 0 }}>
                    <MainMenuPanel />
                </Box>
                <Box sx={{ width: '50%', flexShrink: 0 }}>
                    <DisplaySettingsPanel />
                </Box>
            </Box>
        </Paper>
    );
}
