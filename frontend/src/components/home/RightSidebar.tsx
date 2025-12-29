'use client';

import { Box, Typography, Avatar, Badge } from '@mui/material';
import { MoreHoriz as MoreIcon, VideoCall as VideoIcon, Search as SearchIcon } from '@mui/icons-material';

const contacts = [
    { name: 'Meta AI', avatar: '/meta-ai.jpg', online: true },
    { name: 'Trường Giang', avatar: '/avatar1.jpg', online: true },
    { name: 'To Ki', avatar: '/avatar2.jpg', online: false },
    { name: 'Nghiêm Chí Thiên', avatar: '/avatar3.jpg', online: false },
    { name: 'Nguyễn Huy Hoàng', avatar: '/avatar6.jpg', online: true },
    { name: 'Hồ Minh Quân', avatar: '/avatar7.jpg', online: false },
    { name: 'Nam Nguyeen', avatar: '/avatar8.jpg', online: true },
    { name: 'Chí Tâm', avatar: '/avatar9.jpg', online: true },
    { name: 'Bùi Ngọc Sang', avatar: '/avatar10.jpg', online: true },
];

export default function RightSidebar() {
    return (
        <Box
            sx={{
                width: 280,
                height: 'calc(100vh - 56px)',
                position: 'fixed',
                right: 0,
                top: 56,
                overflowY: 'auto',
                pt: 2,
                px: 2,
                display: { xs: 'none', xl: 'block' },
                '&::-webkit-scrollbar': {
                    width: '8px',
                },
                '&::-webkit-scrollbar-thumb': {
                    backgroundColor: '#b8b8b8',
                    borderRadius: '4px',
                },
            }}
        >
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography sx={{ fontSize: '17px', fontWeight: 600, color: '#65676b' }}>
                    Người liên hệ
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Box
                        sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: '#f0f2f5' },
                        }}
                    >
                        <VideoIcon sx={{ fontSize: '20px', color: '#65676b' }} />
                    </Box>
                    <Box
                        sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: '#f0f2f5' },
                        }}
                    >
                        <SearchIcon sx={{ fontSize: '20px', color: '#65676b' }} />
                    </Box>
                    <Box
                        sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: '#f0f2f5' },
                        }}
                    >
                        <MoreIcon sx={{ fontSize: '20px', color: '#65676b' }} />
                    </Box>
                </Box>
            </Box>

            {/* Contacts List */}
            <Box>
                {contacts.map((contact, index) => (
                    <Box
                        key={index}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            py: 1,
                            px: 1,
                            borderRadius: 2,
                            cursor: 'pointer',
                            '&:hover': {
                                bgcolor: '#f0f2f5',
                            },
                        }}
                    >
                        <Badge
                            overlap="circular"
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                            variant="dot"
                            sx={{
                                '& .MuiBadge-badge': {
                                    backgroundColor: contact.online ? '#31a24c' : 'transparent',
                                    border: contact.online ? '2px solid white' : 'none',
                                    width: 12,
                                    height: 12,
                                    borderRadius: '50%',
                                },
                            }}
                        >
                            <Avatar sx={{ width: 36, height: 36 }} />
                        </Badge>
                        <Typography
                            sx={{
                                fontSize: '15px',
                                fontWeight: 500,
                                color: '#050505',
                                flex: 1,
                            }}
                        >
                            {contact.name}
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Box>
    );
}
