'use client';

import React, { useState } from 'react';
import {
    Box,
    Avatar,
    Typography,
    IconButton,
    TextField,
    InputAdornment,
    List,
    ListItemButton,
    ListItemAvatar,
    ListItemText,
    Badge,
    Menu,
    MenuItem,
    Divider,
} from '@mui/material';
import {
    Search as SearchIcon,
    MoreVert as MoreVertIcon,
    Logout as LogoutIcon,
    Person as PersonIcon,
    Settings as SettingsIcon,
    Edit as EditIcon,
} from '@mui/icons-material';
import { useAuthStore } from '@/stores/useAuthStore';
import { authService } from '@/services/auth.service';
import { toast } from 'sonner';
import { formatTime } from '@/utils/formatDate';
import { ConversationResponseData } from '@/types/conversation';
import { useRouter } from 'next/navigation';
import { CLIENT_PATH } from '@/constants/paths';



interface ChatSidebarProps {
    conversations: ConversationResponseData[];
    isLoading: boolean;
    selectedConversationId?: string;
    onSelectConversation: (conversation: {
        _id: string;
        fullName: string;
        avatar: string;
        status: 'online' | 'offline';
        otherId: string;
    }) => void;
}

export default function ChatSidebar({
    conversations,
    isLoading,
    selectedConversationId,
    onSelectConversation,
}: ChatSidebarProps) {
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const router = useRouter();

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = async () => {
        handleMenuClose();
        const response = await authService.logout();
        if (response.statusCode === 201) {
            logout();
            toast.success('Đã đăng xuất thành công!');
            router.push(CLIENT_PATH.LOGIN);
        } else {
            toast.error('Đăng xuất thất bại. Vui lòng thử lại.');
        }
    };

    const filteredConversations = conversations.filter((conversation) => {
        if (conversation.type !== 'DIRECT') return false;
        const chatUser = conversation.participants.find((p) => p.user._id !== user?.id)?.user;
        const fullName = `${chatUser?.firstName || ''} ${chatUser?.lastName || ''}`.toLowerCase();
        return fullName.includes(searchQuery.toLowerCase());
    });

    return (
        <Box
            sx={{
                width: '25%',
                height: '100vh',
                bgcolor: 'white',
                borderRight: '1px solid #e4e6eb',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* User Profile Header */}
            <Box sx={{ p: 2, borderBottom: '1px solid #e4e6eb' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6" fontWeight={700} color="#050505">
                        Đoạn chat
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                            size="small"
                            sx={{
                                color: '#65676b',
                                bgcolor: '#f0f2f5',
                                '&:hover': { bgcolor: '#e4e6eb' },
                            }}
                        >
                            <MoreVertIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                            size="small"
                            sx={{
                                color: '#65676b',
                                bgcolor: '#f0f2f5',
                                '&:hover': { bgcolor: '#e4e6eb' },
                            }}
                        >
                            <EditIcon fontSize="small" />
                        </IconButton>
                    </Box>
                </Box>

                {/* User Info */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        p: 1.5,
                        borderRadius: 2,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: '#f0f2f5' },
                    }}
                    onClick={handleMenuOpen}
                >
                    <Badge
                        overlap="circular"
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        variant="dot"
                        sx={{
                            '& .MuiBadge-badge': {
                                backgroundColor: '#31a24c',
                                border: '2px solid white',
                                width: 12,
                                height: 12,
                            },
                        }}
                    >
                        <Avatar
                            src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.fullName?.[0] || 'U'}&background=1877f2&color=fff`}
                            sx={{ width: 40, height: 40 }}
                        />
                    </Badge>
                    <Box sx={{ flex: 1 }}>
                        <Typography fontWeight={600} fontSize={15} color="#050505">
                            {user?.fullName}
                        </Typography>
                        <Typography variant="body2" color="#65676b" fontSize={13}>
                            Đang hoạt động
                        </Typography>
                    </Box>
                    <MoreVertIcon sx={{ color: '#65676b', fontSize: 20 }} />
                </Box>

                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleMenuClose}
                    PaperProps={{
                        sx: {
                            bgcolor: 'white',
                            color: '#050505',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            borderRadius: 2,
                            mt: 1,
                            minWidth: 200,
                        },
                    }}
                >
                    <MenuItem
                        onClick={handleMenuClose}
                        sx={{
                            py: 1.5,
                            color: '#050505',
                            '&:hover': { bgcolor: '#f0f2f5' },
                        }}
                    >
                        <PersonIcon sx={{ mr: 2, color: '#65676b' }} fontSize="small" />
                        Hồ sơ
                    </MenuItem>
                    <MenuItem
                        onClick={handleMenuClose}
                        sx={{
                            py: 1.5,
                            color: '#050505',
                            '&:hover': { bgcolor: '#f0f2f5' },
                        }}
                    >
                        <SettingsIcon sx={{ mr: 2, color: '#65676b' }} fontSize="small" />
                        Cài đặt
                    </MenuItem>
                    <Divider sx={{ borderColor: '#e4e6eb', my: 0.5 }} />
                    <MenuItem
                        onClick={handleLogout}
                        sx={{
                            py: 1.5,
                            color: '#050505',
                            '&:hover': { bgcolor: '#f0f2f5' },
                        }}
                    >
                        <LogoutIcon sx={{ mr: 2, color: '#65676b' }} fontSize="small" />
                        Đăng xuất
                    </MenuItem>
                </Menu>

                {/* Search Field */}
                <TextField
                    fullWidth
                    placeholder="Tìm kiếm trên Messenger"
                    size="small"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon sx={{ color: '#65676b', fontSize: 18 }} />
                            </InputAdornment>
                        ),
                        sx: {
                            borderRadius: 5,
                            bgcolor: '#f0f2f5',
                            color: '#050505',
                            fontSize: '14px',
                            '& .MuiOutlinedInput-notchedOutline': {
                                border: 'none',
                            },
                            '&:hover': {
                                bgcolor: '#e4e6eb',
                            },
                            '&.Mui-focused': {
                                bgcolor: '#e4e6eb',
                            },
                        },
                    }}
                    inputProps={{
                        sx: {
                            py: 1,
                            '&::placeholder': {
                                color: '#65676b',
                                opacity: 1,
                            },
                        },
                    }}
                    sx={{ mt: 2 }}
                />
            </Box>

            {/* Conversation List */}
            <Box
                sx={{
                    flex: 1,
                    overflow: 'auto',
                    '&::-webkit-scrollbar': { width: '8px' },
                    '&::-webkit-scrollbar-thumb': {
                        backgroundColor: '#c4c4c4',
                        borderRadius: '4px',
                    },
                }}
            >
                <List disablePadding>
                    {!isLoading &&
                        filteredConversations.map((conversation) => {
                            const chatUser = conversation.participants.find((p) => p.user._id !== user?.id)?.user;
                            const fullName = `${chatUser?.firstName || ''} ${chatUser?.lastName || ''}`;
                            const isSelected = conversation._id === selectedConversationId;

                            return (
                                <ListItemButton
                                    key={conversation._id}
                                    selected={isSelected}
                                    onClick={() => {
                                        onSelectConversation({
                                            _id: conversation._id,
                                            fullName,
                                            avatar:
                                                chatUser?.avatar ||
                                                `https://ui-avatars.com/api/?name=${chatUser?.username?.[0] || 'U'}&background=1877f2&color=fff`,
                                            status: 'online',
                                            otherId: chatUser?._id || '',
                                        });
                                    }}
                                    sx={{
                                        py: 1.5,
                                        px: 2,
                                        bgcolor: isSelected ? '#e7f3ff' : 'transparent',
                                        '&:hover': {
                                            bgcolor: isSelected ? '#e7f3ff' : '#f0f2f5',
                                        },
                                        '&.Mui-selected': {
                                            bgcolor: '#e7f3ff',
                                            '&:hover': {
                                                bgcolor: '#e7f3ff',
                                            },
                                        },
                                    }}
                                >
                                    <ListItemAvatar>
                                        <Badge
                                            overlap="circular"
                                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                            variant="dot"
                                            sx={{
                                                '& .MuiBadge-badge': {
                                                    backgroundColor: '#31a24c',
                                                    border: '2px solid white',
                                                    width: 10,
                                                    height: 10,
                                                },
                                            }}
                                        >
                                            <Avatar
                                                src={
                                                    chatUser?.avatar ||
                                                    `https://ui-avatars.com/api/?name=${chatUser?.username?.[0] || 'U'}&background=1877f2&color=fff`
                                                }
                                                sx={{ width: 56, height: 56 }}
                                            />
                                        </Badge>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={
                                            <Typography noWrap fontWeight={600} fontSize={15} color="#050505">
                                                {fullName}
                                            </Typography>
                                        }
                                        secondary={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Typography
                                                    noWrap
                                                    variant="body2"
                                                    color="#65676b"
                                                    component="span"
                                                    fontSize={13}
                                                    sx={{ flex: 1 }}
                                                >
                                                    {conversation.lastMessage
                                                        ? conversation.lastMessage.content
                                                        : 'Bạn đã gửi một nhắn tin'}
                                                </Typography>
                                                <Typography variant="caption" color="#65676b" fontSize={12}>
                                                    · {conversation.lastMessageAt ? formatTime(conversation.lastMessageAt) : ''}
                                                </Typography>
                                            </Box>
                                        }
                                    />
                                    {conversation.lastMessage && (
                                        <Badge
                                            badgeContent=" "
                                            sx={{
                                                '& .MuiBadge-badge': {
                                                    backgroundColor: '#1877f2',
                                                    width: 12,
                                                    height: 12,
                                                    borderRadius: '50%',
                                                    minWidth: 12,
                                                },
                                            }}
                                        />
                                    )}
                                </ListItemButton>
                            );
                        })}
                </List>
            </Box>
        </Box>
    );
}
