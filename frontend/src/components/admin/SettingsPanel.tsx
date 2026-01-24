import React from 'react';
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
    alpha
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

interface SettingsPanelProps {
    open: boolean;
    onClose: () => void;
}

export default function SettingsPanel({ open, onClose }: SettingsPanelProps) {
    const theme = useTheme();
    const { t, i18n } = useTranslation();
    const {
        themeColor, setThemeColor,
        fontSize, setFontSize,
        compactMode, toggleCompactMode,
        enableMotion, toggleMotion,
        language, setLanguage
    } = useSettingsStore();

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

                {/* Theme Color */}
                <Box>
                    <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                        {t('settings.theme_color_admin')}
                    </Typography>
                    <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                        {(Object.keys(THEME_COLORS) as ThemeColor[]).map((color) => (
                            <Box
                                key={color}
                                onClick={() => setThemeColor(color)}
                                sx={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: '50%',
                                    bgcolor: THEME_COLORS[color],
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: color === themeColor ? '3px solid white' : 'none',
                                    boxShadow: color === themeColor ? `0 0 0 2px ${THEME_COLORS[color]}` : 'none',
                                    transition: 'all 0.2s',
                                    '&:hover': { transform: 'scale(1.1)' }
                                }}
                            >
                                {color === themeColor && <Box sx={{ width: 10, height: 10, bgcolor: 'white', borderRadius: '50%' }} />}
                            </Box>
                        ))}
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
                        sx={{ color: THEME_COLORS[themeColor] }}
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
                                        color: THEME_COLORS[themeColor],
                                        '& + .MuiSwitch-track': { backgroundColor: THEME_COLORS[themeColor] }
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
                                        color: THEME_COLORS[themeColor],
                                        '& + .MuiSwitch-track': { backgroundColor: THEME_COLORS[themeColor] }
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
                                bgcolor: language === 'vi' ? THEME_COLORS[themeColor] : 'transparent',
                                borderColor: language === 'vi' ? THEME_COLORS[themeColor] : 'inherit',
                                color: language === 'vi' ? 'white' : 'inherit',
                                '&:hover': {
                                    bgcolor: language === 'vi' ? alpha(THEME_COLORS[themeColor], 0.9) : alpha(THEME_COLORS[themeColor], 0.1),
                                    borderColor: THEME_COLORS[themeColor]
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
                                bgcolor: language === 'en' ? THEME_COLORS[themeColor] : 'transparent',
                                borderColor: language === 'en' ? THEME_COLORS[themeColor] : 'inherit',
                                color: language === 'en' ? 'white' : 'inherit',
                                '&:hover': {
                                    bgcolor: language === 'en' ? alpha(THEME_COLORS[themeColor], 0.9) : alpha(THEME_COLORS[themeColor], 0.1),
                                    borderColor: THEME_COLORS[themeColor]
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
