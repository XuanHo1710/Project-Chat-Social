import { useState } from 'react';
import { AppBar, Toolbar, Typography, IconButton, Box, Avatar, Tooltip } from '@mui/material';
import { Brightness4, Brightness7, NotificationsOutlined, SettingsOutlined } from '@mui/icons-material';
import { useThemeStore } from '@/stores/useThemeStore';
import { useAuthStore } from '@/stores/useAuthStore';
import SettingsPanel from './SettingsPanel';
import { useTranslation } from 'react-i18next';

// Cần khớp với drawerWidth bên Sidebar
const drawerWidth = 260;

export default function AdminHeader() {
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
                    width: { xs: '100%', sm: `calc(100% - ${drawerWidth}px)` },
                    ml: { xs: 0, sm: `${drawerWidth}px` },
                    backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#242526' : '#ffffff',
                    backdropFilter: 'blur(12px)',
                    color: (theme) => theme.palette.text.primary,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    borderBottom: '1px solid',
                    borderColor: (theme) => theme.palette.mode === 'dark' ? '#3a3b3c' : '#e4e6eb',
                    transition: 'width 0.2s ease-in-out'
                }}
            >
                <Toolbar sx={{ justifyContent: 'space-between', minHeight: 70 }}>
                    {/* Left Side */}
                    <Box>
                        <Typography variant="subtitle1" fontWeight="700" color="text.secondary">
                            {t('common.dashboard')}
                        </Typography>
                    </Box>

                    {/* Right Side */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Tooltip title="Đổi giao diện">
                            <IconButton
                                onClick={toggleTheme}
                                sx={{
                                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                                    borderRadius: 3
                                }}
                            >
                                {mode === 'dark' ? <Brightness7 fontSize="small" /> : <Brightness4 fontSize="small" />}
                            </IconButton>
                        </Tooltip>

                        <Tooltip title={t('common.settings')}>
                            <IconButton
                                onClick={() => setOpenSettings(true)}
                                sx={{
                                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                                    borderRadius: 3
                                }}
                            >
                                <SettingsOutlined fontSize="small" />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Thông báo">
                            <IconButton
                                sx={{
                                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                                    borderRadius: 3
                                }}
                            >
                                <NotificationsOutlined fontSize="small" />
                            </IconButton>
                        </Tooltip>

                        <Box sx={{ ml: 1, display: 'flex', alignItems: 'center', gap: 1.5, pl: 2, borderLeft: '1px solid', borderColor: 'divider' }}>
                            <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                                    {user?.fullName || "Administrator"}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {user?.role === 'ADMIN' ? 'Super Admin' : 'Employee'}
                                </Typography>
                            </Box>
                            <Avatar
                                src={user?.avatar || "/default-avatar.png"}
                                alt={user?.fullName || "Admin"}
                                sx={{ width: 40, height: 40, border: '2px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                            />
                        </Box>
                    </Box>
                </Toolbar>
            </AppBar>
            <SettingsPanel open={openSettings} onClose={() => setOpenSettings(false)} />
        </>
    );
}
