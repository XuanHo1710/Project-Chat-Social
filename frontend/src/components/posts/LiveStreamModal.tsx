'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
    Dialog,
    Box,
    Typography,
    Button,
    IconButton,
    TextField,
    Avatar,
    useTheme,
    CircularProgress,
    Chip,
    InputAdornment,
    Tooltip,
    alpha,
    Fade
} from '@mui/material';
import {
    Close as CloseIcon,
    Videocam as VideocamIcon,
    Mic as MicIcon,
    MicOff as MicOffIcon,
    VideocamOff as VideocamOffIcon,
    Cameraswitch as SwitchIcon,
    Public as PublicIcon,
    ScreenShare as ScreenShareIcon,
    Send as SendIcon,
    Visibility as VisibilityIcon,
    FiberManualRecord as LiveIcon,
    AccessTime as TimeIcon
} from '@mui/icons-material';
import { useAuthStore } from '@/stores/useAuthStore';
import { postService } from '@/services/post.service';
import { useSocket } from '@/contexts/SocketContext';
import SimplePeer, { Instance } from 'simple-peer';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadLivestreamVideo } from '@/services/api-video.service';
import { getCommentsByPost } from '@/services/comment.service';

interface LiveStreamModalProps {
    open: boolean;
    onClose: () => void;
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

export default function LiveStreamModal({ open, onClose }: LiveStreamModalProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const { user } = useAuthStore();
    const { socket } = useSocket();

    // Styles
    const bgPrimary = isDark ? '#18191a' : '#ffffff';
    const bgSecondary = isDark ? '#242526' : '#f0f2f5';
    const bgTertiary = isDark ? '#3a3b3c' : '#e4e6eb';
    const textPrimary = theme.palette.text.primary;
    const textSecondary = theme.palette.text.secondary;
    const borderColor = isDark ? '#3e4042' : '#dddfe2';
    const primaryColor = theme.palette.primary.main;
    const errorColor = '#e41e3f';

    // States
    const [streamSource, setStreamSource] = useState<'camera' | 'screen' | null>(null);
    const [description, setDescription] = useState('');
    const [isLive, setIsLive] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [cameraError, setCameraError] = useState(false);
    const [isLoadingSource, setIsLoadingSource] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [postId, setPostId] = useState<string | null>(null);
    const [viewers, setViewers] = useState<number>(0);
    const [comments, setComments] = useState<LiveComment[]>([]);
    const [commentInput, setCommentInput] = useState('');
    const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
    const [duration, setDuration] = useState(0);
    const [isSavingVideo, setIsSavingVideo] = useState(false);
    const [liveStreamId, setLiveStreamId] = useState<string>(''); // For api.video livestream container

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const commentsEndRef = useRef<HTMLDivElement>(null);
    const peersRef = useRef<Map<string, Instance>>(new Map());
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Format duration
    const formatDuration = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Start Camera
    const startCamera = useCallback(async () => {
        setIsLoadingSource(true);
        try {
            const currentStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720, facingMode: 'user' },
                audio: true
            });
            setStream(currentStream);
            if (videoRef.current) videoRef.current.srcObject = currentStream;
            setStreamSource('camera');
            setCameraError(false);
        } catch (err) {
            console.error("Camera Error:", err);
            setCameraError(true);
            toast.error("Không thể truy cập Camera");
        } finally {
            setIsLoadingSource(false);
        }
    }, []);

    // Start Screen Share
    const startScreenShare = useCallback(async () => {
        setIsLoadingSource(true);
        try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: { width: 1920, height: 1080 },
                audio: true
            });
            let audioStream: MediaStream | null = null;
            try {
                audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (e) { /* no mic */ }

            const combinedTracks = [
                ...displayStream.getVideoTracks(),
                ...(audioStream ? audioStream.getAudioTracks() : displayStream.getAudioTracks())
            ];
            const combinedStream = new MediaStream(combinedTracks);
            setStream(combinedStream);
            if (videoRef.current) videoRef.current.srcObject = combinedStream;
            setStreamSource('screen');

            displayStream.getVideoTracks()[0].onended = () => {
                stopStream();
                setStreamSource(null);
            };
        } catch (err) {
            console.error("Screen Share Error:", err);
            toast.error("Không thể chia sẻ màn hình");
        } finally {
            setIsLoadingSource(false);
        }
    }, []);

    const stopStream = useCallback(() => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    }, [stream]);

    // Start Recording
    const startRecording = useCallback((mediaStream: MediaStream) => {
        try {
            recordedChunksRef.current = [];
            const options = { mimeType: 'video/webm;codecs=vp9,opus' };
            const recorder = new MediaRecorder(mediaStream, options);

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };

            recorder.start(1000); // Record in 1s chunks
            mediaRecorderRef.current = recorder;
            console.log('Recording started');
        } catch (err) {
            console.error('Failed to start recording:', err);
        }
    }, []);

    // Stop Recording & Save
    const stopRecordingAndSave = useCallback(async (): Promise<{ url: string; publicId: string; duration: number } | null> => {
        return new Promise((resolve) => {
            const recorder = mediaRecorderRef.current;
            if (!recorder || recorder.state === 'inactive') {
                resolve(null);
                return;
            }

            recorder.onstop = async () => {
                try {
                    const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                    if (blob.size < 1000) {
                        resolve(null);
                        return;
                    }

                    const file = new File([blob], `livestream_${Date.now()}.webm`, { type: 'video/webm' });
                    console.log('[Livestream] Uploading video...', file.size);

                    // Use api.video or fallback to Cloudinary
                    const uploadResult = await uploadLivestreamVideo(file, `Livestream ${new Date().toLocaleString()}`);
                    if (uploadResult) {
                        console.log('[Livestream] Upload success via:', uploadResult.provider);
                        resolve({
                            url: uploadResult.url,
                            publicId: uploadResult.publicId,
                            duration: duration
                        });
                    } else {
                        resolve(null);
                    }
                } catch (err) {
                    console.error('Failed to upload recording:', err);
                    resolve(null);
                }
            };

            recorder.stop();
        });
    }, [duration]);

    useEffect(() => {
        if (stream && videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [stream, open]);

    // Socket handlers
    useEffect(() => {
        if (!socket || !isLive || !postId) return;

        const handleViewersUpdate = (data: { postId: string; count: number }) => {
            console.log('[Broadcaster] Received livestream:viewers event:', data);
            console.log('[Broadcaster] Current postId:', postId, 'Event postId:', data.postId);
            if (String(data.postId) === String(postId)) {
                console.log('[Broadcaster] Setting viewers to:', data.count);
                setViewers(data.count);
            }
        };

        const handleSignal = (data: { fromUserId: string; signal: any; postId: string }) => {
            if (data.postId !== postId) return;
            const viewerId = data.fromUserId;

            if (peersRef.current.has(viewerId)) {
                console.log('[Broadcaster] Signal with existing peer for viewer:', viewerId);
                peersRef.current.get(viewerId)?.signal(data.signal);
            } else if (stream) {
                console.log('[Broadcaster] Creating new peer for viewer:', viewerId);
                const peer = new SimplePeer({
                    initiator: false,
                    trickle: true,
                    stream: stream,
                    config: {
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:stun1.l.google.com:19302' }
                        ]
                    }
                });
                peer.on('signal', (signal) => {
                    console.log('[Broadcaster] Sending signal to viewer:', viewerId);
                    socket.emit('livestream:signal', { toUserId: viewerId, signal, postId });
                });
                peer.on('connect', () => {
                    console.log('[Broadcaster] Connected with viewer:', viewerId);
                });
                peer.on('error', (err) => console.error('[Broadcaster] Peer Error:', err));
                peer.on('close', () => {
                    console.log('[Broadcaster] Connection closed with viewer:', viewerId);
                    peersRef.current.delete(viewerId);
                });
                peer.signal(data.signal);
                peersRef.current.set(viewerId, peer);
            } else {
                console.warn('[Broadcaster] Received signal but no stream available yet');
            }
        };

        const handleNewComment = (data: { postId: string; comment: LiveComment }) => {
            if (data.postId === postId) {
                setComments(prev => [...prev.slice(-100), data.comment]);
            }
        };

        const handleNewReaction = (data: { postId: string; reaction: { id: string; emoji: string } }) => {
            if (data.postId === postId) {
                const newReaction: FloatingReaction = {
                    id: data.reaction.id,
                    emoji: data.reaction.emoji,
                    x: Math.random() * 60 + 20
                };
                setFloatingReactions(prev => [...prev, newReaction]);
                setTimeout(() => {
                    setFloatingReactions(prev => prev.filter(r => r.id !== newReaction.id));
                }, 3000);
            }
        };

        socket.on('livestream:viewers', handleViewersUpdate);
        socket.on('livestream:signal', handleSignal);
        socket.on('livestream:comment:new', handleNewComment);
        socket.on('livestream:reaction:new', handleNewReaction);
        socket.emit('livestream:join', { postId, broadcasterId: user?.id });
        socket.emit('livestream:viewer-count', { postId }, (res: any) => {
            if (res?.viewerCount !== undefined) setViewers(res.viewerCount);
        });

        return () => {
            socket.off('livestream:viewers', handleViewersUpdate);
            socket.off('livestream:signal', handleSignal);
            socket.off('livestream:comment:new', handleNewComment);
            socket.off('livestream:reaction:new', handleNewReaction);
        };
    }, [socket, isLive, postId, stream, user?.id]);

    // Fetch initial comments when starting to stream or reconnecting
    useEffect(() => {
        if (!postId) return;

        const fetchComments = async () => {
            try {
                const result = await getCommentsByPost(postId, 1, 100);
                if (result && result.data) {
                    const mappedComments = result.data.map((c: any) => ({
                        id: c._id,
                        userId: c.userId?._id || c.userId, // userId might be population obj or ID
                        userName: c.userId?.firstName ? `${c.userId.firstName} ${c.userId.lastName}` : (c.userId?.name || 'User'),
                        userAvatar: c.userId?.avatar,
                        content: c.content,
                        createdAt: c.createdAt
                    })).reverse();
                    setComments(mappedComments);
                }
            } catch (err) {
                console.error("Failed to load comments", err);
            }
        };
        fetchComments();
    }, [postId]);

    useEffect(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [comments]);

    // Duration timer
    useEffect(() => {
        if (isLive) {
            durationIntervalRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        }
        return () => {
            if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        };
    }, [isLive]);



    const handleClose = () => {
        if (isLive) {
            if (confirm("Kết thúc Live stream?")) handleEndLive();
        } else {
            stopStream();
            setStreamSource(null);
            setDescription('');
            onClose();
        }
    };

    const toggleAudio = () => {
        if (stream) {
            stream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
            setIsMuted(!stream.getAudioTracks()[0]?.enabled);
        }
    };

    const toggleVideo = () => {
        if (stream) {
            stream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
            setIsVideoOff(!stream.getVideoTracks()[0]?.enabled);
        }
    };

    const handleSendComment = () => {
        if (!commentInput.trim() || !postId || !socket) return;
        socket.emit('livestream:comment', { postId, content: commentInput.trim() });
        setCommentInput('');
    };

    const handleSendReaction = (emoji: string) => {
        if (!postId || !socket) return;
        socket.emit('livestream:reaction', { postId, emoji });
    };

    const handleGoLive = async () => {
        if (!stream) return;

        try {
            // 1. Create Post & Get Stream Keys (even if we don't use RTMP yet)
            const res = await postService.startLivestream({
                description: description || `Livestream của ${user?.fullName}`,
                privacy: 'PUBLIC'
            });
            const { post, liveStreamId: streamId } = res.data;

            setPostId(post._id);
            setLiveStreamId(streamId);
            setIsLive(true);
            setDuration(0);

            // 2. Start Recording (Fallback for VOD)
            // Use camera stream for recording
            if (stream) startRecording(stream);

            // 3. Join socket room for P2P viewing
            socket?.emit('livestream:join', { postId: post._id });

            toast.success('Đang phát trực tiếp!');
        } catch (error) {
            console.error('Start live error:', error);
            toast.error('Không thể bắt đầu livestream');
        }
    };

    const handleEndLive = async () => {
        if (!postId) {
            handleClose();
            return;
        }

        const currentPostId = postId;

        // 1. Notify socket end
        socket?.emit('livestream:end', { postId });

        // 2. Capture Blob Promise
        const recorder = mediaRecorderRef.current;
        let blobPromise: Promise<Blob | null> = Promise.resolve(null);

        if (recorder && recorder.state !== 'inactive') {
            blobPromise = new Promise((resolve) => {
                recorder.onstop = () => {
                    const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                    resolve(blob.size > 1000 ? blob : null);
                };
                recorder.stop();
            });
        }

        // 3. Close UI Immediately & Cleanup
        setIsLive(false);
        stopStream();
        setPostId(null);
        setComments([]);
        setDuration(0);
        setIsSavingVideo(false);
        // Clean peers
        peersRef.current.forEach(p => p.destroy());
        peersRef.current.clear();

        onClose(); // Close dialog directly

        // 4. Background Process: Set Status ENDED & Upload Video
        try {
            // Mark ended first
            await postService.endLivestream(currentPostId);

            // Wait for blob and upload
            const blob = await blobPromise;
            if (blob) {
                const file = new File([blob], `livestream_${Date.now()}.webm`, { type: 'video/webm' });

                // Using existing upload service which tries api.video then Cloudinary
                const uploadResult = await uploadLivestreamVideo(file, `Livestream ${new Date().toLocaleString()}`);

                if (uploadResult) {
                    await postService.updatePost(currentPostId, {
                        livestreamStatus: 'ENDED',
                        media: [{
                            mediaType: 'VIDEO',
                            url: uploadResult.url,
                            publicId: uploadResult.publicId,
                            duration: uploadResult.duration
                        }]
                    });
                    toast.success("Video livestream đã được lưu xong!");
                }
            }
        } catch (e) {
            console.error("Background Task Error:", e);
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} fullScreen PaperProps={{ sx: { bgcolor: bgPrimary } }}>
            {/* Saving overlay */}
            {isSavingVideo && (
                <Box sx={{
                    position: 'fixed',
                    inset: 0,
                    bgcolor: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    flexDirection: 'column',
                    gap: 2
                }}>
                    <CircularProgress sx={{ color: 'white' }} size={48} />
                    <Typography sx={{ color: 'white', fontWeight: 500 }}>Đang lưu video...</Typography>
                </Box>
            )}

            <Box sx={{ height: '100%', display: 'flex', flexDirection: { xs: 'column', lg: 'row' } }}>
                {/* Main Video Area */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    {/* Header */}
                    <Box sx={{
                        p: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: `1px solid ${borderColor}`,
                        bgcolor: bgSecondary
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 700, color: textPrimary }}>
                                {isLive ? '🔴 Đang phát trực tiếp' : 'Phát trực tiếp'}
                            </Typography>
                            {isLive && (
                                <>
                                    <Chip
                                        icon={<TimeIcon sx={{ fontSize: 14, color: 'white !important' }} />}
                                        label={formatDuration(duration)}
                                        size="small"
                                        sx={{ bgcolor: alpha(errorColor, 0.15), color: errorColor, fontWeight: 600 }}
                                    />
                                    <Chip
                                        icon={<VisibilityIcon sx={{ fontSize: 14 }} />}
                                        label={`${viewers} người xem`}
                                        size="small"
                                        sx={{ bgcolor: bgTertiary }}
                                    />
                                </>
                            )}
                        </Box>
                        <IconButton onClick={handleClose} sx={{ color: textSecondary }}>
                            <CloseIcon />
                        </IconButton>
                    </Box>

                    {/* Video Container */}
                    <Box sx={{
                        flex: 1,
                        bgcolor: '#000',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        {isLoadingSource && (
                            <Box sx={{ textAlign: 'center' }}>
                                <CircularProgress sx={{ color: 'white' }} />
                                <Typography sx={{ mt: 2, color: 'gray' }}>Đang khởi tạo...</Typography>
                            </Box>
                        )}

                        {cameraError && (
                            <Box sx={{ textAlign: 'center' }}>
                                <VideocamOffIcon sx={{ fontSize: 64, color: errorColor, mb: 2 }} />
                                <Typography color="error">Không tìm thấy Camera</Typography>
                            </Box>
                        )}

                        {/* Source Selection */}
                        {!streamSource && !isLoadingSource && !cameraError && (
                            <Box sx={{ textAlign: 'center', p: 4 }}>
                                <Typography variant="h5" sx={{ mb: 4, color: 'white', fontWeight: 600 }}>
                                    Chọn nguồn phát
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
                                    <Box
                                        onClick={startCamera}
                                        sx={{
                                            p: 4,
                                            borderRadius: 3,
                                            bgcolor: alpha(primaryColor, 0.1),
                                            border: `2px solid ${alpha(primaryColor, 0.3)}`,
                                            cursor: 'pointer',
                                            transition: 'all 0.3s',
                                            '&:hover': {
                                                bgcolor: alpha(primaryColor, 0.2),
                                                borderColor: primaryColor,
                                                transform: 'translateY(-4px)'
                                            }
                                        }}
                                    >
                                        <VideocamIcon sx={{ fontSize: 48, color: primaryColor, mb: 1 }} />
                                        <Typography sx={{ color: 'white', fontWeight: 600 }}>Camera</Typography>
                                    </Box>
                                    <Box
                                        onClick={startScreenShare}
                                        sx={{
                                            p: 4,
                                            borderRadius: 3,
                                            bgcolor: alpha('#ec4899', 0.1),
                                            border: `2px solid ${alpha('#ec4899', 0.3)}`,
                                            cursor: 'pointer',
                                            transition: 'all 0.3s',
                                            '&:hover': {
                                                bgcolor: alpha('#ec4899', 0.2),
                                                borderColor: '#ec4899',
                                                transform: 'translateY(-4px)'
                                            }
                                        }}
                                    >
                                        <ScreenShareIcon sx={{ fontSize: 48, color: '#ec4899', mb: 1 }} />
                                        <Typography sx={{ color: 'white', fontWeight: 600 }}>Màn hình</Typography>
                                    </Box>
                                </Box>
                            </Box>
                        )}

                        {/* Video */}
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: streamSource === 'screen' ? 'contain' : 'cover',
                                display: stream ? 'block' : 'none',
                                transform: streamSource === 'camera' ? 'scaleX(-1)' : 'none'
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
                                    style={{ position: 'absolute', fontSize: 32, pointerEvents: 'none', zIndex: 10 }}
                                >
                                    {reaction.emoji}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </Box>

                    {/* Controls Footer */}
                    <Box sx={{ p: 2, borderTop: `1px solid ${borderColor}`, bgcolor: bgSecondary }}>
                        {!isLive ? (
                            streamSource && (
                                <Box sx={{ maxWidth: 500, mx: 'auto' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                        <Avatar src={user?.avatar} sx={{ width: 44, height: 44 }} />
                                        <Box>
                                            <Typography sx={{ fontWeight: 600, color: textPrimary }}>{user?.fullName}</Typography>
                                            <Chip
                                                icon={<PublicIcon sx={{ fontSize: 14 }} />}
                                                label="Công khai"
                                                size="small"
                                                sx={{ bgcolor: bgTertiary, height: 24, '& .MuiChip-label': { px: 1 } }}
                                            />
                                        </Box>
                                    </Box>

                                    <TextField
                                        fullWidth
                                        placeholder="Tiêu đề buổi live..."
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        sx={{
                                            mb: 2,
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: 2,
                                                bgcolor: bgTertiary
                                            }
                                        }}
                                    />

                                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, mb: 2 }}>
                                        <Tooltip title={isMuted ? "Bật mic" : "Tắt mic"}>
                                            <IconButton
                                                onClick={toggleAudio}
                                                sx={{
                                                    bgcolor: isMuted ? errorColor : bgTertiary,
                                                    color: isMuted ? 'white' : textPrimary,
                                                    '&:hover': { bgcolor: isMuted ? alpha(errorColor, 0.8) : alpha(bgTertiary, 0.8) }
                                                }}
                                            >
                                                {isMuted ? <MicOffIcon /> : <MicIcon />}
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title={isVideoOff ? "Bật camera" : "Tắt camera"}>
                                            <IconButton
                                                onClick={toggleVideo}
                                                sx={{
                                                    bgcolor: isVideoOff ? errorColor : bgTertiary,
                                                    color: isVideoOff ? 'white' : textPrimary,
                                                    '&:hover': { bgcolor: isVideoOff ? alpha(errorColor, 0.8) : alpha(bgTertiary, 0.8) }
                                                }}
                                            >
                                                {isVideoOff ? <VideocamOffIcon /> : <VideocamIcon />}
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Đổi nguồn">
                                            {/* Old handlers removed */}
                                            <IconButton
                                                onClick={() => { stopStream(); setStreamSource(null); }}
                                                sx={{ bgcolor: bgTertiary, color: textPrimary }}
                                            >
                                                <SwitchIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>

                                    <Button
                                        fullWidth
                                        variant="contained"
                                        onClick={handleGoLive}
                                        startIcon={<LiveIcon />}
                                        sx={{
                                            py: 1.5,
                                            borderRadius: 2,
                                            bgcolor: errorColor,
                                            fontWeight: 700,
                                            fontSize: 16,
                                            '&:hover': { bgcolor: alpha(errorColor, 0.9) }
                                        }}
                                    >
                                        Phát trực tiếp
                                    </Button>
                                </Box>
                            )
                        ) : (
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5 }}>
                                <Button
                                    variant="contained"
                                    onClick={handleEndLive}
                                    sx={{
                                        px: 4,
                                        bgcolor: primaryColor,
                                        fontWeight: 600,
                                        '&:hover': { bgcolor: alpha(primaryColor, 0.9) }
                                    }}
                                >
                                    Kết thúc Live
                                </Button>
                                <IconButton
                                    onClick={toggleAudio}
                                    sx={{ bgcolor: isMuted ? errorColor : bgTertiary, color: isMuted ? 'white' : textPrimary }}
                                >
                                    {isMuted ? <MicOffIcon /> : <MicIcon />}
                                </IconButton>
                                <IconButton
                                    onClick={toggleVideo}
                                    sx={{ bgcolor: isVideoOff ? errorColor : bgTertiary, color: isVideoOff ? 'white' : textPrimary }}
                                >
                                    {isVideoOff ? <VideocamOffIcon /> : <VideocamIcon />}
                                </IconButton>
                            </Box>
                        )}
                    </Box>
                </Box>

                {/* Comments Sidebar */}
                {isLive && (
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
                                    <Typography variant="caption" sx={{ color: textSecondary }}>Hãy bắt đầu trò chuyện với khán giả!</Typography>
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
                )}
            </Box>
        </Dialog>
    );
}
