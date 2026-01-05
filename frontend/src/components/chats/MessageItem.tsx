'use client';

import React, { useState } from 'react';
import {
    Box,
    Paper,
    Avatar,
    Typography,
    IconButton,
    Menu,
    MenuItem,
    TextField,
    Popover,
} from '@mui/material';
import {
    MoreHoriz as MoreHorizIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Reply as ReplyIcon,
    SentimentSatisfiedAltOutlined as SentimentSatisfiedAltIcon,
    Block as BlockIcon,
} from '@mui/icons-material';
import { MessageResponse, EmotionType } from '@/types/chat';
import { formatTime } from '@/utils/formatDate';
import { Socket } from 'socket.io-client';

const EMOTIONS: { type: EmotionType; emoji: string; label: string }[] = [
    { type: 'LIKE', emoji: '👍', label: 'Thích' },
    { type: 'LOVE', emoji: '❤️', label: 'Yêu thích' },
    { type: 'FUNNY', emoji: '😆', label: 'Haha' },
    { type: 'WOW', emoji: '😮', label: 'Wow' },
    { type: 'SAD', emoji: '😢', label: 'Buồn' },
    { type: 'ANGRY', emoji: '😡', label: 'Phẫn nộ' },
];

interface MessageItemProps {
    message: MessageResponse;
    isOwn: boolean;
    showAvatar: boolean;
    avatar: string;
    conversationId: string;
    socket: Socket | null;
    userId: string;
    onReply?: (message: MessageResponse) => void;
    themeColor?: string;
}

export default function MessageItem({
    message,
    isOwn,
    showAvatar,
    avatar,
    conversationId,
    socket,
    userId,
    onReply,
    themeColor = '#0084ff',
}: MessageItemProps) {
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const [reactionAnchor, setReactionAnchor] = useState<HTMLElement | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(message.content || '');
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const canEdit = isOwn && !message.isDeleted && message.content &&
        (new Date().getTime() - new Date(message.createdAt).getTime()) < 15 * 60 * 1000;

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => setMenuAnchor(event.currentTarget);
    const handleMenuClose = () => setMenuAnchor(null);
    const handleReactionOpen = (event: React.MouseEvent<HTMLElement>) => setReactionAnchor(event.currentTarget);
    const handleReactionClose = () => setReactionAnchor(null);

    const handleEdit = () => { handleMenuClose(); setIsEditing(true); setEditContent(message.content || ''); };
    const handleSaveEdit = () => {
        if (socket && editContent.trim() !== message.content) {
            socket.emit('message:edit', { messageId: message._id, conversationId, content: editContent.trim() });
        }
        setIsEditing(false);
    };
    const handleCancelEdit = () => { setIsEditing(false); setEditContent(message.content || ''); };
    const handleDelete = () => { handleMenuClose(); if (socket) socket.emit('message:delete', { messageId: message._id, conversationId }); };

    const handleReaction = (emotionType: EmotionType) => {
        handleReactionClose();
        if (socket) {
            const userReaction = message.emotions?.find(e => e.userId === userId);
            if (userReaction?.emotionType === emotionType) {
                socket.emit('message:reaction:remove', { messageId: message._id, conversationId });
            } else {
                socket.emit('message:reaction', { messageId: message._id, conversationId, emotionType });
            }
        }
    };

    const renderEmotionsSummary = () => {
        if (!message.emotions || message.emotions.length === 0 || isEditing || message.isDeleted) return null;
        const emotionMap = message.emotions.reduce((acc, curr) => {
            acc[curr.emotionType] = (acc[curr.emotionType] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        const uniqueTypes = Object.keys(emotionMap);
        const totalCount = message.emotions.length;

        return (
            <Box
                sx={{
                    position: 'absolute',
                    bottom: -10,
                    right: isOwn ? 8 : 'auto',
                    left: isOwn ? 'auto' : 8,
                    bgcolor: 'white',
                    borderRadius: '10px',
                    px: '6px',
                    py: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    cursor: 'pointer',
                    zIndex: 10,
                    border: '1px solid #e4e6eb',
                }}
                onClick={handleReactionOpen}
            >
                <Box sx={{ display: 'flex' }}>
                    {uniqueTypes.slice(0, 3).map((type, i) => (
                        <Typography key={type} fontSize={12} sx={{ ml: i > 0 ? -0.2 : 0, zIndex: 3 - i }}>
                            {EMOTIONS.find(e => e.type === type)?.emoji}
                        </Typography>
                    ))}
                </Box>
                {totalCount > 1 && (
                    <Typography fontSize={11} fontWeight={600} color="#65676b" sx={{ ml: 0.3 }}>
                        {totalCount}
                    </Typography>
                )}
            </Box>
        );
    };

    // Render attachments (images/videos)
    const renderAttachments = () => {
        if (!message.attachments || message.attachments.length === 0) return null;
        const count = message.attachments.length;
        const hasContent = !!message.content;

        return (
            <Box sx={{
                display: 'grid',
                gridTemplateColumns: count === 1 ? '1fr' : count === 2 ? '1fr 1fr' : 'repeat(2, 1fr)',
                gap: '2px',
                mt: hasContent ? 0.5 : 0,
                maxWidth: 280,
                borderRadius: '18px',
                overflow: 'hidden'
            }}>
                {message.attachments.map((url, index) => {
                    const isVideo = url.match(/\.(mp4|webm|ogg)$/i) || url.includes('video');

                    if (isVideo) {
                        return (
                            <Box key={index} sx={{ overflow: 'hidden' }}>
                                <video
                                    src={url}
                                    controls
                                    style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }}
                                />
                            </Box>
                        );
                    }

                    return (
                        <Box
                            key={index}
                            component="img"
                            src={url}
                            alt="attachment"
                            sx={{
                                width: '100%',
                                height: count === 1 ? 'auto' : 140,
                                maxHeight: count === 1 ? 300 : 140,
                                minHeight: count === 1 ? 100 : 100,
                                objectFit: 'cover',
                                cursor: 'pointer',
                                display: 'block',
                                transition: 'transform 0.2s, opacity 0.2s',
                                '&:hover': { opacity: 0.95, transform: 'scale(1.02)' }
                            }}
                            onClick={() => setImagePreview(url)}
                        />
                    );
                })}
            </Box>
        );
    };

    // Render SYSTEM message (centered, italic style)
    if (message.type === 'SYSTEM') {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    px: 2,
                    py: 1,
                }}
            >
                <Typography
                    sx={{
                        fontSize: 12,
                        color: '#65676b',
                        fontStyle: 'italic',
                        textAlign: 'center',
                        bgcolor: 'rgba(0,0,0,0.05)',
                        px: 2,
                        py: 0.5,
                        borderRadius: 3,
                    }}
                >
                    {message.content}
                </Typography>
            </Box>
        );
    }

    // Render deleted message (Facebook style)
    if (message.isDeleted) {
        return (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: 'column',
                    alignItems: isOwn ? "flex-end" : "flex-start",
                    px: 2,
                    py: 0.3,
                }}
            >
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    flexDirection: isOwn ? 'row-reverse' : 'row'
                }}>
                    {!isOwn && (
                        <Avatar
                            src={avatar}
                            sx={{ width: 28, height: 28, visibility: showAvatar ? "visible" : "hidden", mb: 0.5 }}
                        />
                    )}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            py: 1,
                            px: 1.5,
                            borderRadius: '18px',
                            border: '1px dashed #bcc0c4',
                            bgcolor: 'transparent',
                        }}
                    >
                        <BlockIcon sx={{ fontSize: 16, color: '#65676b' }} />
                        <Typography fontSize={14} color="#65676b" fontStyle="italic">
                            {isOwn ? 'Bạn đã thu hồi tin nhắn' : 'Tin nhắn đã được thu hồi'}
                        </Typography>
                    </Box>
                </Box>
            </Box>
        );
    }

    return (
        <>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: 'column',
                    alignItems: isOwn ? "flex-end" : "flex-start",
                    px: 2,
                    py: 0.3,
                    mb: message.replyTo ? 0.5 : 0,
                    '&:hover .message-hover-actions': { opacity: 1 }
                }}
            >
                <Box sx={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 0.5,
                    maxWidth: '70%',
                    flexDirection: isOwn ? 'row-reverse' : 'row'
                }}>
                    {!isOwn && (
                        <Avatar
                            src={avatar}
                            sx={{ width: 28, height: 28, visibility: showAvatar ? "visible" : "hidden", mb: 0.5 }}
                        />
                    )}

                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                        {/* Reply Quote - Facebook style */}
                        {message.replyTo && (
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'flex-end',
                                    gap: 0.5,
                                    mb: 0.5,
                                    flexDirection: isOwn ? 'row-reverse' : 'row',
                                }}
                            >
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.5,
                                        color: '#65676b',
                                        fontSize: 12,
                                    }}
                                >
                                    <ReplyIcon sx={{ fontSize: 14, transform: 'scaleX(-1)' }} />
                                    <Typography fontSize={12} color="#050505" fontWeight={500}>
                                        {isOwn ? 'Bạn đã trả lời ' : ''}
                                        {(() => {
                                            const replyData = message.replyTo as MessageResponse;
                                            if (replyData.senderId?._id === userId) {
                                                return isOwn ? 'chính mình' : 'bạn';
                                            }
                                            if (replyData.senderId?.firstName && replyData.senderId?.lastName) {
                                                return `${replyData.senderId.firstName} ${replyData.senderId.lastName}`;
                                            }
                                            return 'Người dùng';
                                        })()}
                                    </Typography>
                                </Box>
                            </Box>
                        )}

                        {/* Reply Content Preview */}
                        {message.replyTo && (
                            <Box
                                sx={{
                                    bgcolor: isOwn ? '#d8dadf' : '#d8dadf',
                                    px: 1.5,
                                    py: 0.8,
                                    borderRadius: '12px',
                                    mb: 0.5,
                                    maxWidth: 250,
                                    cursor: 'pointer',
                                }}
                            >
                                <Typography
                                    fontSize={13}
                                    color={'#65676b'}
                                    noWrap
                                    sx={{ fontStyle: 'italic' }}
                                >
                                    {message.replyTo?.content || 'Hình ảnh'}
                                </Typography>
                            </Box>
                        )}

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexDirection: isOwn ? 'row-reverse' : 'row' }}>
                            <Box sx={{ position: 'relative' }}>
                                <Paper
                                    elevation={0}
                                    sx={{
                                        bgcolor: message.attachments?.length && !message.content ? 'transparent' : (isOwn ? themeColor : "#e4e6eb"),
                                        color: isOwn ? "white" : "#050505",
                                        borderRadius: '18px',
                                        overflow: 'hidden',
                                        position: 'relative',
                                        zIndex: 1,
                                    }}
                                >
                                    {/* Main Message Content */}
                                    <Box sx={{ p: message.content ? '8px 12px' : 0 }}>
                                        {isEditing ? (
                                            <Box sx={{ minWidth: 200 }}>
                                                <TextField
                                                    value={editContent}
                                                    autoFocus
                                                    multiline
                                                    maxRows={4}
                                                    variant="standard"
                                                    fullWidth
                                                    onChange={(e) => setEditContent(e.target.value)}
                                                    InputProps={{
                                                        disableUnderline: true,
                                                        sx: { color: 'white', fontSize: 15 }
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                                                        if (e.key === 'Escape') handleCancelEdit();
                                                    }}
                                                />
                                                <Box sx={{ display: 'flex', gap: 1, mt: 0.5, justifyContent: 'flex-end' }}>
                                                    <Typography variant="caption" sx={{ cursor: 'pointer', fontWeight: 600, color: 'white' }} onClick={handleSaveEdit}>Lưu</Typography>
                                                    <Typography variant="caption" sx={{ cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }} onClick={handleCancelEdit}>Hủy</Typography>
                                                </Box>
                                            </Box>
                                        ) : (
                                            <>
                                                {message.content && (
                                                    <Typography fontSize={15} sx={{ lineHeight: 1.4, wordBreak: 'break-word' }}>
                                                        {(() => {
                                                            const parts = message.content.split(/(@\w+|@all)/g);
                                                            return parts.map((part, i) => part.match(/@\w+|@all/) ? (
                                                                <Box component="span" key={i} sx={{ color: isOwn ? 'white' : '#0084ff', fontWeight: 600 }}>{part}</Box>
                                                            ) : part);
                                                        })()}
                                                        {message.isEdited && (
                                                            <Box component="span" sx={{ ml: 1, fontSize: 11, opacity: 0.7 }}>(đã chỉnh sửa)</Box>
                                                        )}
                                                    </Typography>
                                                )}
                                                {renderAttachments()}
                                            </>
                                        )}
                                    </Box>
                                </Paper>
                                {renderEmotionsSummary()}
                            </Box>

                            {/* Hover Actions & Time */}
                            <Box
                                className="message-hover-actions"
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    opacity: 0,
                                    transition: 'opacity 0.15s',
                                    flexDirection: isOwn ? 'row-reverse' : 'row',
                                    gap: 0.2,
                                    zIndex: 100,
                                    bgcolor: 'white',
                                    borderRadius: 3,
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                    px: 0.5,
                                    py: 0.2,
                                }}
                            >
                                <IconButton size="small" onClick={handleReactionOpen} sx={{ p: 0.4, '&:hover': { bgcolor: '#f0f2f5' } }}>
                                    <SentimentSatisfiedAltIcon sx={{ fontSize: 17, color: '#65676b' }} />
                                </IconButton>
                                <IconButton size="small" onClick={() => onReply?.(message)} sx={{ p: 0.4, '&:hover': { bgcolor: '#f0f2f5' } }}>
                                    <ReplyIcon sx={{ fontSize: 17, color: '#65676b' }} />
                                </IconButton>
                                <IconButton size="small" onClick={handleMenuOpen} sx={{ p: 0.4, '&:hover': { bgcolor: '#f0f2f5' } }}>
                                    <MoreHorizIcon sx={{ fontSize: 17, color: '#65676b' }} />
                                </IconButton>
                                <Typography variant="caption" color="#65676b" sx={{ fontSize: 11, mx: 0.5, whiteSpace: 'nowrap' }}>
                                    {formatTime(message.createdAt)}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                </Box>

                {/* Context Menu */}
                <Menu
                    anchorEl={menuAnchor}
                    open={Boolean(menuAnchor)}
                    onClose={handleMenuClose}
                    slotProps={{
                        paper: {
                            sx: {
                                bgcolor: 'white',
                                borderRadius: 2,
                                minWidth: 150,
                                boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                                border: 'none',
                                '& .MuiList-root': { py: 0.5 }
                            }
                        }
                    }}
                >
                    {canEdit && (
                        <MenuItem onClick={handleEdit} sx={{ fontSize: 14, color: '#050505', py: 1 }}>
                            <EditIcon sx={{ mr: 1.5, fontSize: 18, color: '#65676b' }} /> Chỉnh sửa
                        </MenuItem>
                    )}
                    {isOwn && (
                        <MenuItem onClick={handleDelete} sx={{ fontSize: 14, color: '#e74c3c', py: 1 }}>
                            <DeleteIcon sx={{ mr: 1.5, fontSize: 18 }} /> Thu hồi
                        </MenuItem>
                    )}
                </Menu>

                {/* Reaction Picker - Quick Reactions */}
                <Popover
                    open={Boolean(reactionAnchor)}
                    anchorEl={reactionAnchor}
                    onClose={handleReactionClose}
                    anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                    transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                    slotProps={{
                        paper: {
                            sx: {
                                bgcolor: 'white',
                                borderRadius: '28px',
                                boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                                border: 'none',
                                overflow: 'visible',
                                mt: -1
                            }
                        }
                    }}
                >
                    <Box sx={{ display: 'flex', p: '6px 10px', gap: 0.5 }}>
                        {EMOTIONS.map((emotion) => (
                            <IconButton
                                key={emotion.type}
                                onClick={() => handleReaction(emotion.type)}
                                sx={{
                                    fontSize: 24,
                                    p: 0.8,
                                    transition: 'transform 0.15s',
                                    '&:hover': { transform: 'scale(1.25)', bgcolor: 'transparent' }
                                }}
                            >
                                {emotion.emoji}
                            </IconButton>
                        ))}
                    </Box>
                </Popover>
            </Box>

            {/* Image Preview Modal */}
            {imagePreview && (
                <Box
                    onClick={() => setImagePreview(null)}
                    sx={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        bgcolor: 'rgba(0,0,0,0.9)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                    }}
                >
                    <Box
                        component="img"
                        src={imagePreview}
                        sx={{
                            maxWidth: '90vw',
                            maxHeight: '90vh',
                            objectFit: 'contain',
                            borderRadius: 2,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />
                    <IconButton
                        onClick={() => setImagePreview(null)}
                        sx={{
                            position: 'absolute',
                            top: 20,
                            right: 20,
                            color: 'white',
                            bgcolor: 'rgba(255,255,255,0.2)',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
                        }}
                    >
                        <Typography fontSize={24}>×</Typography>
                    </IconButton>
                </Box>
            )}
        </>
    );
}
