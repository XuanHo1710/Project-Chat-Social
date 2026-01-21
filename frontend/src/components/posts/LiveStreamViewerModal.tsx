'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
    Dialog,
    Box,
    Typography,
    IconButton,
    Avatar,
    Chip,
    CircularProgress,
    TextField,
    InputAdornment,
    useTheme,
    alpha
} from '@mui/material';
import {
    Close as CloseIcon,
    Visibility as VisibilityIcon,
    FiberManualRecord as LiveIcon,
    Send as SendIcon,
    VolumeUp as VolumeUpIcon,
    VolumeOff as VolumeOffIcon,
    Fullscreen as FullscreenIcon,
    FullscreenExit as FullscreenExitIcon
} from '@mui/icons-material';
import { useSocket } from '@/contexts/SocketContext';
import SimplePeer, { Instance } from 'simple-peer';
import { PostType } from '@/types/post';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { getCommentsByPost } from '@/services/comment.service';

interface LiveStreamViewerModalProps {
    open: boolean;
    onClose: () => void;
    post: PostType;
}

interface LiveComment {
    id: string;
    userId: string;
    userName: string;
    userAvatar: string;
    content: string;
    createdAt: string;
}

interface FloatingReaction {
    id: string;
    emoji: string;
    x: number;
}

const LIVE_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

export default function LiveStreamViewerModal({ open, onClose, post }: LiveStreamViewerModalProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const { socket } = useSocket();

    // Theme colors
    const bgPrimary = isDark ? '#18191a' : '#ffffff';
    const bgSecondary = isDark ? '#242526' : '#f0f2f5';
    const bgTertiary = isDark ? '#3a3b3c' : '#e4e6eb';
    const textPrimary = theme.palette.text.primary;
    const textSecondary = theme.palette.text.secondary;
    const borderColor = isDark ? '#3e4042' : '#dddfe2';
    const primaryColor = theme.palette.primary.main;
    const errorColor = '#e41e3f';

    // States
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'failed' | 'ended'>('connecting');
    const [viewers, setViewers] = useState<number>(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [comments, setComments] = useState<LiveComment[]>([]);
    const [commentInput, setCommentInput] = useState('');
    const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const commentsEndRef = useRef<HTMLDivElement>(null);
    const peerRef = useRef<Instance | null>(null);

    useEffect(() => {
        if (!open || !socket || !post) return;

        setConnectionStatus('connecting');

        console.log('[Viewer] Joining livestream room:', post._id);
        // Viewer should NOT send broadcasterId - only broadcaster sends it
        socket.emit('livestream:join', {
            postId: post._id
        });

        const peer = new SimplePeer({
            initiator: true,
            trickle: true,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        peer.on('signal', (signal) => {
            console.log('[Viewer] Sending signal to broadcaster');
            socket.emit('livestream:signal', {
                toUserId: typeof post.userId === 'string' ? post.userId : post.userId._id,
                signal,
                postId: post._id
            });
        });

        peer.on('stream', (remoteStream) => {
            console.log('[Viewer] Received stream from broadcaster!');
            setStream(remoteStream);
            setConnectionStatus('connected');
            if (videoRef.current) videoRef.current.srcObject = remoteStream;
        });

        peer.on('connect', () => {
            console.log('[Viewer] Connected to broadcaster!');
        });

        peer.on('error', (err) => {
            console.error('[Viewer] Peer Error:', err);
            setConnectionStatus('failed');
        });
        peer.on('close', () => {
            console.log('[Viewer] Connection closed');
            setConnectionStatus('ended');
            setStream(null);
        });

        peerRef.current = peer;

        const handleSignal = (data: { signal: any; fromUserId: string }) => {
            console.log('[Viewer] Received signal from broadcaster:', data.fromUserId);
            peer.signal(data.signal);
        };
        const handleEnded = (data: { postId: string }) => {
            if (data.postId === post._id) {
                setConnectionStatus('ended');
            }
        };
        const handleNewComment = (data: { postId: string; comment: LiveComment }) => {
            if (data.postId === post._id) setComments(prev => [...prev.slice(-100), data.comment]);
        };
        const handleNewReaction = (data: { postId: string; reaction: { id: string; emoji: string } }) => {
            if (data.postId === post._id) {
                const newReaction: FloatingReaction = {
                    id: data.reaction.id,
                    emoji: data.reaction.emoji,
                    x: Math.random() * 60 + 20
                };
                setFloatingReactions(prev => [...prev, newReaction]);
                setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== newReaction.id)), 3000);
            }
        };
        const handleViewersUpdate = (data: { postId: string; count: number }) => {
            console.log('[Viewer] Received livestream:viewers event:', data);
            if (data.postId === post._id) {
                console.log('[Viewer] Setting viewers to:', data.count);
                setViewers(data.count);
            }
        };

        socket.on('livestream:signal', handleSignal);
        socket.on('livestream:ended', handleEnded);
        socket.on('livestream:comment:new', handleNewComment);
        socket.on('livestream:reaction:new', handleNewReaction);
        socket.on('livestream:viewers', handleViewersUpdate);

        socket.emit('livestream:viewer-count', { postId: post._id }, (response: { viewerCount: number }) => {
            console.log('[Viewer] Initial viewer count response:', response);
            if (response?.viewerCount !== undefined) setViewers(response.viewerCount);
        });

        return () => {
            socket.off('livestream:signal', handleSignal);
            socket.off('livestream:ended', handleEnded);
            socket.off('livestream:comment:new', handleNewComment);
            socket.off('livestream:reaction:new', handleNewReaction);
            socket.off('livestream:viewers', handleViewersUpdate);
            socket.emit('livestream:leave', {
                postId: post._id
            });
            peer.destroy();
            peerRef.current = null;
        };
    }, [open, socket, post]);

    // Fetch initial comments
    useEffect(() => {
        if (!open || !post) return;

        const fetchComments = async () => {
            try {
                // Fetch comments for this post
                console.log('[Viewer] Fetching comments for post:', post._id);
                const result = await getCommentsByPost(post._id, 1, 100);
                console.log('[Viewer] Fetched comments result:', result);

                // Map and reverse to show oldest first (chronological order for chat)
                if (result && result.data) {
                    const mappedComments = result.data.map((c: any) => ({
                        id: c._id,
                        userId: c.userId?._id || c.userId, // userId might be population obj or ID
                        userName: c.userId?.firstName ? `${c.userId.firstName} ${c.userId.lastName}` : (c.userId?.name || 'User'),
                        userAvatar: c.userId?.avatar,
                        content: c.content,
                        createdAt: c.createdAt
                    })).reverse();

                    console.log('[Viewer] Mapped comments:', mappedComments);
                    setComments(mappedComments);
                } else {
                    console.log('[Viewer] No comments found or invalid format');
                }
            } catch (err) {
                console.error("Failed to load comments", err);
            }
        };
        fetchComments();
    }, [open, post]);

    useEffect(() => {
        if (stream && videoRef.current) videoRef.current.srcObject = stream;
    }, [stream]);

    useEffect(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [comments]);

    const handleSendComment = () => {
        if (!commentInput.trim() || !socket) return;
        socket.emit('livestream:comment', { postId: post._id, content: commentInput.trim() });
        setCommentInput('');
    };

    const handleSendReaction = (emoji: string) => {
        if (!socket) return;
        socket.emit('livestream:reaction', { postId: post._id, emoji });
    };

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !videoRef.current.muted;
            setIsMuted(!isMuted);
        }
    };

    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const broadcasterName = typeof post.userId !== 'string'
        ? `${post.userId?.firstName || ''} ${post.userId?.lastName || ''}`
        : 'Streamer';
    const broadcasterAvatar = typeof post.userId !== 'string' ? post.userId?.avatar : '';

    return (
        <Dialog open={open} onClose={onClose} fullScreen PaperProps={{ sx: { bgcolor: bgPrimary } }}>
            <Box ref={containerRef} sx={{ height: '100%', display: 'flex', flexDirection: { xs: 'column', lg: 'row' } }}>
                {/* Main Video Area */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                    {/* Header Overlay */}
                    <Box sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        p: 2,
                        zIndex: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
                        pointerEvents: 'none',
                        '& > *': { pointerEvents: 'auto' }
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <IconButton onClick={onClose} sx={{ bgcolor: 'rgba(0,0,0,0.4)', color: 'white' }}>
                                <CloseIcon />
                            </IconButton>
                            <Avatar src={broadcasterAvatar} sx={{ width: 44, height: 44, border: '2px solid #e41e3f' }} />
                            <Box>
                                <Typography sx={{ fontWeight: 600, color: 'white' }}>{broadcasterName}</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Chip
                                        icon={<LiveIcon sx={{ fontSize: 10, color: 'white !important' }} />}
                                        label="LIVE"
                                        size="small"
                                        sx={{ bgcolor: errorColor, color: 'white', height: 22, fontWeight: 700 }}
                                    />
                                    <Chip
                                        icon={<VisibilityIcon sx={{ fontSize: 12, color: 'white !important' }} />}
                                        label={viewers}
                                        size="small"
                                        sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', height: 22 }}
                                    />
                                </Box>
                            </Box>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <IconButton onClick={toggleMute} sx={{ bgcolor: 'rgba(0,0,0,0.4)', color: 'white' }}>
                                {isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
                            </IconButton>
                            <IconButton onClick={toggleFullscreen} sx={{ bgcolor: 'rgba(0,0,0,0.4)', color: 'white' }}>
                                {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                            </IconButton>
                        </Box>
                    </Box>

                    {/* Video Container */}
                    <Box sx={{
                        flex: 1,
                        bgcolor: '#000',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                    }}>
                        {connectionStatus === 'connecting' && (
                            <Box sx={{ textAlign: 'center' }}>
                                <CircularProgress sx={{ color: 'white' }} size={48} />
                                <Typography sx={{ mt: 2, color: 'white' }}>Đang kết nối...</Typography>
                            </Box>
                        )}

                        {connectionStatus === 'failed' && (
                            <Box sx={{ textAlign: 'center' }}>
                                <Typography sx={{ fontSize: 64, mb: 2 }}>😵</Typography>
                                <Typography variant="h6" color="error">Kết nối thất bại</Typography>
                                <Typography sx={{ color: 'gray' }}>Vui lòng thử lại</Typography>
                            </Box>
                        )}

                        {connectionStatus === 'ended' && (
                            <Box sx={{ textAlign: 'center' }}>
                                <Typography sx={{ fontSize: 64, mb: 2 }}>📺</Typography>
                                <Typography variant="h5" sx={{ color: 'white', fontWeight: 600, mb: 1 }}>
                                    Buổi Live đã kết thúc
                                </Typography>
                                <Typography sx={{ color: 'gray' }}>Cảm ơn bạn đã xem!</Typography>
                            </Box>
                        )}

                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                display: connectionStatus === 'connected' ? 'block' : 'none'
                            }}
                        />

                        {/* Floating Reactions */}
                        <AnimatePresence>
                            {floatingReactions.map(reaction => (
                                <motion.div
                                    key={reaction.id}
                                    initial={{ bottom: '15%', left: `${reaction.x}%`, opacity: 1, scale: 1 }}
                                    animate={{ bottom: '85%', opacity: 0, scale: 1.5 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 2.5, ease: 'easeOut' }}
                                    style={{ position: 'absolute', fontSize: 36, pointerEvents: 'none', zIndex: 10 }}
                                >
                                    {reaction.emoji}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </Box>
                </Box>

                {/* Comments Panel */}
                <Box sx={{
                    width: { xs: '100%', lg: 380 },
                    height: { xs: '40%', lg: '100%' },
                    borderLeft: { lg: `1px solid ${borderColor}` },
                    borderTop: { xs: `1px solid ${borderColor}`, lg: 'none' },
                    display: 'flex',
                    flexDirection: 'column',
                    bgcolor: bgPrimary
                }}>
                    {/* Header */}
                    <Box sx={{
                        p: 2,
                        borderBottom: `1px solid ${borderColor}`,
                        bgcolor: bgSecondary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <Typography sx={{ fontWeight: 700, color: textPrimary, fontSize: 16 }}>
                            💬 Bình luận trực tiếp
                        </Typography>
                        <Chip
                            label={comments.length}
                            size="small"
                            sx={{ bgcolor: alpha(primaryColor, 0.15), color: primaryColor, fontWeight: 600 }}
                        />
                    </Box>

                    {/* Comments List */}
                    <Box sx={{
                        flex: 1,
                        overflowY: 'hidden',
                        p: 2,
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        maskImage: 'linear-gradient(to bottom, transparent 0%, black 20%)',
                        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 20%)'
                    }}>
                        {comments.length === 0 ? (
                            <Box sx={{ textAlign: 'center', py: 4, opacity: 0.7 }}>
                                <Typography sx={{ fontSize: 32, mb: 1 }}>💬</Typography>
                                <Typography variant="body2" sx={{ color: textSecondary }}>Chưa có bình luận</Typography>
                            </Box>
                        ) : (
                            <AnimatePresence initial={false}>
                                {comments.slice(-15).map((comment) => (
                                    <motion.div
                                        key={comment.id}
                                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ duration: 0.3, ease: 'easeOut' }}
                                        layout
                                        style={{ marginBottom: 12, originX: 0 }}
                                    >
                                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                                            <Avatar src={comment.userAvatar} sx={{ width: 32, height: 32, border: `1px solid ${borderColor}` }} />
                                            <Box sx={{
                                                bgcolor: bgSecondary,
                                                px: 2, py: 1,
                                                borderRadius: '18px',
                                                borderTopLeftRadius: 4,
                                                maxWidth: '85%',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                            }}>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: textPrimary, fontSize: 13, mb: 0.2 }}>
                                                    {comment.userName}
                                                </Typography>
                                                <Typography variant="body2" sx={{ color: textPrimary, fontSize: 14, wordBreak: 'break-word' }}>
                                                    {comment.content}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        )}
                    </Box>


                    {/* Reactions */}
                    {/* Reactions */}
                    <Box sx={{
                        px: 2,
                        py: 1.5,
                        display: 'flex',
                        justifyContent: 'center',
                        gap: 0.5,
                        borderTop: `1px solid ${borderColor}`,
                        bgcolor: bgSecondary
                    }}>
                        {LIVE_REACTIONS.map((emoji) => (
                            <IconButton
                                key={emoji}
                                onClick={() => handleSendReaction(emoji)}
                                sx={{
                                    transition: 'transform 0.2s',
                                    '&:hover': { transform: 'scale(1.3)', bgcolor: alpha(primaryColor, 0.1) }
                                }}
                            >
                                <span style={{ fontSize: 22 }}>{emoji}</span>
                            </IconButton>
                        ))}
                    </Box>

                    {/* Comment Input */}
                    <Box sx={{ p: 2, borderTop: `1px solid ${borderColor}`, bgcolor: bgSecondary }}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Viết bình luận..."
                            value={commentInput}
                            onChange={(e) => setCommentInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendComment()}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={handleSendComment}
                                            disabled={!commentInput.trim()}
                                            sx={{ color: commentInput.trim() ? primaryColor : textSecondary }}
                                        >
                                            <SendIcon />
                                        </IconButton>
                                    </InputAdornment>
                                ),
                                sx: { borderRadius: 5, bgcolor: bgTertiary }
                            }}
                        />
                    </Box>
                </Box>
            </Box>
        </Dialog>
    );
}
