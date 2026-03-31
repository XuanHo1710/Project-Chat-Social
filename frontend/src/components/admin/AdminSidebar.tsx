'use client';

import {
    Box,
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography,
    useTheme,
    useMediaQuery
} from '@mui/material';
import {
    Dashboard as DashboardIcon,
    People as PeopleIcon,
    Article as ArticleIcon,
    Settings as SettingsIcon,
    Home as HomeIcon,
    Logout as LogoutIcon,
    AdminPanelSettings as AdminIcon,
    Palette as PaletteIcon
} from '@mui/icons-material';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRouter } from 'next/navigation';
import { useSettingsStore, THEME_COLORS } from '@/stores/useSettingsStore';
import { useTranslation } from 'react-i18next';
import { CLIENT_PATH } from '@/constants/paths';

const drawerWidth = 240;

// Menu items will use translation keys
const getMenuItems = (t: any) => [
    { text: t('admin.dashboard'), icon: <DashboardIcon sx={{ fontSize: 20 }} />, path: '/admin' },
    { text: t('admin.user_management'), icon: <PeopleIcon sx={{ fontSize: 20 }} />, path: '/admin/users' },
    { text: t('admin.post_management'), icon: <ArticleIcon sx={{ fontSize: 20 }} />, path: '/admin/posts' },
    { text: t('admin.theme_management'), icon: <PaletteIcon sx={{ fontSize: 20 }} />, path: '/admin/themes' },
    { text: t('admin.settings'), icon: <SettingsIcon sx={{ fontSize: 20 }} />, path: '/admin/settings' },
];

interface AdminSidebarProps {
    mobileOpen?: boolean;
    onMobileClose?: () => void;
}

export default function AdminSidebar({ mobileOpen = false, onMobileClose }: AdminSidebarProps) {
    const theme = useTheme();
    const pathname = usePathname();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const router = useRouter();
    const { logout } = useAuthStore();
    // Use theme palette for active color instead of local settings store
    const { t } = useTranslation();
    const activeColor = theme.palette.primary.main; // Dynamic from ThemeProvider
    const menuItems = getMenuItems(t);
    const isDark = theme.palette.mode === 'dark';

    const handleLogout = () => {
        logout();
        router.push(CLIENT_PATH.LOGIN);
    }

    const handleNavClick = () => {
        // Close mobile drawer when navigating
        if (isMobile && onMobileClose) {
            onMobileClose();
        }
    };

    const drawerContent = (
        <>
            {/* Logo Area - Smaller */}
            <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{
                    p: 0.8,
                    borderRadius: 1.5,
                    bgcolor: activeColor,
                    color: 'white',
                    display: 'flex',
                    boxShadow: `0 3px 8px ${activeColor}50`
                }}>
                    <AdminIcon sx={{ fontSize: 20 }} />
                </Box>
                <Box>
                    <Typography sx={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2, letterSpacing: -0.3 }}>
                        {t('admin.logo_text', 'SOCIAL')}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
                        {t('admin.admin_panel_label', 'Admin Panel')}
                    </Typography>
                </Box>
            </Box>

            <Box sx={{ px: 1.5, overflow: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <List sx={{ py: 0 }}>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 700, px: 1.5, mb: 0.5, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {t('admin.menu', 'Menu')}
                    </Typography>
                    {menuItems.map((item) => {
                        const isSelected = pathname === item.path;
                        return (
                            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                                <ListItemButton
                                    component={Link}
                                    href={item.path}
                                    selected={isSelected}
                                    onClick={handleNavClick}
                                    sx={{
                                        borderRadius: 2,
                                        py: 1,
                                        px: 1.5,
                                        minHeight: 40,
                                        transition: 'all 0.15s ease',
                                        '&.Mui-selected': {
                                            backgroundColor: activeColor,
                                            color: '#fff',
                                            boxShadow: `0 4px 12px ${activeColor}40`,
                                            '&:hover': {
                                                backgroundColor: activeColor,
                                                filter: 'brightness(0.95)',
                                            },
                                            '& .MuiListItemIcon-root': {
                                                color: '#fff',
                                            }
                                        },
                                        '&:hover': {
                                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                                        }
                                    }}
                                >
                                    <ListItemIcon sx={{ minWidth: 32, color: isSelected ? 'inherit' : 'text.secondary' }}>
                                        {item.icon}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={item.text}
                                        primaryTypographyProps={{
                                            fontSize: 13,
                                            fontWeight: isSelected ? 600 : 500
                                        }}
                                    />
                                </ListItemButton>
                            </ListItem>
                        );
                    })}
                </List>

                <Box sx={{ mb: 2 }}>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 700, px: 1.5, mb: 0.5, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {t('admin.system', 'System')}
                    </Typography>
                    <List sx={{ py: 0 }}>
                        <ListItem disablePadding sx={{ mb: 0.5 }}>
                            <ListItemButton
                                component={Link}
                                href="/"
                                onClick={handleNavClick}
                                sx={{
                                    borderRadius: 2,
                                    py: 1,
                                    px: 1.5,
                                    minHeight: 40,
                                    '&:hover': {
                                        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                                    }
                                }}
                            >
                                <ListItemIcon sx={{ minWidth: 32, color: 'text.secondary' }}><HomeIcon sx={{ fontSize: 20 }} /></ListItemIcon>
                                <ListItemText primary={t('admin.back_to_home')} primaryTypographyProps={{ fontSize: 13, fontWeight: 500 }} />
                            </ListItemButton>
                        </ListItem>
                        <ListItem disablePadding>
                            <ListItemButton
                                onClick={handleLogout}
                                sx={{
                                    borderRadius: 2,
                                    py: 1,
                                    px: 1.5,
                                    minHeight: 40,
                                    color: theme.palette.error.main,
                                    '&:hover': {
                                        backgroundColor: `${theme.palette.error.main}10`,
                                    }
                                }}
                            >
                                <ListItemIcon sx={{ minWidth: 32, color: theme.palette.error.main }}><LogoutIcon sx={{ fontSize: 20 }} /></ListItemIcon>
                                <ListItemText primary={t('common.logout')} primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }} />
                            </ListItemButton>
                        </ListItem>
                    </List>
                </Box>
            </Box>
        </>
    );

    return (
        <>
            {/* Mobile Drawer */}
            <Drawer
                variant="temporary"
                open={mobileOpen}
                onClose={onMobileClose}
                ModalProps={{ keepMounted: true }}
                sx={{
                    display: { xs: 'block', md: 'none' },
                    [`& .MuiDrawer-paper`]: {
                        width: drawerWidth,
                        boxSizing: 'border-box',
                        backgroundColor: isDark ? '#242526' : '#ffffff',
                        borderRight: `1px solid ${isDark ? '#3a3b3c' : '#e4e6eb'}`,
                    },
                }}
            >
                {drawerContent}
            </Drawer>

            {/* Desktop Drawer */}
            <Drawer
                variant="permanent"
                sx={{
                    display: { xs: 'none', md: 'block' },
                    width: drawerWidth,
                    flexShrink: 0,
                    [`& .MuiDrawer-paper`]: {
                        width: drawerWidth,
                        boxSizing: 'border-box',
                        backgroundColor: isDark ? '#242526' : '#ffffff',
                        borderRight: `1px solid ${isDark ? '#3a3b3c' : '#e4e6eb'}`,
                        boxShadow: isDark ? 'none' : '2px 0 12px rgba(0,0,0,0.03)',
                    },
                }}
            >
                {drawerContent}
            </Drawer>
        </>
    );
}


