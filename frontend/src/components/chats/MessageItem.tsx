'use client';
import ReactPlayer from "react-player";

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
    Tooltip,
} from '@mui/material';
import {
    MoreHoriz as MoreHorizIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Reply as ReplyIcon,
    SentimentSatisfiedAltOutlined as SentimentSatisfiedAltIcon,
    Block as BlockIcon,
    InsertDriveFile as InsertDriveFileIcon,
    PictureAsPdf as PictureAsPdfIcon,
    Description as DescriptionIcon,
    Download as DownloadIcon,
} from '@mui/icons-material';
import { MessageResponse, EmotionType, AttachmentData } from '@/types/chat';
import { formatTime } from '@/utils/formatDate';
import { Socket } from 'socket.io-client';
import { handleDownload } from '@/utils/formatFile';
import PostShareMessage from "@/components/chat/PostShareMessage";
import EmotionListDialog from "@/components/chats/EmotionListDialog";
import { ConversationResponseData } from "@/types/conversation";
import { renderContentWithMentions } from "@/utils/hashtagParser";

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
    conversation: ConversationResponseData;
    socket: Socket | null;
    userId: string;
    onReply?: (message: MessageResponse) => void;
    themeColor?: string;
    isLastOwnMessage?: boolean;
    otherAvatarsNotRead?: string[];
}

export default function MessageItem({
    message,
    isOwn,
    showAvatar,
    avatar,
    conversation,
    socket,
    userId,
    onReply,
    themeColor = '#0084ff',
    isLastOwnMessage = false,
    otherAvatarsNotRead,
}: MessageItemProps) {
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const [reactionAnchor, setReactionAnchor] = useState<HTMLElement | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(message.content || '');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [emotionDialogOpen, setEmotionDialogOpen] = useState(false);

    const canEdit = isOwn && !message.isDeleted && message.content &&
        (new Date().getTime() - new Date(message.createdAt).getTime()) < 15 * 60 * 1000;

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => setMenuAnchor(event.currentTarget);
    const handleMenuClose = () => setMenuAnchor(null);
    const handleReactionOpen = (event: React.MouseEvent<HTMLElement>) => setReactionAnchor(event.currentTarget);
    const handleReactionClose = () => setReactionAnchor(null);

    const handleEdit = () => { handleMenuClose(); setIsEditing(true); setEditContent(message.content || ''); };
    const handleSaveEdit = () => {
        if (socket && editContent.trim() !== message.content) {
            socket.emit('message:edit', { messageId: message._id, conversationId: conversation._id, content: editContent.trim() });
        }
        setIsEditing(false);
    };
    const handleCancelEdit = () => { setIsEditing(false); setEditContent(message.content || ''); };
    const handleDelete = () => { handleMenuClose(); if (socket) socket.emit('message:delete', { messageId: message._id, conversationId: conversation._id }); };

    const handleReaction = (emotionType: EmotionType) => {
        handleReactionClose();
        if (socket) {
            // Handle both string and object userId
            const userReaction = message.emotions?.find(e => {
                const emotionUserId = e.userId;
                return emotionUserId === userId;
            });
            if (userReaction?.emotionType === emotionType) {
                socket.emit('message:reaction:remove', { messageId: message._id, conversationId: conversation._id });
            } else {
                socket.emit('message:reaction', { messageId: message._id, conversationId: conversation._id, emotionType });
            }
        }
    };

    // Render message status indicator (SENT, DELIVERED, READ) - Messenger style
    const renderMessageStatus = () => {
        if (!isOwn || message.isDeleted || !isLastOwnMessage) return null;

        const status = message.status || 'SENT';

        // Show avatar of reader for READ status (đã xem)
        if (status === 'READ' && otherAvatarsNotRead && otherAvatarsNotRead.length > 0) {
            return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {otherAvatarsNotRead.map((avatar, index) => (
                        <Avatar
                            src={avatar}
                            key={index}
                            sx={{
                                width: 14,
                                height: 14,
                            }}
                        />
                    ))}
                </Box>
            );
        }

        // DELIVERED status - "Đã gửi"
        if (status === 'DELIVERED') {
            return (
                <Typography fontSize={11} color="#65676b">
                    Đã gửi
                </Typography>
            );
        }

        // SENT status - "Đã gửi" (chưa được nhận)
        return (
            <Typography fontSize={11} color="#65676b">
                Đã gửi
            </Typography>
        );
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
                onClick={() => setEmotionDialogOpen(true)}
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

    // Helper functions for file display
    const isDocumentAttachment = (attachment: AttachmentData | string) => {
        if (typeof attachment === 'string') {
            return attachment.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar)$/i) ||
                attachment.includes('/raw/') || message.type === 'FILE';
        }
        return attachment.mediaType === 'RAW';
    };

    const getAttachmentUrl = (attachment: AttachmentData | string) => {
        return typeof attachment === 'string' ? attachment : attachment.url;
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    const getFileIcon = (attachment: AttachmentData | string) => {
        const url = typeof attachment === 'string' ? attachment : attachment.url;
        const fileName = typeof attachment === 'string' ? url : attachment.fileName;

        if (fileName.match(/\.pdf$/i) || url.includes('.pdf'))
            return <PictureAsPdfIcon sx={{ color: '#e74c3c', fontSize: 40 }} />;
        if (fileName.match(/\.(doc|docx)$/i) || url.includes('.doc'))
            return <DescriptionIcon sx={{ color: '#2b5797', fontSize: 40 }} />;
        if (fileName.match(/\.(xls|xlsx)$/i) || url.includes('.xls'))
            return (
                <InsertDriveFileIcon sx={{ color: '#1D6F42', fontSize: 40 }} />
            );
        if (fileName.match(/\.(ppt|pptx)$/i))
            return <DescriptionIcon sx={{ color: '#d24726', fontSize: 40 }} />;
        return <InsertDriveFileIcon sx={{ color: '#65676b', fontSize: 40 }} />;
    };

    // Render attachments (images/videos/files)
    const renderAttachments = () => {
        if (!message.attachments || message.attachments.length === 0) return null;
        const hasContent = !!message.content;

        // Separate media and documents
        const mediaAttachments = message.attachments.filter(att => !isDocumentAttachment(att));
        const documentAttachments = message.attachments.filter(att => isDocumentAttachment(att));

        return (
            <Box sx={{ mt: hasContent ? 0.5 : 0 }}>
                {/* Render media (images/videos) */}
                {mediaAttachments.length > 0 && (
                    <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: mediaAttachments.length === 1 ? '1fr' : mediaAttachments.length === 2 ? '1fr 1fr' : 'repeat(2, 1fr)',
                        gap: '2px',
                        maxWidth: 280,
                        borderRadius: '18px',
                        overflow: 'hidden',
                        mb: documentAttachments.length > 0 ? 1 : 0
                    }}>
                        {mediaAttachments.map((att, index) => {
                            const url = getAttachmentUrl(att);
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
                                        height: mediaAttachments.length === 1 ? 'auto' : 140,
                                        maxHeight: mediaAttachments.length === 1 ? 300 : 140,
                                        minHeight: mediaAttachments.length === 1 ? 100 : 100,
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
                )}

                {/* Render document files - Facebook Messenger style */}
                {documentAttachments.map((att, index) => {
                    const url = getAttachmentUrl(att);
                    const fileName = typeof att === 'string' ? url.split('/').pop()?.split('?')[0] || 'document' : att.fileName;
                    const fileSize = typeof att === 'string' ? null : att.fileSize;

                    return (
                        <Box
                            key={`doc-${index}`}
                            component="a"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => handleDownload(att.url, att.fileName)}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                cursor: 'pointer',
                                gap: 1.5,
                                p: 1.5,
                                bgcolor: '#fff',
                                borderRadius: 2,
                                textDecoration: 'none',
                                maxWidth: 280,
                                mb: index < documentAttachments.length - 1 ? 0.5 : 0,
                                border: isOwn ? '1px solid rgba(255,255,255,0.2)' : '1px solid #e4e6eb',
                                transition: 'all 0.2s',
                                '&:hover': {
                                    bgcolor: '#f0f2f5',
                                }
                            }}
                        >
                            {getFileIcon(att)}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography
                                    fontSize={13}
                                    fontWeight={500}
                                    noWrap
                                    sx={{ color: '#050505' }}
                                >
                                    {fileName}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    {fileSize && (
                                        <Typography fontSize={11} sx={{ color: '#65676b' }}>
                                            {formatFileSize(fileSize)}
                                        </Typography>
                                    )}
                                    <Typography fontSize={11} sx={{ color: '#65676b' }}>
                                        {fileSize ? ' · ' : ''}Tải về để xem lâu dài
                                    </Typography>
                                </Box>
                            </Box>
                            <DownloadIcon sx={{ color: '#65676b', fontSize: 24 }} />
                        </Box>
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

    // Render STORY_REPLY message (Facebook style)
    if (message.type === 'STORY_REPLY' && message.storyReply) {
        return (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: 'column',
                    alignItems: isOwn ? "flex-end" : "flex-start",
                    px: 2,
                    py: 0.3,
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
                        <Box sx={{ position: 'relative' }}>
                            <Paper
                                elevation={0}
                                sx={{
                                    bgcolor: isOwn ? themeColor : "#e4e6eb",
                                    color: "black",
                                    borderRadius: '18px',
                                    overflow: 'hidden',
                                    maxWidth: 280,
                                }}
                            >
                                {/* Story reference header */}
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.5,
                                        px: 1.5,
                                        py: 0.8,
                                        bgcolor: 'rgba(0,0,0,0.15)',
                                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 14,
                                            height: 14,
                                            borderRadius: '50%',
                                            border: '2px solid',
                                            borderColor: 'rgba(255,255,255,0.6)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                width: 5,
                                                height: 5,
                                                borderRadius: '50%',
                                                bgcolor: 'rgba(255,255,255,0.6)',
                                            }}
                                        />
                                    </Box>
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            color: isOwn ? 'white' : 'black',
                                            fontSize: 11,
                                        }}
                                    >
                                        Đã trả lời tin của {message.storyReply.storyOwnerName}
                                    </Typography>
                                </Box>

                                {/* Story thumbnail */}
                                <Box
                                    sx={{
                                        position: 'relative',
                                        width: '100%',
                                        height: 140,
                                        bgcolor: '#000',
                                    }}
                                >

                                    <ReactPlayer
                                        src={message.storyReply.storyMediaUrl}
                                        light={message.storyReply.storyMediaUrl.replace('/upload/', '/upload/so_1/')
                                            .replace('.mp4', '.jpg')}
                                        playing={false}
                                        preload="hidden"
                                        previewTabIndex={0}
                                        width="100%"
                                        height="100%"
                                        controls
                                    />
                                    {/* Story caption overlay */}
                                    {message.storyReply.storyCaption && (
                                        <Box
                                            sx={{
                                                position: 'absolute',
                                                bottom: 0,
                                                left: 0,
                                                right: 0,
                                                background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                                                px: 1.5,
                                                py: 0.8,
                                            }}
                                        >
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    color: 'white',
                                                    fontSize: 11,
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                {message.storyReply.storyCaption}
                                            </Typography>
                                        </Box>
                                    )}
                                </Box>

                                {/* Reply message content */}
                                <Box sx={{ p: 1.5 }}>
                                    <Typography
                                        sx={{
                                            color: isOwn ? 'white' : 'black',
                                            fontSize: 14,
                                            wordBreak: 'break-word',
                                            whiteSpace: 'pre-wrap',
                                        }}
                                    >
                                        {renderContentWithMentions(message.content)}
                                    </Typography>
                                </Box>
                            </Paper>
                            {renderEmotionsSummary()}
                        </Box>

                        {/* Time */}
                        <Typography sx={{ fontSize: 11, color: '#65676b', mt: 0.3, px: 0.5 }}>
                            {formatTime(message.createdAt)}
                        </Typography>
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
                        {isOwn &&
                            <IconButton size="small" onClick={handleMenuOpen} sx={{ p: 0.4, '&:hover': { bgcolor: '#f0f2f5' } }}>
                                <MoreHorizIcon sx={{ fontSize: 17, color: '#65676b' }} />
                            </IconButton>
                        }
                        <Typography variant="caption" color="#65676b" sx={{ fontSize: 11, mx: 0.5, whiteSpace: 'nowrap' }}>
                            {formatTime(message.createdAt)}
                        </Typography>
                    </Box>
                </Box>


                {/* Message Status Indicator - only show on last own message */}
                {isOwn && isLastOwnMessage && (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', pr: 2, mt: 0.3 }}>
                        {renderMessageStatus()}
                    </Box>
                )}

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

    if (message.type === 'POST' && message.postId) {
        return (
            <PostShareMessage
                avatar={avatar}
                isOwn={isOwn}
                post={message.postId}
            />
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
                                    {renderContentWithMentions(message.replyTo?.content) || 'Hình ảnh'}
                                </Typography>
                            </Box>
                        )}

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexDirection: isOwn ? 'row-reverse' : 'row' }}>
                            <Box sx={{ position: 'relative' }}>
                                {message.isEdited && (
                                    <Box component="span" sx={{ fontSize: 11, opacity: 0.7, width: "100%" }}>
                                        <Typography sx={{ textAlign: isOwn ? "right" : "left", fontSize: "12px" }}>Edited</Typography>
                                    </Box>
                                )}
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
                                    <Box sx={{ p: message.content ? '8px 12px' : 0, position: "relative" }}>
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
                                                        sx: { color: 'black', fontSize: 15, backgroundColor: "white", borderRadius: "15px", padding: "2px 5px" }
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
                                                    <Typography component="div" fontSize={15} sx={{ lineHeight: 1.4, wordBreak: 'break-word' }}>
                                                        {renderContentWithMentions(message.content)}
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
                                {isOwn &&
                                    <IconButton size="small" onClick={handleMenuOpen} sx={{ p: 0.4, '&:hover': { bgcolor: '#f0f2f5' } }}>
                                        <MoreHorizIcon sx={{ fontSize: 17, color: '#65676b' }} />
                                    </IconButton>
                                }
                                <Typography variant="caption" color="#65676b" sx={{ fontSize: 11, mx: 0.5, whiteSpace: 'nowrap' }}>
                                    {formatTime(message.createdAt)}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                </Box>

                {/* Message Status Indicator - only show on last own message */}
                {isOwn && isLastOwnMessage && (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', pr: 2, mt: 0.3 }}>
                        {renderMessageStatus()}
                    </Box>
                )}

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
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                    transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                    slotProps={{
                        paper: {
                            sx: {
                                bgcolor: 'white',
                                borderRadius: '28px',
                                // boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                                border: 'none',
                                overflow: 'visible',
                                mt: -1
                            }
                        }
                    }}
                >
                    <Box sx={{ display: 'flex', p: '6px 10px', gap: 0.5 }}>
                        {EMOTIONS.map((reaction) => (
                            <Tooltip key={reaction.type} title={reaction.label} placement="bottom">
                                <Box
                                    onClick={() => handleReaction(reaction.type)}
                                    sx={{
                                        fontSize: 24,
                                        cursor: "pointer",
                                        transition: "transform 0.2s",
                                        "&:hover": {
                                            transform: "scale(1.3)",
                                        },
                                    }}
                                >
                                    {reaction.emoji}
                                </Box>
                            </Tooltip>
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

            {/* Emotion List Dialog */}
            <EmotionListDialog
                open={emotionDialogOpen}
                onClose={() => setEmotionDialogOpen(false)}
                emotions={message.emotions || []}
                participants={conversation.participants}
            />
        </>
    );
}
