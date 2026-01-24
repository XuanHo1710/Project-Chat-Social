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
    Divider,
    useTheme,
    Avatar,
    Stack
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

const drawerWidth = 260; // Tăng độ rộng chút cho thoáng

const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/admin' },
    { text: 'Quản lý tài khoản', icon: <PeopleIcon />, path: '/admin/users' },
    { text: 'Quản lý bài viết', icon: <ArticleIcon />, path: '/admin/posts' },
    { text: 'Quản lý giao diện', icon: <PaletteIcon />, path: '/admin/themes' },
    { text: 'Cài đặt', icon: <SettingsIcon />, path: '/admin/settings' },
];

export default function AdminSidebar() {
    const theme = useTheme();
    const pathname = usePathname();

    const router = useRouter();
    const { logout, user } = useAuthStore();
    const { themeColor } = useSettingsStore();
    const activeColor = THEME_COLORS[themeColor];

    const handleLogout = () => {
        logout();
        router.push('/auth/login');
    }

    return (
        <Drawer
            variant="permanent"
            sx={{
                width: drawerWidth,
                flexShrink: 0,
                [`& .MuiDrawer-paper`]: {
                    width: drawerWidth,
                    boxSizing: 'border-box',
                    backgroundColor: theme.palette.mode === 'dark' ? '#242526' : '#ffffff',
                    borderRight: `1px solid ${theme.palette.mode === 'dark' ? '#3a3b3c' : '#e4e6eb'}`,
                    boxShadow: theme.palette.mode === 'dark' ? 'none' : '4px 0 24px rgba(0,0,0,0.02)',
                },
            }}
        >
            {/* Logo Area */}
            <Box sx={{ p: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{
                    p: 1,
                    borderRadius: 2,
                    bgcolor: 'primary.main',
                    color: 'white',
                    display: 'flex',
                    boxShadow: '0 4px 12px rgba(24, 119, 242, 0.3)'
                }}>
                    <AdminIcon />
                </Box>
                <Box>
                    <Typography variant="h6" fontWeight="800" sx={{ lineHeight: 1, letterSpacing: -0.5 }}>
                        SOCIAL
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontWeight="600" sx={{ letterSpacing: 2, textTransform: 'uppercase' }}>
                        Admin Panel
                    </Typography>
                </Box>
            </Box>

            {/* User Mini Profile in Sidebar (Optional) */}
            <Box sx={{ px: 3, mb: 2 }}>
                <Box sx={{
                    p: 2,
                    borderRadius: 3,
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2
                }}>
                    <Avatar src={user?.avatar} sx={{ width: 40, height: 40, border: '2px solid white', boxShadow: 1 }} />
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" fontWeight="700" noWrap>
                            {user?.fullName || 'Administrator'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block" noWrap>
                            Super Admin
                        </Typography>
                    </Box>
                </Box>
            </Box>

            <Box sx={{ px: 2, overflow: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <List>
                    <Typography variant="caption" color="text.secondary" fontWeight="700" sx={{ px: 2, mb: 1, display: 'block', opacity: 0.7 }}>
                        MENU
                    </Typography>
                    {menuItems.map((item) => {
                        const isSelected = pathname === item.path;
                        return (
                            <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
                                <ListItemButton
                                    component={Link}
                                    href={item.path}
                                    selected={isSelected}
                                    sx={{
                                        borderRadius: 3,
                                        py: 1.5,
                                        px: 2.5,
                                        transition: 'all 0.2s ease-in-out',
                                        '&.Mui-selected': {
                                            backgroundColor: activeColor,
                                            color: '#fff',
                                            boxShadow: `0 8px 20px -4px ${activeColor}80`, // Colored shadow
                                            '&:hover': {
                                                filter: 'brightness(0.9)',
                                            },
                                            '& .MuiListItemIcon-root': {
                                                color: '#fff',
                                            }
                                        },
                                        '&:hover': {
                                            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                                            transform: 'translateX(4px)'
                                        }
                                    }}
                                >
                                    <ListItemIcon sx={{ minWidth: 40, color: isSelected ? 'inherit' : 'text.secondary', transition: 'color 0.2s' }}>
                                        {item.icon}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={item.text}
                                        primaryTypographyProps={{
                                            fontSize: '0.95rem',
                                            fontWeight: isSelected ? 600 : 500
                                        }}
                                    />
                                </ListItemButton>
                            </ListItem>
                        );
                    })}
                </List>

                <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="700" sx={{ px: 2, mb: 1, display: 'block', opacity: 0.7 }}>
                        SYSTEM
                    </Typography>
                    <List>
                        <ListItem disablePadding sx={{ mb: 1 }}>
                            <ListItemButton component={Link} href="/" sx={{ borderRadius: 3, py: 1.5, px: 2.5 }}>
                                <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}><HomeIcon /></ListItemIcon>
                                <ListItemText primary="Về trang chủ" primaryTypographyProps={{ fontWeight: 500 }} />
                            </ListItemButton>
                        </ListItem>
                        <ListItem disablePadding>
                            <ListItemButton
                                onClick={handleLogout}
                                sx={{
                                    borderRadius: 3,
                                    py: 1.5,
                                    px: 2.5,
                                    color: theme.palette.error.main,
                                    '&:hover': {
                                        backgroundColor: theme.palette.error.main + '10',
                                    }
                                }}
                            >
                                <ListItemIcon sx={{ minWidth: 40, color: theme.palette.error.main }}><LogoutIcon /></ListItemIcon>
                                <ListItemText primary="Đăng xuất" primaryTypographyProps={{ fontWeight: 600 }} />
                            </ListItemButton>
                        </ListItem>
                    </List>
                </Box>
            </Box>
        </Drawer>
    );
}
