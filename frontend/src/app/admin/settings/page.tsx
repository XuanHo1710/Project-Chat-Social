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
const adminColorSchemeKeys = [
    { id: 'blue', nameKey: 'admin.color_blue', primary: '#1877f2', secondary: '#42b72a' },
    { id: 'purple', nameKey: 'admin.color_purple', primary: '#7c3aed', secondary: '#a855f7' },
    { id: 'green', nameKey: 'admin.color_green', primary: '#059669', secondary: '#10b981' },
    { id: 'orange', nameKey: 'admin.color_orange', primary: '#ea580c', secondary: '#f97316' },
    { id: 'pink', nameKey: 'admin.color_pink', primary: '#db2777', secondary: '#ec4899' },
    { id: 'cyan', nameKey: 'admin.color_cyan', primary: '#0891b2', secondary: '#06b6d4' },
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
                    <Typography variant="h5" fontWeight="bold">{t('admin.settings_title')}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {t('admin.settings_subtitle')}
                    </Typography>
                </Box>
                <Stack direction="row" spacing={2}>
                    <Button
                        variant="outlined"
                        startIcon={<RestoreIcon />}
                        onClick={handleRestoreDefaults}
                    >
                        {t('admin.restore_defaults')}
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<SaveIcon />}
                        onClick={handleSaveSettings}
                    >
                        {t('admin.save_changes')}
                    </Button>
                </Stack>
            </Stack>

            {/* Appearance Settings */}
            <Paper sx={cardStyle}>
                <Stack direction="row" alignItems="center" spacing={1} mb={3}>
                    <PaletteIcon color="primary" />
                    <Typography variant="h6" fontWeight="700">{t('admin.appearance')}</Typography>
                </Stack>

                {/* Theme Mode */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                        {t('admin.display_mode')}
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
                                <Typography variant="body2" fontWeight="600">{t('admin.light_mode')}</Typography>
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
                                <Typography variant="body2" fontWeight="600">{t('admin.dark_mode')}</Typography>
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
                                <Typography variant="body2" fontWeight="600">{t('admin.system_mode')}</Typography>
                            </CardContent>
                        </Card>
                    </Stack>
                </Box>

                <Divider sx={{ my: 3 }} />

                {/* Admin Color Scheme */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                        {t('admin.admin_color_scheme')}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
                        {adminColorSchemeKeys.map((scheme) => (
                            <Tooltip key={scheme.id} title={t(scheme.nameKey)}>
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
                            {t('admin.font_size')}: {fontSize}px
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
                                <Typography variant="body2" fontWeight="500">{t('admin.compact_mode')}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {t('admin.compact_mode_desc')}
                                </Typography>
                            </Box>
                        }
                    />
                    <FormControlLabel
                        control={<Switch checked={showAnimations} onChange={setShowAnimations} />}
                        label={
                            <Box>
                                <Typography variant="body2" fontWeight="500">{t('admin.enable_animations')}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {t('admin.enable_animations_desc')}
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
                    <Typography variant="h6" fontWeight="700">{t('admin.language_region')}</Typography>
                </Stack>

                <FormControl sx={{ minWidth: 250 }}>
                    <InputLabel>{t('admin.display_language')}</InputLabel>
                    <Select
                        value={language}
                        label={t('admin.display_language')}
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
                    <Typography variant="h6" fontWeight="700">{t('admin.notifications')}</Typography>
                </Stack>

                <Stack spacing={2}>
                    <FormControlLabel
                        control={<Switch checked={emailNotifications} onChange={(e) => setEmailNotifications(e.target.checked)} />}
                        label={
                            <Box>
                                <Typography variant="body2" fontWeight="500">{t('admin.email_notifications')}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {t('admin.email_notifications_desc')}
                                </Typography>
                            </Box>
                        }
                    />
                    <FormControlLabel
                        control={<Switch checked={pushNotifications} onChange={(e) => setPushNotifications(e.target.checked)} />}
                        label={
                            <Box>
                                <Typography variant="body2" fontWeight="500">{t('admin.push_notifications')}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {t('admin.push_notifications_desc')}
                                </Typography>
                            </Box>
                        }
                    />
                    <FormControlLabel
                        control={<Switch checked={soundNotifications} onChange={(e) => setSoundNotifications(e.target.checked)} />}
                        label={
                            <Box>
                                <Typography variant="body2" fontWeight="500">{t('admin.sound_notifications')}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {t('admin.sound_notifications_desc')}
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
                    <Typography variant="h6" fontWeight="700">{t('admin.security')}</Typography>
                </Stack>

                <Stack spacing={3}>
                    <FormControlLabel
                        control={<Switch checked={twoFactorAuth} onChange={(e) => setTwoFactorAuth(e.target.checked)} />}
                        label={
                            <Box>
                                <Typography variant="body2" fontWeight="500">{t('admin.two_factor_auth')}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {t('admin.two_factor_auth_desc')}
                                </Typography>
                            </Box>
                        }
                    />

                    <Box>
                        <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                            {t('admin.session_timeout', { minutes: sessionTimeout })}
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
                            {t('admin.auto_logout_desc')}
                        </Typography>
                    </Box>
                </Stack>
            </Paper>

            {/* Performance Settings */}
            <Paper sx={cardStyle}>
                <Stack direction="row" alignItems="center" spacing={1} mb={3}>
                    <SpeedIcon color="primary" />
                    <Typography variant="h6" fontWeight="700">{t('admin.performance')}</Typography>
                </Stack>

                <Stack spacing={3}>
                    <FormControlLabel
                        control={<Switch checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />}
                        label={
                            <Box>
                                <Typography variant="body2" fontWeight="500">{t('admin.auto_refresh')}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {t('admin.auto_refresh_desc')}
                                </Typography>
                            </Box>
                        }
                    />

                    {autoRefresh && (
                        <Box>
                            <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                                {t('admin.refresh_interval', { seconds: refreshInterval })}
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
