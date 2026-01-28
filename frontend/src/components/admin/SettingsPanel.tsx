import React, { useEffect, useState } from 'react';
import {
    Drawer,
    Box,
    Typography,
    IconButton,
    Stack,
    Slider,
    Switch,
    FormControlLabel,
    Divider,
    Button,
    useTheme,
    alpha,
    Tooltip
} from '@mui/material';
import {
    Close as CloseIcon,
    FormatSize as FormatSizeIcon,
    Palette as PaletteIcon,
    Settings as SettingsIcon,
    Language as LanguageIcon,
    Animation as AnimationIcon,
    Compress as CompressIcon
} from '@mui/icons-material';
import { useSettingsStore, THEME_COLORS, ThemeColor } from '@/stores/useSettingsStore';
import { useTranslation } from 'react-i18next';
import { themeService, Theme } from '@/services/theme.service';
import { useThemeStore } from '@/stores/useThemeStore';
import { toast } from 'sonner';

interface SettingsPanelProps {
    open: boolean;
    onClose: () => void;
}

export default function SettingsPanel({ open, onClose }: SettingsPanelProps) {
    const theme = useTheme();
    const { t, i18n } = useTranslation();

    // Admin settings store (local UI preferences)
    const {
        fontSize, setFontSize,
        compactMode, toggleCompactMode,
        enableMotion, toggleMotion,
        language, setLanguage,
        // We might not need setThemeColor anymore if we rely on global theme, 
        // but keeping it for backward compat if needed or removing it from UI
    } = useSettingsStore();

    // Global theme store (colors from backend)
    const { customTheme, setCustomTheme } = useThemeStore();
    const [themes, setThemes] = useState<Theme[]>([]);

    // Fetch themes from backend when drawer opens
    useEffect(() => {
        const fetchThemes = async () => {
            try {
                const response = await themeService.getAllThemes();
                // Handle response unwrapping
                const data = (response as any).data || response;
                if (Array.isArray(data)) {
                    setThemes(data);
                }
            } catch (error) {
                console.error("Failed to fetch themes", error);
            }
        };

        if (open) {
            fetchThemes();
        }
    }, [open]);

    // Handle theme selection
    const handleThemeChange = async (selectedTheme: Theme) => {
        try {
            await themeService.setActiveTheme(selectedTheme._id);
            setCustomTheme(selectedTheme);
            toast.success(t('settings.theme_updated'));
            // useSettingsStore.getState().setThemeColor('custom'); // optional if we wanted to track "custom" in local store
        } catch (error) {
            console.error("Failed to set active theme", error);
            toast.error(t('settings.theme_update_failed'));
        }
    };

    const handleChangeLanguage = (lang: 'vi' | 'en') => {
        setLanguage(lang);
        i18n.changeLanguage(lang);
    };

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    width: 320,
                    p: 0,
                    backdropFilter: 'blur(10px)',
                    backgroundColor: alpha(theme.palette.background.paper, 0.9)
                }
            }}
        >
            {/* Header */}
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="h6" fontWeight="bold">
                    {t('settings.title')}
                </Typography>
                <IconButton onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </Box>

            <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 4 }}>

                {/* Theme Color - Dynamic from Backend */}
                <Box>
                    <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                        {t('settings.theme_color_admin')}
                    </Typography>
                    <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                        {themes.map((themeItem) => (
                            <Tooltip key={themeItem._id} title={themeItem.name || 'Theme'}>
                                <Box
                                    onClick={() => handleThemeChange(themeItem)}
                                    sx={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: '50%',
                                        bgcolor: themeItem.primaryColor,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: (customTheme?._id === themeItem._id) ? '3px solid white' : '2px solid transparent',
                                        boxShadow: (customTheme?._id === themeItem._id)
                                            ? `0 0 0 2px ${themeItem.primaryColor}`
                                            : '0 2px 4px rgba(0,0,0,0.1)',
                                        transition: 'all 0.2s',
                                        '&:hover': { transform: 'scale(1.1)' }
                                    }}
                                >
                                    {(customTheme?._id === themeItem._id) && (
                                        <Box sx={{ width: 10, height: 10, bgcolor: 'white', borderRadius: '50%' }} />
                                    )}
                                </Box>
                            </Tooltip>
                        ))}
                        {themes.length === 0 && (
                            <Typography variant="caption" color="text.secondary">
                                Loading themes...
                            </Typography>
                        )}
                    </Stack>
                </Box>

                {/* Font Size */}
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <FormatSizeIcon fontSize="small" color="action" />
                        <Typography variant="subtitle2" fontWeight="600">
                            {t('settings.font_size')}: {fontSize}px
                        </Typography>
                    </Box>
                    <Slider
                        value={fontSize}
                        min={12}
                        max={18}
                        step={1}
                        marks={[
                            { value: 12, label: '12' },
                            { value: 14, label: '14' },
                            { value: 16, label: '16' },
                            { value: 18, label: '18' },
                        ]}
                        onChange={(_, val) => setFontSize(val as number)}
                        sx={{ color: theme.palette.primary.main }}
                    />
                </Box>

                <Divider />

                {/* Compact Mode */}
                <Box>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={compactMode}
                                onChange={toggleCompactMode}
                                sx={{
                                    '& .MuiSwitch-switchBase.Mui-checked': {
                                        color: theme.palette.primary.main,
                                        '& + .MuiSwitch-track': { backgroundColor: theme.palette.primary.main }
                                    }
                                }}
                            />
                        }
                        label={
                            <Box>
                                <Typography variant="subtitle2" fontWeight="600">{t('settings.compact_mode')}</Typography>
                                <Typography variant="caption" color="text.secondary">{t('settings.compact_mode_desc')}</Typography>
                            </Box>
                        }
                    />
                </Box>

                {/* Motion */}
                <Box>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={enableMotion}
                                onChange={toggleMotion}
                                sx={{
                                    '& .MuiSwitch-switchBase.Mui-checked': {
                                        color: theme.palette.primary.main,
                                        '& + .MuiSwitch-track': { backgroundColor: theme.palette.primary.main }
                                    }
                                }}
                            />
                        }
                        label={
                            <Box>
                                <Typography variant="subtitle2" fontWeight="600">{t('settings.motion')}</Typography>
                                <Typography variant="caption" color="text.secondary">{t('settings.motion_desc')}</Typography>
                            </Box>
                        }
                    />
                </Box>

                <Divider />

                {/* Language */}
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <LanguageIcon fontSize="small" color="action" />
                        <Typography variant="subtitle2" fontWeight="600">
                            {t('settings.language')}
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                        <Button
                            variant={language === 'vi' ? 'contained' : 'outlined'}
                            onClick={() => handleChangeLanguage('vi')}
                            fullWidth
                            sx={{
                                bgcolor: language === 'vi' ? theme.palette.primary.main : 'transparent',
                                borderColor: language === 'vi' ? theme.palette.primary.main : 'inherit',
                                color: language === 'vi' ? 'white' : 'inherit',
                                '&:hover': {
                                    bgcolor: language === 'vi' ? alpha(theme.palette.primary.main, 0.9) : alpha(theme.palette.primary.main, 0.1),
                                    borderColor: theme.palette.primary.main
                                }
                            }}
                        >
                            {t('settings.language_vi')}
                        </Button>
                        <Button
                            variant={language === 'en' ? 'contained' : 'outlined'}
                            onClick={() => handleChangeLanguage('en')}
                            fullWidth
                            sx={{
                                bgcolor: language === 'en' ? theme.palette.primary.main : 'transparent',
                                borderColor: language === 'en' ? theme.palette.primary.main : 'inherit',
                                color: language === 'en' ? 'white' : 'inherit',
                                '&:hover': {
                                    bgcolor: language === 'en' ? alpha(theme.palette.primary.main, 0.9) : alpha(theme.palette.primary.main, 0.1),
                                    borderColor: theme.palette.primary.main
                                }
                            }}
                        >
                            {t('settings.language_en')}
                        </Button>
                    </Stack>
                </Box>
            </Box>
        </Drawer>
    );
}
