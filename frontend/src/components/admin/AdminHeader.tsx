import { useState } from 'react';
import { AppBar, Toolbar, Typography, IconButton, Box, Avatar, Tooltip, useMediaQuery, useTheme } from '@mui/material';
import { Brightness4, Brightness7, NotificationsOutlined, SettingsOutlined, Menu as MenuIcon } from '@mui/icons-material';
import { useThemeStore } from '@/stores/useThemeStore';
import { useAuthStore } from '@/stores/useAuthStore';
import SettingsPanel from './SettingsPanel';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';

const drawerWidth = 240;

interface AdminHeaderProps {
    onMenuClick?: () => void;
}

export default function AdminHeader({ onMenuClick }: AdminHeaderProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const { mode, setMode } = useThemeStore();
    const { user } = useAuthStore();
    const { t } = useTranslation();
    const [openSettings, setOpenSettings] = useState(false);

    const toggleTheme = () => {
        setMode(mode === 'dark' ? 'light' : 'dark');
    };

    return (
        <>
            <AppBar
                position="fixed"
                sx={{
                    width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` },
                    ml: { xs: 0, md: `${drawerWidth}px` },
                    backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#242526' : '#ffffff',
                    backdropFilter: 'blur(12px)',
                    color: (theme) => theme.palette.text.primary,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    borderBottom: '1px solid',
                    borderColor: (theme) => theme.palette.mode === 'dark' ? '#3a3b3c' : '#e4e6eb',
                    transition: 'width 0.2s ease-in-out'
                }}
            >
                <Toolbar sx={{ justifyContent: 'space-between', minHeight: { xs: 56, md: 64 } }}>
                    {/* Left Side */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {isMobile && (
                            <IconButton
                                onClick={onMenuClick}
                                sx={{
                                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                                    borderRadius: 2
                                }}
                            >
                                <MenuIcon fontSize="small" />
                            </IconButton>
                        )}
                        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.secondary' }}>
                            {t('common.dashboard')}
                        </Typography>
                    </Box>

                    {/* Right Side */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
                        <Tooltip title={t('settings.display_mode')}>
                            <IconButton
                                onClick={toggleTheme}
                                size="small"
                                sx={{
                                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                                    borderRadius: 2,
                                    p: 1
                                }}
                            >
                                {mode === 'dark' ? <Brightness7 sx={{ fontSize: 18 }} /> : <Brightness4 sx={{ fontSize: 18 }} />}
                            </IconButton>
                        </Tooltip>

                        <Tooltip title={t('common.settings')}>
                            <IconButton
                                onClick={() => setOpenSettings(true)}
                                size="small"
                                sx={{
                                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                                    borderRadius: 2,
                                    p: 1
                                }}
                            >
                                <SettingsOutlined sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title={t('notifications.notifications')}>
                            <IconButton
                                size="small"
                                sx={{
                                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                                    borderRadius: 2,
                                    p: 1
                                }}
                            >
                                <NotificationsOutlined sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Tooltip>

                        <LanguageSwitcher />

                        <Box sx={{ ml: 1, display: 'flex', alignItems: 'center', gap: 1, pl: 1.5, borderLeft: '1px solid', borderColor: 'divider' }}>
                            <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
                                <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>
                                    {user?.fullName || "Administrator"}
                                </Typography>
                                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                                    {user?.role === 'ADMIN' ? 'Super Admin' : 'Employee'}
                                </Typography>
                            </Box>
                            <Avatar
                                src={user?.avatar || "/default-avatar.png"}
                                alt={user?.fullName || "Admin"}
                                sx={{ width: 34, height: 34, border: '2px solid', borderColor: 'divider' }}
                            />
                        </Box>
                    </Box>
                </Toolbar>
            </AppBar>
            <SettingsPanel open={openSettings} onClose={() => setOpenSettings(false)} />
        </>
    );
}


