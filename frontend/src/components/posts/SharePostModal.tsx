'use client';

import React, { useState, useMemo } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Box,
    Typography,
    Avatar,
    IconButton,
    TextField,
    InputAdornment,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    Divider,
    keyframes,
} from '@mui/material';
import {
    Close as CloseIcon,
    Search as SearchIcon,
    Send as SendIcon,
    Check as CheckIcon,
} from '@mui/icons-material';
import { PostType } from '@/types/post';
import { ConversationResponseData } from '@/types/conversation';
import { useGetAllConversations } from '@/queries/useConversationQueries';
import { useSocket } from '@/contexts/SocketContext';
import { getAuthorName } from '@/utils/formatPost';

const slideUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const pop = keyframes`
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
`;

interface SharePostModalProps {
    open: boolean;
    onClose: () => void;
    post: PostType;
    currentUserId: string;
}

export default function SharePostModal({
    open,
    onClose,
    post,
    currentUserId,
}: SharePostModalProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedConversations, setSelectedConversations] = useState<string[]>([]);
    const [shareMessage, setShareMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sentTo, setSentTo] = useState<string[]>([]);

    const { socket } = useSocket();
    const { data: conversationsData, isLoading } = useGetAllConversations();

    const conversations = useMemo(() => {
        if (!conversationsData?.data) return [];
        return conversationsData.data.filter((conv: ConversationResponseData) => {
            if (conv.type === 'GROUP') {
                return conv.name?.toLowerCase().includes(searchQuery.toLowerCase());
            }
            const otherParticipant = conv.participants.find(
                (p) => p.user._id !== currentUserId
            );
            const name = otherParticipant
                ? `${otherParticipant.user.firstName} ${otherParticipant.user.lastName}`
                : '';
            return name.toLowerCase().includes(searchQuery.toLowerCase());
        });
    }, [conversationsData, searchQuery, currentUserId]);

    const getConversationName = (conv: ConversationResponseData) => {
        if (conv.type === 'GROUP') return conv.name || 'Nhóm chat';
        const otherParticipant = conv.participants.find(
            (p) => p.user._id !== currentUserId
        );
        return otherParticipant
            ? `${otherParticipant.user.firstName} ${otherParticipant.user.lastName}`
            : 'Unknown';
    };

    const getConversationAvatar = (conv: ConversationResponseData) => {
        if (conv.type === 'GROUP') return conv.avatar;
        const otherParticipant = conv.participants.find(
            (p) => p.user._id !== currentUserId
        );
        return otherParticipant?.user.avatar;
    };

    const handleToggleConversation = (conversationId: string) => {
        setSelectedConversations((prev) =>
            prev.includes(conversationId)
                ? prev.filter((id) => id !== conversationId)
                : [...prev, conversationId]
        );
    };

    const handleShare = async () => {
        if (!socket || selectedConversations.length === 0) return;

        setIsSending(true);
        const newSentTo: string[] = [];

        for (const conversationId of selectedConversations) {
            try {
                // Send post share message
                socket.emit('message', {
                    conversationId,
                    senderId: currentUserId,
                    content: shareMessage || `Đã chia sẻ một bài viết`,
                    type: 'POST',
                    postId: post._id,
                });
                newSentTo.push(conversationId);
            } catch (error) {
                console.error('Error sharing post:', error);
            }
        }

        setSentTo(newSentTo);
        setIsSending(false);

        // Close after a short delay
        setTimeout(() => {
            onClose();
            setSelectedConversations([]);
            setShareMessage('');
            setSentTo([]);
        }, 1500);
    };

    const handleClose = () => {
        onClose();
        setSelectedConversations([]);
        setSearchQuery('');
        setShareMessage('');
        setSentTo([]);
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 3,
                    maxHeight: '90vh',
                },
            }}
        >
            <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6" fontWeight={700}>
                    Chia sẻ bài viết
                </Typography>
                <IconButton onClick={handleClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 0 }}>
                {/* Post Preview */}
                <Box sx={{ px: 2, py: 1.5, bgcolor: '#f0f2f5', mx: 2, borderRadius: 2, mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar src={post.userId?.avatar} sx={{ width: 36, height: 36 }} />
                        <Box sx={{ flex: 1 }}>
                            <Typography fontWeight={600} fontSize={14}>
                                {getAuthorName(post)}
                            </Typography>
                            <Typography
                                fontSize={13}
                                color="#65676b"
                                sx={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                }}
                            >
                                {post.content}
                            </Typography>
                        </Box>
                        {post.media && post.media.length > 0 && (
                            <Box
                                sx={{
                                    width: 60,
                                    height: 60,
                                    borderRadius: 1,
                                    overflow: 'hidden',
                                    flexShrink: 0,
                                }}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={post.media[0].url}
                                    alt="Post media"
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                    }}
                                />
                            </Box>
                        )}
                    </Box>
                </Box>

                {/* Share message input */}
                <Box sx={{ px: 2, mb: 2 }}>
                    <TextField
                        fullWidth
                        multiline
                        rows={2}
                        placeholder="Viết tin nhắn kèm theo..."
                        value={shareMessage}
                        onChange={(e) => setShareMessage(e.target.value)}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                bgcolor: '#f0f2f5',
                                '& fieldset': { border: 'none' },
                            },
                        }}
                    />
                </Box>

                <Divider />

                {/* Search */}
                <Box sx={{ px: 2, py: 1.5 }}>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Tìm kiếm cuộc trò chuyện..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon sx={{ color: '#65676b' }} />
                                </InputAdornment>
                            ),
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 5,
                                bgcolor: '#f0f2f5',
                                '& fieldset': { border: 'none' },
                            },
                        }}
                    />
                </Box>

                {/* Selected chips */}
                {selectedConversations.length > 0 && (
                    <Box sx={{ px: 2, pb: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selectedConversations.map((convId) => {
                            const conv = conversations.find((c: ConversationResponseData) => c._id === convId);
                            if (!conv) return null;
                            return (
                                <Chip
                                    key={convId}
                                    label={getConversationName(conv)}
                                    onDelete={() => handleToggleConversation(convId)}
                                    size="small"
                                    sx={{
                                        bgcolor: '#e7f3ff',
                                        color: '#1877f2',
                                        '& .MuiChip-deleteIcon': {
                                            color: '#1877f2',
                                        },
                                        animation: `${pop} 0.2s ease-out`,
                                    }}
                                />
                            );
                        })}
                    </Box>
                )}

                {/* Conversation List */}
                <List sx={{ maxHeight: 300, overflow: 'auto', px: 1 }}>
                    {isLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress size={24} />
                        </Box>
                    ) : conversations.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 4, color: '#65676b' }}>
                            <Typography>Không tìm thấy cuộc trò chuyện</Typography>
                        </Box>
                    ) : (
                        conversations.map((conv: ConversationResponseData, index: number) => {
                            const isSelected = selectedConversations.includes(conv._id);
                            const isSent = sentTo.includes(conv._id);

                            return (
                                <ListItem
                                    key={conv._id}
                                    onClick={() => !isSent && handleToggleConversation(conv._id)}
                                    sx={{
                                        borderRadius: 2,
                                        cursor: isSent ? 'default' : 'pointer',
                                        mb: 0.5,
                                        bgcolor: isSelected ? '#e7f3ff' : 'transparent',
                                        animation: `${slideUp} 0.3s ease-out`,
                                        animationDelay: `${index * 0.03}s`,
                                        animationFillMode: 'both',
                                        '&:hover': {
                                            bgcolor: isSent ? 'transparent' : isSelected ? '#d4e9fc' : '#f0f2f5',
                                        },
                                    }}
                                >
                                    <ListItemAvatar>
                                        <Avatar src={getConversationAvatar(conv)} />
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={getConversationName(conv)}
                                        secondary={conv.type === 'GROUP' ? `${conv.participants.length} thành viên` : undefined}
                                        primaryTypographyProps={{
                                            fontWeight: isSelected ? 600 : 400,
                                            color: isSent ? '#65676b' : '#050505',
                                        }}
                                    />
                                    {isSent ? (
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 0.5,
                                                color: '#00a400',
                                            }}
                                        >
                                            <CheckIcon fontSize="small" />
                                            <Typography variant="caption">Đã gửi</Typography>
                                        </Box>
                                    ) : (
                                        <Checkbox
                                            checked={isSelected}
                                            sx={{
                                                color: '#bcc0c4',
                                                '&.Mui-checked': {
                                                    color: '#1877f2',
                                                },
                                            }}
                                        />
                                    )}
                                </ListItem>
                            );
                        })
                    )}
                </List>

                {/* Send Button */}
                <Box sx={{ p: 2, borderTop: '1px solid #e4e6eb' }}>
                    <Button
                        fullWidth
                        variant="contained"
                        disabled={selectedConversations.length === 0 || isSending || sentTo.length > 0}
                        onClick={handleShare}
                        startIcon={isSending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                        sx={{
                            bgcolor: '#1877f2',
                            borderRadius: 2,
                            py: 1.2,
                            fontWeight: 600,
                            '&:hover': { bgcolor: '#166fe5' },
                            '&.Mui-disabled': {
                                bgcolor: sentTo.length > 0 ? '#00a400' : '#e4e6eb',
                                color: sentTo.length > 0 ? 'white' : '#bcc0c4',
                            },
                        }}
                    >
                        {isSending
                            ? 'Đang gửi...'
                            : sentTo.length > 0
                                ? 'Đã gửi thành công!'
                                : `Gửi ${selectedConversations.length > 0 ? `(${selectedConversations.length})` : ''}`}
                    </Button>
                </Box>
            </DialogContent>
        </Dialog>
    );
}
