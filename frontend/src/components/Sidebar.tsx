'use client';

import { Box, List, ListItemButton, ListItemIcon, ListItemText, Avatar, Divider } from '@mui/material';
import {
    Person as PersonIcon,
    Group as GroupIcon,
    Storefront as StorefrontIcon,
    OndemandVideo as VideoIcon,
    Schedule as ScheduleIcon,
    Bookmark as BookmarkIcon,
    Flag as FlagIcon,
    CalendarMonth as CalendarIcon,
    KeyboardArrowDown as ArrowDownIcon
} from '@mui/icons-material';
import { useAuthStore } from '@/stores/useAuthStore';

export default function Sidebar() {
    const { user } = useAuthStore();

    const menuItems = [
        { icon: <PersonIcon />, label: user?.fullName || user?.username || 'User', avatar: true, avatarSrc: user?.avatar },
        { icon: <GroupIcon />, label: 'Bạn bè' },
        { icon: <GroupIcon />, label: 'Nhóm' },
        { icon: <StorefrontIcon />, label: 'Marketplace' },
        { icon: <VideoIcon />, label: 'Watch' },
        { icon: <ScheduleIcon />, label: 'Kỷ niệm' },
        { icon: <BookmarkIcon />, label: 'Đã lưu' },
        { icon: <FlagIcon />, label: 'Trang' },
        { icon: <CalendarIcon />, label: 'Sự kiện' },
    ];

    return (
        <Box
            sx={{
                width: 280,
                height: 'calc(100vh - 56px)',
                position: 'fixed',
                left: 0,
                top: 56,
                overflowY: 'auto',
                pt: 2,
                px: 1,
                display: { xs: 'none', lg: 'block' },
                '&::-webkit-scrollbar': {
                    width: '8px',
                },
                '&::-webkit-scrollbar-thumb': {
                    backgroundColor: '#b8b8b8',
                    borderRadius: '4px',
                },
            }}
        >
            <List sx={{ p: 0 }}>
                {menuItems.map((item, index) => (
                    <ListItemButton
                        key={index}
                        sx={{
                            borderRadius: 2,
                            mb: 0.5,
                            py: 1.5,
                            '&:hover': {
                                bgcolor: '#f0f2f5',
                            },
                        }}
                    >
                        {item.avatar ? (
                            <ListItemIcon sx={{ minWidth: 40 }}>
                                <Avatar sx={{ width: 36, height: 36 }} src={item.avatarSrc || '/avatar-placeholder.jpg'} />
                            </ListItemIcon>
                        ) : (
                            <ListItemIcon sx={{ minWidth: 40 }}>
                                <Box
                                    sx={{
                                        width: 36,
                                        height: 36,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#1877f2',
                                    }}
                                >
                                    {item.icon}
                                </Box>
                            </ListItemIcon>
                        )}
                        <ListItemText
                            primary={item.label}
                            primaryTypographyProps={{
                                fontSize: '15px',
                                fontWeight: 500,
                                color: '#050505',
                            }}
                        />
                    </ListItemButton>
                ))}

                <ListItemButton
                    sx={{
                        borderRadius: 2,
                        mb: 0.5,
                        py: 1.5,
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
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: '#e4e6eb',
                                borderRadius: '50%',
                            }}
                        >
                            <ArrowDownIcon />
                        </Box>
                    </ListItemIcon>
                    <ListItemText
                        primary="Xem thêm"
                        primaryTypographyProps={{
                            fontSize: '15px',
                            fontWeight: 500,
                            color: '#050505',
                        }}
                    />
                </ListItemButton>
            </List>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ px: 2, py: 1 }}>
                <Box
                    sx={{
                        fontSize: '17px',
                        fontWeight: 600,
                        color: '#65676b',
                        mb: 1,
                    }}
                >
                    Lối tắt của bạn
                </Box>
            </Box>
        </Box>
    );
}
