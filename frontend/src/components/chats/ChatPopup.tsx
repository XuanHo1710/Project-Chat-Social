'use client';

import React, { useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    IconButton,
    TextField,
    InputAdornment,
    List,
    ListItemButton,
    ListItemAvatar,
    Avatar,
    ListItemText,
    Badge,
    Tabs,
    Tab,
} from '@mui/material';
import {
    Search as SearchIcon,
    MoreHoriz as MoreIcon,
    VideoCall as VideoIcon,
    Create as CreateIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { formatTime } from '@/utils/formatDate';
import { ConversationResponseData } from '@/types/conversation';
import { CLIENT_PATH } from '@/constants/paths';


interface ChatPopupProps {
    conversations: ConversationResponseData[];
    isLoading: boolean;
    userId?: string;
}

export default function ChatPopup({ conversations, isLoading, userId }: ChatPopupProps) {
    const router = useRouter();
    const [tabValue, setTabValue] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');

    const handleConversationClick = () => {
        router.push(CLIENT_PATH.CHAT);
    };

    const filteredConversations = conversations.filter((conversation) => {
        if (conversation.type !== 'DIRECT') return false;
        const chatUser = conversation.participants.find((p) => p.user._id !== userId)?.user;
        const fullName = `${chatUser?.firstName || ''} ${chatUser?.lastName || ''}`.toLowerCase();
        return fullName.includes(searchQuery.toLowerCase());
    });

    return (
        <Paper
            elevation={8}
            sx={{
                position: 'absolute',
                top: 56,
                right: 0,
                width: 360,
                height: 500,
                bgcolor: 'white',
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                zIndex: 1300,
            }}
        >
            {/* Header */}
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
                            <MoreIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                            size="small"
                            sx={{
                                color: '#65676b',
                                bgcolor: '#f0f2f5',
                                '&:hover': { bgcolor: '#e4e6eb' },
                            }}
                        >
                            <VideoIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                            size="small"
                            sx={{
                                color: '#65676b',
                                bgcolor: '#f0f2f5',
                                '&:hover': { bgcolor: '#e4e6eb' },
                            }}
                        >
                            <CreateIcon fontSize="small" />
                        </IconButton>
                    </Box>
                </Box>

                {/* Search */}
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
                />
            </Box>

            {/* Tabs */}
            <Tabs
                value={tabValue}
                onChange={(e, newValue) => setTabValue(newValue)}
                sx={{
                    borderBottom: '1px solid #e4e6eb',
                    minHeight: 44,
                    '& .MuiTab-root': {
                        color: '#65676b',
                        fontSize: '15px',
                        fontWeight: 600,
                        textTransform: 'none',
                        minHeight: 44,
                        '&.Mui-selected': {
                            color: '#1877f2',
                        },
                    },
                    '& .MuiTabs-indicator': {
                        backgroundColor: '#1877f2',
                        height: 3,
                    },
                }}
            >
                <Tab label="Tất cả" />
                <Tab label="Chưa đọc" />
                <Tab label="Nhóm" />
            </Tabs>

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
                            const chatUser = conversation.participants.find((p) => p.user._id !== userId)?.user;

                            return (
                                <ListItemButton
                                    key={conversation._id}
                                    onClick={() => handleConversationClick()}
                                    sx={{
                                        py: 1.5,
                                        px: 2,
                                        '&:hover': {
                                            bgcolor: '#f0f2f5',
                                        },
                                        gap: 1,
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
                                                {chatUser?.firstName} {chatUser?.lastName}
                                            </Typography>
                                        }
                                        secondary={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
                                                        : 'Bắt đầu cuộc trò chuyện mới'}
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

            {/* Footer */}
            <Box
                sx={{
                    p: 1.5,
                    borderTop: '1px solid #e4e6eb',
                    textAlign: 'center',
                }}
            >
                <Typography
                    onClick={() => router.push('/chat')}
                    sx={{
                        color: '#1877f2',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        '&:hover': {
                            textDecoration: 'underline',
                        },
                    }}
                >
                    Xem tất cả trong Messenger
                </Typography>
            </Box>
        </Paper>
    );
}
