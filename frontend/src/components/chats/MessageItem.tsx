'use client';
import ReactPlayer from "react-player";

import React, { useState, memo } from 'react';
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
    useTheme,
    CircularProgress,
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
    IntegrationInstructions as IntegrationInstructionsIcon,
    Phone as PhoneIcon,
    Videocam as VideocamIcon,
    PhoneMissed as PhoneMissedIcon,
    CallEnd as CallEndIcon,
    ErrorOutline as ErrorOutlineIcon,
} from '@mui/icons-material';
import { MessageResponse, EmotionType, AttachmentData, CallData } from '@/types/chat';
import { formatChatTimestamp } from '@/utils/formatDate';
import { Socket } from 'socket.io-client';
import { handleDownload } from '@/utils/formatFile';
import PostShareMessage from "@/components/chat/PostShareMessage";
import EmotionListDialog from "@/components/chats/EmotionListDialog";
import { ConversationParticipantUser, ConversationResponseData } from "@/types/conversation";
import { renderContentWithMentions } from "@/utils/hashtagParser";
import TypewriterText from "@/components/chats/TypewriterText";
import { useTranslation } from 'react-i18next';
import { useCall } from '@/contexts/CallContext';

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
    avatar: string;
    conversation: ConversationResponseData;
    socket: Socket | null;
    userId: string;
    onReply?: (message: MessageResponse) => void;
    themeColor?: string;
    isLastOwnMessage?: boolean;
    otherAvatarsNotRead: Array<{ user: ConversationParticipantUser, userId: string, seenIndex: number }> | [];
    isStreaming?: boolean;
}

function MessageItemInner({
    message,
    isOwn,
    avatar,
    conversation,
    socket,
    userId,
    onReply,
    themeColor = '#0084ff',
    isLastOwnMessage = false,
    otherAvatarsNotRead,
    isStreaming = false,
}: MessageItemProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const { t } = useTranslation();
    const { callUser, startGroupCall } = useCall();
    const hoverBg = 'action.hover';
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const [reactionAnchor, setReactionAnchor] = useState<HTMLElement | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(message.content || '');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [emotionDialogOpen, setEmotionDialogOpen] = useState(false);

    const canEdit = isOwn && !message.isDeleted && message.content &&
        (new Date().getTime() - new Date(message.createdAt).getTime()) < 15 * 60 * 1000;

    // Optimistic UI flags (must be declared before any render functions that use them)
    const isOptimistic = message._isOptimistic;
    const isUploadingMedia = message._isUploading;
    const sendFailed = message._sendFailed;

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
        if (!isOwn || message.isDeleted) return null;

        // Show failed state
        if (sendFailed) {
            return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <ErrorOutlineIcon sx={{ fontSize: 14, color: '#e74c3c' }} />
                    <Typography fontSize={11} color="#e74c3c" fontWeight={500}>
                        {t('chat.send_failed') || 'Gửi thất bại'}
                    </Typography>
                </Box>
            );
        }

        // Show uploading state
        if (isUploadingMedia) {
            return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CircularProgress size={10} sx={{ color: 'text.secondary' }} />
                    <Typography fontSize={11} color="text.secondary">
                        {t('chat.uploading') || 'Đang tải lên...'}
                    </Typography>
                </Box>
            );
        }

        // Show optimistic "sending" state
        if (isOptimistic) {
            return (
                <Typography fontSize={11} color="text.secondary">
                    {t('chat.sending') || 'Đang gửi...'}
                </Typography>
            );
        }

        // Show avatar of reader (Facepile) - independent of status
        if (otherAvatarsNotRead && otherAvatarsNotRead.length > 0) {
            return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                    {otherAvatarsNotRead.map((data, index) => (
                        <Avatar
                            src={data?.user.avatar || ''}
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

        // Text status only for the Last Own Message
        if (!isLastOwnMessage) return null;

        // SENT status - "Đã gửi" (chưa được nhận)
        return (
            <Typography fontSize={11} color="text.secondary">
                {t('chat.sent')}
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
                    bgcolor: 'background.paper',
                    borderRadius: '10px',
                    px: '6px',
                    py: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    cursor: 'pointer',
                    zIndex: 10,
                    border: `1px solid ${theme.palette.divider}`,
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
                    <Typography fontSize={11} fontWeight={600} color="text.secondary" sx={{ ml: 0.3 }}>
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
        if (fileName.match(/\.rar$/i))
            return <IntegrationInstructionsIcon sx={{ color: '#d24726', fontSize: 40 }} />;
        return <InsertDriveFileIcon sx={{ color: 'text.secondary', fontSize: 40 }} />;
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
                        maxWidth: { xs: 260, sm: 280 },
                        borderRadius: '18px',
                        overflow: 'hidden',
                        mb: documentAttachments.length > 0 ? 1 : 0
                    }}>
                        {mediaAttachments.map((att, index) => {
                            const url = getAttachmentUrl(att);
                            const isVideo = url.match(/\.(mp4|webm|ogg)$/i) || url.includes('video');

                            if (isVideo) {
                                return (
                                    <Box key={index} sx={{ overflow: 'hidden', position: 'relative' }}>
                                        <video
                                            src={url}
                                            controls={!isUploadingMedia}
                                            style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }}
                                        />
                                        {isUploadingMedia && (
                                            <Box sx={{
                                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                bgcolor: 'rgba(0,0,0,0.4)', borderRadius: 'inherit',
                                            }}>
                                                <CircularProgress size={32} sx={{ color: 'white' }} />
                                            </Box>
                                        )}
                                    </Box>
                                );
                            }

                            return (
                                <Box key={index} sx={{ position: 'relative', overflow: 'hidden' }}>
                                    <Box
                                        component="img"
                                        src={url}
                                        alt="attachment"
                                        loading="lazy"
                                        sx={{
                                            width: '100%',
                                            height: mediaAttachments.length === 1 ? 'auto' : 140,
                                            maxHeight: mediaAttachments.length === 1 ? 300 : 140,
                                            minHeight: mediaAttachments.length === 1 ? 100 : 100,
                                            objectFit: 'cover',
                                            cursor: isUploadingMedia ? 'default' : 'pointer',
                                            display: 'block',
                                            transition: 'transform 0.2s, opacity 0.2s',
                                            '&:hover': isUploadingMedia ? {} : { opacity: 0.95, transform: 'scale(1.02)' }
                                        }}
                                        onClick={() => !isUploadingMedia && setImagePreview(url)}
                                    />
                                    {isUploadingMedia && (
                                        <Box sx={{
                                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            bgcolor: 'rgba(0,0,0,0.35)', borderRadius: 'inherit',
                                        }}>
                                            <CircularProgress size={32} sx={{ color: 'white' }} />
                                        </Box>
                                    )}
                                </Box>
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
                                bgcolor: 'background.paper',
                                borderRadius: 2,
                                textDecoration: 'none',
                                maxWidth: 280,
                                mb: index < documentAttachments.length - 1 ? 0.5 : 0,
                                border: `1px solid ${theme.palette.divider}`,
                                transition: 'all 0.2s',
                                '&:hover': {
                                    bgcolor: hoverBg,
                                }
                            }}
                        >
                            {getFileIcon(att)}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography
                                    fontSize={13}
                                    fontWeight={500}
                                    noWrap
                                    sx={{ color: 'text.primary' }}
                                >
                                    {fileName}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    {fileSize && (
                                        <Typography fontSize={11} sx={{ color: 'text.secondary' }}>
                                            {formatFileSize(fileSize)}
                                        </Typography>
                                    )}
                                    <Typography fontSize={11} sx={{ color: 'text.secondary' }}>
                                        {isUploadingMedia ? t('chat.uploading') || 'Đang tải lên...' : (fileSize ? ' · ' : '') + t('chat.download_to_keep')}
                                    </Typography>
                                </Box>
                            </Box>
                            {isUploadingMedia ? (
                                <CircularProgress size={20} sx={{ color: 'text.secondary' }} />
                            ) : (
                                <DownloadIcon sx={{ color: 'text.secondary', fontSize: 24 }} />
                            )}
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
                        color: 'text.secondary',
                        fontStyle: 'italic',
                        textAlign: 'center',
                        bgcolor: 'action.selected',
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

    // Render CALL message (Zalo/FB Messenger style)
    if (message.type === 'CALL') {
        const callData = message.callData;
        const isVideo = callData?.callType === 'VIDEO';
        const isMissed = callData?.callStatus === 'MISSED';
        const isCancelled = callData?.callStatus === 'CANCELLED';
        const isOngoing = callData?.callStatus === 'ONGOING';
        const isAnswered = callData?.callStatus === 'ANSWERED';
        const isGroupConv = callData?.isGroup || conversation?.type === 'GROUP';
        const duration = callData?.duration || 0;

        const formatDuration = (sec: number) => {
            const m = Math.floor(sec / 60);
            const s = sec % 60;
            return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `0:${s.toString().padStart(2, '0')}`;
        };

        // Call status text
        let statusText = '';
        if (isMissed) {
            statusText = isOwn ? t('call_history.outgoing_missed') : t('call_history.incoming_missed');
        } else if (isCancelled) {
            statusText = isOwn ? t('call_history.you_cancelled') : t('call_history.they_cancelled');
        } else if (isOngoing) {
            statusText = t('call_history.ongoing');
        } else if (isAnswered) {
            statusText = `${isVideo ? t('call_history.video_call') : t('call_history.voice_call')} · ${formatDuration(duration)}`;
        }

        // Format relative time for call messages (e.g., "5 phút trước")
        const getCallRelativeTime = (createdAt: string) => {
            const now = new Date();
            const callTime = new Date(createdAt);
            const diffMs = now.getTime() - callTime.getTime();
            const diffMinutes = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);

            if (diffMinutes < 1) return t('call_history.just_now') || 'Vừa xong';
            if (diffMinutes < 60) return `${diffMinutes} ${t('call_history.minutes_ago') || 'phút trước'}`;
            if (diffHours < 24) return `${diffHours} ${t('call_history.hours_ago') || 'giờ trước'}`;
            return formatChatTimestamp(createdAt);
        };

        // Icon and color
        const iconColor = (isMissed || isCancelled) ? '#f44336' : isOngoing ? '#4caf50' : 'text.secondary';
        const CallIcon = (isMissed || isCancelled)
            ? (isVideo ? CallEndIcon : PhoneMissedIcon)
            : (isVideo ? VideocamIcon : PhoneIcon);

        const handleCallback = () => {
            if (isGroupConv) {
                startGroupCall(conversation._id, !isVideo);
            } else {
                const otherUser = conversation?.participants?.find(
                    (p) => p.user._id !== userId
                );
                if (otherUser) {
                    startGroupCall(conversation._id, !isVideo);
                }
            }
        };

        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', px: 2, py: 0.5 }}>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                        borderRadius: 3,
                        px: 2.5,
                        py: 1.2,
                        maxWidth: 340,
                        width: 'fit-content',
                    }}
                >
                    {/* Call icon */}
                    <Box
                        sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: (isMissed || isCancelled)
                                ? 'rgba(244,67,54,0.1)'
                                : isOngoing
                                    ? 'rgba(76,175,80,0.1)'
                                    : 'rgba(0,0,0,0.06)',
                            flexShrink: 0,
                        }}
                    >
                        <CallIcon sx={{ fontSize: 20, color: iconColor }} />
                    </Box>

                    {/* Call info */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 500, color: 'text.primary', lineHeight: 1.3 }}>
                            {isVideo ? t('call_history.video_call') : t('call_history.voice_call')}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: (isMissed || isCancelled) ? '#f44336' : 'text.secondary', lineHeight: 1.4 }}>
                            {statusText}
                            {' · '}
                            {getCallRelativeTime(message.createdAt)}
                        </Typography>
                    </Box>

                    {/* Callback button */}
                    {!isOngoing && (
                        <Tooltip title={t('call_history.call_back')}>
                            <IconButton
                                size="small"
                                onClick={handleCallback}
                                sx={{
                                    color: themeColor,
                                    '&:hover': { bgcolor: `${themeColor}15` },
                                }}
                            >
                                {isVideo ? <VideocamIcon fontSize="small" /> : <PhoneIcon fontSize="small" />}
                            </IconButton>
                        </Tooltip>
                    )}

                    {/* Join button for ongoing group calls */}
                    {isOngoing && !isOwn && isGroupConv && (
                        <Typography
                            component="span"
                            onClick={handleCallback}
                            sx={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: '#4caf50',
                                cursor: 'pointer',
                                '&:hover': { textDecoration: 'underline' },
                                flexShrink: 0,
                            }}
                        >
                            {t('call_history.join')}
                        </Typography>
                    )}
                </Box>
            </Box>
        );
    }

    // Render CHATBOT message (AI-style with distinct appearance)
    if (message.type === 'CHATBOT') {
        return (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: 'column',
                    alignItems: "flex-start",
                    px: { xs: 1, sm: 2 },
                    py: 0.5,
                    animation: 'fadeInUp 0.3s ease-out',
                    '@keyframes fadeInUp': {
                        '0%': {
                            opacity: 0,
                            transform: 'translateY(10px)',
                        },
                        '100%': {
                            opacity: 1,
                            transform: 'translateY(0)',
                        },
                    },
                    '&:hover .message-hover-actions': { opacity: 1 },
                }}
            >
                <Box sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1,
                    maxWidth: { xs: '92%', sm: '80%', md: '75%' },
                }}>
                    {/* Chatbot Avatar - Gradient AI style */}
                    <Avatar
                        sx={{
                            width: 32,
                            height: 32,
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            boxShadow: '0 2px 8px rgba(102, 126, 234, 0.4)',
                            flexShrink: 0,
                        }}
                    >
                        <Box
                            component="span"
                            sx={{
                                fontSize: 18,
                                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))',
                            }}
                        >
                            🤖
                        </Box>
                    </Avatar>

                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        {/* Chatbot name label */}
                        <Typography
                            sx={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: '#667eea',
                                mb: 0.3,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                            }}
                        >
                            <Box
                                component="span"
                                sx={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    bgcolor: '#10b981',
                                    animation: 'pulse 2s infinite',
                                    '@keyframes pulse': {
                                        '0%, 100%': { opacity: 1 },
                                        '50%': { opacity: 0.5 },
                                    },
                                }}
                            />
                            AI Assistant
                        </Typography>

                        <Box sx={{ position: 'relative' }}>
                            <Paper
                                elevation={0}
                                sx={{
                                    background: isDark
                                        ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                                        : 'linear-gradient(135deg, #f6f8fc 0%, #f0f4ff 100%)',
                                    border: isDark ? '1px solid rgba(102, 126, 234, 0.3)' : '1px solid rgba(102, 126, 234, 0.15)',
                                    color: 'text.primary',
                                    borderRadius: '4px 18px 18px 18px',
                                    overflow: 'hidden',
                                    position: 'relative',
                                    '&::before': {
                                        content: '""',
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        height: '2px',
                                        background: 'linear-gradient(90deg, #667eea, #764ba2)',
                                    },
                                }}
                            >
                                <Box sx={{ p: '10px 14px' }}>
                                    <Box
                                        sx={{
                                            fontSize: 14,
                                            lineHeight: 1.6,
                                            wordBreak: 'break-word',
                                            whiteSpace: 'pre-wrap',
                                        }}
                                    >
                                        <TypewriterText
                                            text={message.content || ''}
                                            speed={12}
                                            isNew={!isStreaming && new Date().getTime() - new Date(message.createdAt).getTime() < 10000}
                                            isStreaming={isStreaming}
                                        />
                                    </Box>

                                    {/* Render AI-recommended posts if exists */}
                                    {message.postIdsRecommendationfromAI && message.postIdsRecommendationfromAI.length > 0 && (
                                        <Box
                                            sx={{
                                                mt: 2,
                                                pt: 2,
                                                borderTop: '1px solid rgba(102, 126, 234, 0.15)',
                                            }}
                                        >
                                            <Typography
                                                sx={{
                                                    fontSize: 11,
                                                    color: '#667eea',
                                                    mb: 1,
                                                    fontWeight: 500,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 0.5,
                                                }}
                                            >
                                                📎 {t('chat.suggested_posts')} ({message.postIdsRecommendationfromAI.length})
                                            </Typography>
                                            <Box sx={{
                                                display: 'flex',
                                                flexDirection: 'row',
                                                flexWrap: 'wrap',
                                                gap: 1,
                                            }}>
                                                {message.postIdsRecommendationfromAI.map((post, index) => (
                                                    <PostShareMessage
                                                        key={post._id || index}
                                                        isOwn={false}
                                                        post={post}
                                                        compact
                                                    />
                                                ))}
                                            </Box>
                                        </Box>
                                    )}

                                    {/* Fallback: Render single postId if exists (for backward compatibility) */}
                                    {message.postId && !message.postIdsRecommendationfromAI?.length && (
                                        <Box
                                            sx={{
                                                mt: 2,
                                                pt: 2,
                                                borderTop: '1px solid rgba(102, 126, 234, 0.15)',
                                            }}
                                        >
                                            <Typography
                                                sx={{
                                                    fontSize: 11,
                                                    color: '#667eea',
                                                    mb: 1,
                                                    fontWeight: 500,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 0.5,
                                                }}
                                            >
                                                📎 {t('chat.suggested_posts')}
                                            </Typography>
                                            <PostShareMessage isOwn={false} post={message.postId} />
                                        </Box>
                                    )}
                                </Box>
                            </Paper>
                            {renderEmotionsSummary()}
                        </Box>

                        {/* Time */}
                        <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.3, px: 0.5 }}>
                            {formatChatTimestamp(message.createdAt)}
                        </Typography>
                    </Box>

                    {/* Hover Actions */}
                    <Box
                        className="message-hover-actions"
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            opacity: 0,
                            transition: 'opacity 0.15s',
                            gap: 0.2,
                            zIndex: 100,
                            bgcolor: 'background.paper',
                            borderRadius: 3,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            px: 0.5,
                            py: 0.2,
                            alignSelf: 'center',
                        }}
                    >
                        <IconButton size="small" onClick={handleReactionOpen} sx={{ p: 0.4, '&:hover': { bgcolor: hoverBg } }}>
                            <SentimentSatisfiedAltIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
                        </IconButton>
                        <IconButton size="small" onClick={() => onReply?.(message)} sx={{ p: 0.4, '&:hover': { bgcolor: hoverBg } }}>
                            <ReplyIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
                        </IconButton>
                    </Box>
                </Box>

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

    // Render STORY_REPLY message (Facebook style)
    if (message.type === 'STORY_REPLY' && message.storyReply) {
        return (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: 'column',
                    alignItems: isOwn ? "flex-end" : "flex-start",
                    px: { xs: 1, sm: 2 },
                    py: 0.3,
                    '&:hover .message-hover-actions': { opacity: 1 }
                }}
            >
                <Box sx={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 0.5,
                    maxWidth: { xs: '88%', sm: '75%', md: '70%' },
                    flexDirection: isOwn ? 'row-reverse' : 'row'
                }}>
                    {!isOwn && (
                        <Avatar
                            src={avatar}
                            sx={{ width: 28, height: 28, visibility: "visible", mb: 0.5 }}
                        />
                    )}

                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                        <Box sx={{ position: 'relative' }}>
                            <Paper
                                elevation={0}
                                sx={{
                                    bgcolor: isOwn ? themeColor : (isDark ? 'action.selected' : "#e4e6eb"),
                                    color: isOwn ? 'white' : 'text.primary',
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
                                            color: isOwn ? 'white' : 'text.primary',
                                            fontSize: 11,
                                        }}
                                    >
                                        {t('chat.replied_to_story_of', { name: message.storyReply.storyOwnerName })}
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
                                            color: isOwn ? 'white' : 'text.primary',
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
                            {formatChatTimestamp(message.createdAt)}
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
                            {formatChatTimestamp(message.createdAt)}
                        </Typography>
                    </Box>
                </Box>


                {/* Message Status Indicator - only show on last own message */}
                {isOwn && (
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
                            <EditIcon sx={{ mr: 1.5, fontSize: 18, color: '#65676b' }} /> {t('chat.edit_message')}
                        </MenuItem>
                    )}
                    {isOwn && (
                        <MenuItem onClick={handleDelete} sx={{ fontSize: 14, color: '#e74c3c', py: 1 }}>
                            <DeleteIcon sx={{ mr: 1.5, fontSize: 18 }} /> {t('chat.unsend')}
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
                            sx={{ width: 28, height: 28, visibility: "visible", mb: 0.5 }}
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
                            {isOwn ? t('chat.you_unsent_message') : t('chat.message_was_unsent')}
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
                    px: { xs: 1, sm: 2 },
                    py: 0.3,
                    mb: message.replyTo ? 0.5 : 0,
                    '&:hover .message-hover-actions': { opacity: 1 }
                }}
            >
                <Box sx={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 0.5,
                    maxWidth: { xs: '85%', sm: '75%', md: '70%' },
                    flexDirection: isOwn ? 'row-reverse' : 'row'
                }}>
                    {!isOwn && (
                        <Avatar
                            src={avatar}
                            sx={{ width: 28, height: 28, visibility: "visible", mb: 0.5 }}
                        />
                    )}

                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start', minWidth: 0 }}>
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
                                    <Typography fontSize={12} color="text.primary" fontWeight={500}>
                                        {isOwn ? t('chat.you_replied') : ''}
                                        {(() => {
                                            const replyData = message.replyTo as MessageResponse;
                                            if (replyData.senderId?._id === userId) {
                                                return isOwn ? t('chat.self_reply') : t('chat.reply_to_you');
                                            }
                                            if (replyData.senderId?.firstName && replyData.senderId?.lastName) {
                                                return `${replyData.senderId.firstName} ${replyData.senderId.lastName}`;
                                            }
                                            return t('chat.unknown_user');
                                        })()}
                                    </Typography>
                                </Box>
                            </Box>
                        )}

                        {/* Reply Content Preview */}
                        {message.replyTo && (
                            <Box
                                sx={{
                                    bgcolor: isOwn ? 'action.hover' : 'action.hover',
                                    px: 1.5,
                                    py: 0.8,
                                    borderRadius: '12px',
                                    mb: 0.5,
                                    maxWidth: 250,
                                    cursor: 'pointer',
                                    border: isOwn ? 'none' : `1px solid ${theme.palette.divider}`,

                                }}
                            >
                                <Typography
                                    fontSize={13}
                                    color="text.secondary"
                                    noWrap
                                    sx={{ fontStyle: 'italic' }}
                                >
                                    {renderContentWithMentions(message.replyTo?.content) || t('chat.send_photo')}
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
                                        bgcolor: message.attachments?.length && !message.content ? 'transparent' : (isOwn ? themeColor : "action.hover"),
                                        color: isOwn ? "white" : "text.primary",
                                        borderRadius: '18px',
                                        overflow: 'hidden',
                                        position: 'relative',
                                        zIndex: 1,
                                        opacity: sendFailed ? 0.5 : 1,
                                        transition: 'opacity 0.2s',
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
                                                        sx: { color: 'text.primary', fontSize: 15, backgroundColor: "background.paper", borderRadius: "15px", padding: "2px 5px" }
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                                                        if (e.key === 'Escape') handleCancelEdit();
                                                    }}
                                                />
                                                <Box sx={{ display: 'flex', gap: 1, mt: 0.5, justifyContent: 'flex-end' }}>
                                                    <Typography variant="caption" sx={{ cursor: 'pointer', fontWeight: 600, color: 'white' }} onClick={handleSaveEdit}>{t('common.save')}</Typography>
                                                    <Typography variant="caption" sx={{ cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }} onClick={handleCancelEdit}>{t('common.cancel')}</Typography>
                                                </Box>
                                            </Box>
                                        ) : (
                                            <>
                                                {message.content && (
                                                    <Typography component="div" fontSize={{ xs: 14, md: 15 }} sx={{ lineHeight: 1.4, wordBreak: 'break-word', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
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

                            {/* Hover Actions & Time - Hide for optimistic messages */}
                            {!isOptimistic && (
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
                                        bgcolor: 'background.paper',
                                        borderRadius: 3,
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                        px: 0.5,
                                        py: 0.2,
                                    }}
                                >
                                    <IconButton size="small" onClick={handleReactionOpen} sx={{ p: 0.4, '&:hover': { bgcolor: 'action.hover' } }}>
                                        <SentimentSatisfiedAltIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
                                    </IconButton>
                                    <IconButton size="small" onClick={() => onReply?.(message)} sx={{ p: 0.4, '&:hover': { bgcolor: 'action.hover' } }}>
                                        <ReplyIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
                                    </IconButton>
                                    {isOwn &&
                                        <IconButton size="small" onClick={handleMenuOpen} sx={{ p: 0.4, '&:hover': { bgcolor: 'action.hover' } }}>
                                            <MoreHorizIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
                                        </IconButton>
                                    }
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, mx: 0.5, whiteSpace: 'nowrap' }}>
                                        {formatChatTimestamp(message.createdAt)}
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    </Box>
                </Box>

                {/* Message Status Indicator - show for optimistic or last own message */}
                {isOwn && (
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
                                bgcolor: 'background.paper',
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
                        <MenuItem onClick={handleEdit} sx={{ fontSize: 14, color: 'text.primary', py: 1 }}>
                            <EditIcon sx={{ mr: 1.5, fontSize: 18, color: '#65676b' }} /> {t('chat.edit_message')}
                        </MenuItem>
                    )}
                    {isOwn && (
                        <MenuItem onClick={handleDelete} sx={{ fontSize: 14, color: '#e74c3c', py: 1 }}>
                            <DeleteIcon sx={{ mr: 1.5, fontSize: 18 }} /> {t('chat.unsend')}
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
                                bgcolor: 'background.paper',
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
            {
                imagePreview && (
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
                )
            }

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

const MessageItem = memo(MessageItemInner, (prev, next) => {
    // Only re-render when meaningful props change
    if (prev.message !== next.message) return false;
    if (prev.isOwn !== next.isOwn) return false;
    if (prev.isLastOwnMessage !== next.isLastOwnMessage) return false;
    if (prev.isStreaming !== next.isStreaming) return false;
    if (prev.avatar !== next.avatar) return false;
    if (prev.themeColor !== next.themeColor) return false;
    if (prev.otherAvatarsNotRead !== next.otherAvatarsNotRead) return false;
    // socket, conversation, userId, onReply rarely change
    return true;
});

export default MessageItem;
