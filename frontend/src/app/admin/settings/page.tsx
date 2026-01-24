'use client';

import React, { useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Stack,
    Switch,
    FormControlLabel,
    Divider,
    Button,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    useTheme,
    alpha,
    Card,
    CardContent,
    Slider,
    RadioGroup,
    Radio,
    Chip,
    IconButton,
    Tooltip
} from '@mui/material';
import {
    DarkMode as DarkModeIcon,
    LightMode as LightModeIcon,
    Language as LanguageIcon,
    Notifications as NotificationsIcon,
    Security as SecurityIcon,
    Speed as SpeedIcon,
    Save as SaveIcon,
    Restore as RestoreIcon,
    ColorLens as ColorLensIcon,
    TextFields as TextFieldsIcon,
    Visibility as VisibilityIcon,
    Email as EmailIcon,
    Palette as PaletteIcon
} from '@mui/icons-material';
import { useThemeStore } from '@/stores/useThemeStore';
import { useSettingsStore, THEME_COLORS } from '@/stores/useSettingsStore';
import { useTranslation } from 'react-i18next';

// Admin color schemes
const adminColorSchemes = [
    { id: 'blue', name: 'Xanh Facebook', primary: '#1877f2', secondary: '#42b72a' },
    { id: 'purple', name: 'Tím Galaxy', primary: '#7c3aed', secondary: '#a855f7' },
    { id: 'green', name: 'Xanh Forest', primary: '#059669', secondary: '#10b981' },
    { id: 'orange', name: 'Cam Sunset', primary: '#ea580c', secondary: '#f97316' },
    { id: 'pink', name: 'Hồng Rose', primary: '#db2777', secondary: '#ec4899' },
    { id: 'cyan', name: 'Xanh Ocean', primary: '#0891b2', secondary: '#06b6d4' },
];

export default function SettingsPage() {
    const theme = useTheme();
    const { mode, setMode } = useThemeStore();
    const isDark = theme.palette.mode === 'dark';

    const {
        themeColor, setThemeColor,
        fontSize, setFontSize,
        compactMode, toggleCompactMode,
        enableMotion: showAnimations, toggleMotion: setShowAnimations, // Map store props to existing variable names if needed, or rename usage
        language, setLanguage
    } = useSettingsStore();
    const { t, i18n } = useTranslation();

    // Local states for settings NOT in store yet
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [pushNotifications, setPushNotifications] = useState(true);
    const [soundNotifications, setSoundNotifications] = useState(false);
    const [twoFactorAuth, setTwoFactorAuth] = useState(false);
    const [sessionTimeout, setSessionTimeout] = useState(30);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [refreshInterval, setRefreshInterval] = useState(30);

    const handleLanguageChange = (lang: string) => {
        setLanguage(lang as any);
        i18n.changeLanguage(lang);
    };

    const handleSaveSettings = () => {
        // Store automatically persists, so just show success
        console.log('Settings saved');
    };

    const handleRestoreDefaults = () => {
        setLanguage('vi');
        i18n.changeLanguage('vi');
        setThemeColor('blue');
        setFontSize(14);
        if (compactMode) toggleCompactMode();
        if (!showAnimations) setShowAnimations();
    };

    const cardStyle = {
        p: 3,
        borderRadius: 3,
        bgcolor: isDark ? '#242526' : '#ffffff',
        border: `1px solid ${isDark ? '#3a3b3c' : '#e4e6eb'}`,
        boxShadow: 'none',
        mb: 3
    };

    return (
        <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
                <Box>
                    <Typography variant="h5" fontWeight="bold">Cài đặt</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Tùy chỉnh giao diện và cài đặt hệ thống admin
                    </Typography>
                </Box>
                <Stack direction="row" spacing={2}>
                    <Button
                        variant="outlined"
                        startIcon={<RestoreIcon />}
                        onClick={handleRestoreDefaults}
                    >
                        Khôi phục mặc định
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<SaveIcon />}
                        onClick={handleSaveSettings}
                    >
                        Lưu thay đổi
                    </Button>
                </Stack>
            </Stack>

            {/* Appearance Settings */}
            <Paper sx={cardStyle}>
                <Stack direction="row" alignItems="center" spacing={1} mb={3}>
                    <PaletteIcon color="primary" />
                    <Typography variant="h6" fontWeight="700">Giao diện</Typography>
                </Stack>

                {/* Theme Mode */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                        Chế độ hiển thị
                    </Typography>
                    <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                        <Card
                            onClick={() => setMode('light')}
                            sx={{
                                flex: 1,
                                cursor: 'pointer',
                                border: mode === 'light' ? '2px solid #1877f2' : `1px solid ${isDark ? '#3a3b3c' : '#e4e6eb'}`,
                                borderRadius: 2,
                                transition: 'all 0.2s',
                                '&:hover': { borderColor: '#1877f2' }
                            }}
                        >
                            <CardContent sx={{ textAlign: 'center', py: 2 }}>
                                <LightModeIcon sx={{ fontSize: 40, color: '#f7b928', mb: 1 }} />
                                <Typography variant="body2" fontWeight="600">Sáng</Typography>
                            </CardContent>
                        </Card>
                        <Card
                            onClick={() => setMode('dark')}
                            sx={{
                                flex: 1,
                                cursor: 'pointer',
                                border: mode === 'dark' ? '2px solid #1877f2' : `1px solid ${isDark ? '#3a3b3c' : '#e4e6eb'}`,
                                borderRadius: 2,
                                transition: 'all 0.2s',
                                '&:hover': { borderColor: '#1877f2' }
                            }}
                        >
                            <CardContent sx={{ textAlign: 'center', py: 2 }}>
                                <DarkModeIcon sx={{ fontSize: 40, color: '#65676b', mb: 1 }} />
                                <Typography variant="body2" fontWeight="600">Tối</Typography>
                            </CardContent>
                        </Card>
                        <Card
                            onClick={() => setMode('system')}
                            sx={{
                                flex: 1,
                                cursor: 'pointer',
                                border: mode === 'system' ? '2px solid #1877f2' : `1px solid ${isDark ? '#3a3b3c' : '#e4e6eb'}`,
                                borderRadius: 2,
                                transition: 'all 0.2s',
                                '&:hover': { borderColor: '#1877f2' }
                            }}
                        >
                            <CardContent sx={{ textAlign: 'center', py: 2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                                    <LightModeIcon sx={{ fontSize: 30, color: '#f7b928' }} />
                                    <DarkModeIcon sx={{ fontSize: 30, color: '#65676b', ml: -1 }} />
                                </Box>
                                <Typography variant="body2" fontWeight="600">Hệ thống</Typography>
                            </CardContent>
                        </Card>
                    </Stack>
                </Box>

                <Divider sx={{ my: 3 }} />

                {/* Admin Color Scheme */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                        Màu chủ đạo Admin
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
                        {adminColorSchemes.map((scheme) => (
                            <Tooltip key={scheme.id} title={scheme.name}>
                                <Box
                                    onClick={() => setThemeColor(scheme.id as any)}
                                    sx={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 2,
                                        background: `linear-gradient(135deg, ${scheme.primary} 50%, ${scheme.secondary} 50%)`,
                                        cursor: 'pointer',
                                        border: themeColor === scheme.id
                                            ? '3px solid white'
                                            : '2px solid transparent',
                                        boxShadow: themeColor === scheme.id
                                            ? `0 0 0 2px ${scheme.primary}`
                                            : 'none',
                                        transition: 'all 0.2s',
                                        '&:hover': {
                                            transform: 'scale(1.1)'
                                        }
                                    }}
                                />
                            </Tooltip>
                        ))}
                    </Stack>
                </Box>

                <Divider sx={{ my: 3 }} />

                {/* Font Size */}
                <Box sx={{ mb: 3 }}>
                    <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                        <TextFieldsIcon fontSize="small" />
                        <Typography variant="subtitle2" fontWeight="600">
                            Cỡ chữ: {fontSize}px
                        </Typography>
                    </Stack>
                    <Slider
                        value={fontSize}
                        onChange={(e, v) => setFontSize(v as number)}
                        min={12}
                        max={18}
                        step={1}
                        marks={[
                            { value: 12, label: '12' },
                            { value: 14, label: '14' },
                            { value: 16, label: '16' },
                            { value: 18, label: '18' },
                        ]}
                        sx={{ maxWidth: 300 }}
                    />
                </Box>

                {/* Other appearance options */}
                <Stack spacing={2}>
                    <FormControlLabel
                        control={<Switch checked={compactMode} onChange={toggleCompactMode} />}
                        label={
                            <Box>
                                <Typography variant="body2" fontWeight="500">Chế độ gọn</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Giảm khoảng cách giữa các phần tử
                                </Typography>
                            </Box>
                        }
                    />
                    <FormControlLabel
                        control={<Switch checked={showAnimations} onChange={setShowAnimations} />}
                        label={
                            <Box>
                                <Typography variant="body2" fontWeight="500">Hiệu ứng động</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Bật/tắt hiệu ứng chuyển động
                                </Typography>
                            </Box>
                        }
                    />
                </Stack>
            </Paper>

            {/* Language Settings */}
            <Paper sx={cardStyle}>
                <Stack direction="row" alignItems="center" spacing={1} mb={3}>
                    <LanguageIcon color="primary" />
                    <Typography variant="h6" fontWeight="700">Ngôn ngữ & Khu vực</Typography>
                </Stack>

                <FormControl sx={{ minWidth: 250 }}>
                    <InputLabel>Ngôn ngữ hiển thị</InputLabel>
                    <Select
                        value={language}
                        label="Ngôn ngữ hiển thị"
                        onChange={(e) => handleLanguageChange(e.target.value)}
                    >
                        <MenuItem value="vi">🇻🇳 Tiếng Việt</MenuItem>
                        <MenuItem value="en">🇺🇸 English</MenuItem>
                        <MenuItem value="ja">🇯🇵 日本語</MenuItem>
                        <MenuItem value="ko">🇰🇷 한국어</MenuItem>
                        <MenuItem value="zh">🇨🇳 中文</MenuItem>
                    </Select>
                </FormControl>
            </Paper>

            {/* Notification Settings */}
            <Paper sx={cardStyle}>
                <Stack direction="row" alignItems="center" spacing={1} mb={3}>
                    <NotificationsIcon color="primary" />
                    <Typography variant="h6" fontWeight="700">Thông báo</Typography>
                </Stack>

                <Stack spacing={2}>
                    <FormControlLabel
                        control={<Switch checked={emailNotifications} onChange={(e) => setEmailNotifications(e.target.checked)} />}
                        label={
                            <Box>
                                <Typography variant="body2" fontWeight="500">Thông báo Email</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Nhận email khi có báo cáo mới hoặc sự cố
                                </Typography>
                            </Box>
                        }
                    />
                    <FormControlLabel
                        control={<Switch checked={pushNotifications} onChange={(e) => setPushNotifications(e.target.checked)} />}
                        label={
                            <Box>
                                <Typography variant="body2" fontWeight="500">Push Notification</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Nhận thông báo đẩy trên trình duyệt
                                </Typography>
                            </Box>
                        }
                    />
                    <FormControlLabel
                        control={<Switch checked={soundNotifications} onChange={(e) => setSoundNotifications(e.target.checked)} />}
                        label={
                            <Box>
                                <Typography variant="body2" fontWeight="500">Âm thanh thông báo</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Phát âm thanh khi có thông báo mới
                                </Typography>
                            </Box>
                        }
                    />
                </Stack>
            </Paper>

            {/* Security Settings */}
            <Paper sx={cardStyle}>
                <Stack direction="row" alignItems="center" spacing={1} mb={3}>
                    <SecurityIcon color="primary" />
                    <Typography variant="h6" fontWeight="700">Bảo mật</Typography>
                </Stack>

                <Stack spacing={3}>
                    <FormControlLabel
                        control={<Switch checked={twoFactorAuth} onChange={(e) => setTwoFactorAuth(e.target.checked)} />}
                        label={
                            <Box>
                                <Typography variant="body2" fontWeight="500">Xác thực 2 bước (2FA)</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Yêu cầu mã xác thực khi đăng nhập
                                </Typography>
                            </Box>
                        }
                    />

                    <Box>
                        <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                            Thời gian hết phiên: {sessionTimeout} phút
                        </Typography>
                        <Slider
                            value={sessionTimeout}
                            onChange={(e, v) => setSessionTimeout(v as number)}
                            min={15}
                            max={120}
                            step={15}
                            marks={[
                                { value: 15, label: '15' },
                                { value: 30, label: '30' },
                                { value: 60, label: '60' },
                                { value: 120, label: '120' },
                            ]}
                            sx={{ maxWidth: 400 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                            Tự động đăng xuất sau thời gian không hoạt động
                        </Typography>
                    </Box>
                </Stack>
            </Paper>

            {/* Performance Settings */}
            <Paper sx={cardStyle}>
                <Stack direction="row" alignItems="center" spacing={1} mb={3}>
                    <SpeedIcon color="primary" />
                    <Typography variant="h6" fontWeight="700">Hiệu suất</Typography>
                </Stack>

                <Stack spacing={3}>
                    <FormControlLabel
                        control={<Switch checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />}
                        label={
                            <Box>
                                <Typography variant="body2" fontWeight="500">Tự động làm mới dữ liệu</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Cập nhật thống kê và danh sách tự động
                                </Typography>
                            </Box>
                        }
                    />

                    {autoRefresh && (
                        <Box>
                            <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                                Tần suất làm mới: {refreshInterval} giây
                            </Typography>
                            <Slider
                                value={refreshInterval}
                                onChange={(e, v) => setRefreshInterval(v as number)}
                                min={10}
                                max={120}
                                step={10}
                                marks={[
                                    { value: 10, label: '10s' },
                                    { value: 30, label: '30s' },
                                    { value: 60, label: '60s' },
                                    { value: 120, label: '120s' },
                                ]}
                                sx={{ maxWidth: 400 }}
                            />
                        </Box>
                    )}
                </Stack>
            </Paper>
        </Box>
    );
}
