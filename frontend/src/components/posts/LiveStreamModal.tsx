'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    Box,
    Typography,
    Button,
    IconButton,
    TextField,
    Avatar,
    useTheme,
    CircularProgress,
    Chip
} from '@mui/material';
import {
    Close as CloseIcon,
    Videocam as VideocamIcon,
    Mic as MicIcon,
    MicOff as MicOffIcon,
    VideocamOff as VideocamOffIcon,
    Settings as SettingsIcon,
    Public as PublicIcon
} from '@mui/icons-material';
import { useAuthStore } from '@/stores/useAuthStore';
import { postService } from '@/services/post.service';
import { useSocket } from '@/contexts/SocketContext';
import SimplePeer, { Instance } from 'simple-peer';
import { toast } from 'sonner';

interface LiveStreamModalProps {
    open: boolean;
    onClose: () => void;
}

export default function LiveStreamModal({ open, onClose }: LiveStreamModalProps) {
    const theme = useTheme();
    const { user } = useAuthStore();
    const { socket } = useSocket();

    const [description, setDescription] = useState('');
    const [isLive, setIsLive] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [cameraError, setCameraError] = useState(false);

    // Media Controls
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);

    // Live Data
    const [postId, setPostId] = useState<string | null>(null);
    const [viewers, setViewers] = useState<number>(0);
    const [comments, setComments] = useState<any[]>([]); // To be implemented with live comments

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const peersRef = useRef<Map<string, Instance>>(new Map());

    // Start Camera Preview on Open
    useEffect(() => {
        if (open && !stream) {
            navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                .then((currentStream) => {
                    setStream(currentStream);
                    if (videoRef.current) {
                        videoRef.current.srcObject = currentStream;
                    }
                    setCameraError(false);
                })
                .catch((err) => {
                    console.error("Camera Error:", err);
                    setCameraError(true);
                    toast.error("Không thể truy cập Camera/Microphone");
                });
        }

        return () => {
            // Cleanup if closed without going live (handled in handleClose)
        };
    }, [open]);

    // Handle Stream Updates
    useEffect(() => {
        if (stream && videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [stream, open]);

    // Handle Socket Events for Broadcasting
    useEffect(() => {
        if (!socket || !isLive || !postId) return;

        const handleViewerJoined = (data: { viewerId: string }) => {
            console.log('Viewer Joined:', data.viewerId);
            setViewers(prev => prev + 1);
            toast.info('Một người xem đã tham gia');

            // Wait for Viewer to Offer? Or specific logic?
            // In our design: Viewer initiates Offer to Broadcaster.
        };

        const handleViewerLeft = (data: { viewerId: string }) => {
            console.log('Viewer Left:', data.viewerId);
            setViewers(prev => Math.max(0, prev - 1));

            // Cleanup Peer
            if (peersRef.current.has(data.viewerId)) {
                peersRef.current.get(data.viewerId)?.destroy();
                peersRef.current.delete(data.viewerId);
            }
        };

        const handleSignal = (data: { fromUserId: string; signal: any }) => {
            const viewerId = data.fromUserId;

            if (peersRef.current.has(viewerId)) {
                // Existing peer signal (answer/candidate - though usually viewer sends offer)
                peersRef.current.get(viewerId)?.signal(data.signal);
            } else {
                // New Peer Connection (Viewer -> Broadcaster)
                // Viewer sends Offer. Broadcaster (We) Answer.
                if (!stream) return;

                const peer = new SimplePeer({
                    initiator: false, // Viewer is initiator
                    trickle: true,
                    stream: stream,
                    config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
                });

                peer.on('signal', (signal) => {
                    socket.emit('livestream:signal', {
                        toUserId: viewerId,
                        signal,
                        postId
                    });
                });

                peer.on('error', (err) => {
                    console.error('Peer Error:', err);
                });

                peer.on('close', () => {
                    peersRef.current.delete(viewerId);
                });

                peer.signal(data.signal);
                peersRef.current.set(viewerId, peer);
            }
        };

        socket.on('livestream:viewer-joined', handleViewerJoined);
        socket.on('livestream:viewer-left', handleViewerLeft);
        socket.on('livestream:signal', handleSignal);

        return () => {
            socket.off('livestream:viewer-joined', handleViewerJoined);
            socket.off('livestream:viewer-left', handleViewerLeft);
            socket.off('livestream:signal', handleSignal);
        };
    }, [socket, isLive, postId, stream]);


    const handleGoLive = async () => {
        if (!description) {
            toast.error("Vui lòng nhập mô tả cho buổi live");
            return;
        }

        try {
            // Create Post
            const res = await postService.createPost({
                content: description,
                type: 'LIVESTREAM',
                livestreamStatus: 'LIVE',
                privacy: 'PUBLIC',
                userId: user?.id || "",
            });

            console.log('Live Post Created:', res);
            setPostId(res.data._id);
            setIsLive(true);


            toast.success("Đang phát trực tiếp!");

        } catch (error) {
            console.error(error);
            toast.error("Không thể bắt đầu Live");
        }
    };

    const handleEndLive = async () => {
        if (postId) {
            socket?.emit('livestream:end', { postId });
            // Update API to status ENDED
            // await postService.updatePost(postId, { livestreamStatus: 'ENDED' }); 
            // (assuming update endpoint supports this, or custom endpoint)
        }

        stopStream();
        setIsLive(false);
        setPostId(null);
        peersRef.current.forEach(p => p.destroy());
        peersRef.current.clear();
        onClose();
    };

    const stopStream = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const handleClose = () => {
        if (isLive) {
            if (confirm("Bạn có chắc muốn kết thúc Live stream?")) {
                handleEndLive();
            }
        } else {
            stopStream();
            onClose();
        }
    };

    const toggleAudio = () => {
        if (stream) {
            stream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
            setIsMuted(!stream.getAudioTracks()[0].enabled);
        }
    };

    const toggleVideo = () => {
        if (stream) {
            stream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
            setIsVideoOff(!stream.getVideoTracks()[0].enabled);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            fullScreen
            PaperProps={{
                sx: {
                    bgcolor: 'black',
                    color: 'white'
                }
            }}
        >
            <Box sx={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>

                {/* Header (Overlay) */}
                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, p: 2, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {isLive && <Chip label="TRỰC TIẾP" color="error" sx={{ fontWeight: 'bold' }} />}
                        {isLive && <Chip label={`${viewers} người xem`} color="default" sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: 'white' }} />}
                    </Box>
                    <IconButton onClick={handleClose} sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.1)' }}>
                        <CloseIcon />
                    </IconButton>
                </Box>

                {/* Main Video Area */}
                <Box sx={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#1a1a1a' }}>
                    {!stream && !cameraError && <CircularProgress />}
                    {cameraError && <Typography color="error">Không tìm thấy Camera</Typography>}
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }} // Contain to see full video
                    />
                </Box>

                {/* Footer Controls */}
                <Box sx={{ p: 3, bgcolor: '#242526' }}>
                    {!isLive ? (
                        // PRE-LIVE SETUP
                        <Box sx={{ maxWidth: 600, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Avatar src={user?.avatar} sx={{ width: 50, height: 50 }} />
                                <Box>
                                    <Typography variant="h6">{user?.fullName}</Typography>
                                    <Chip icon={<PublicIcon sx={{ fontSize: 16 }} />} label="Công khai" size="small" variant="outlined" sx={{ color: 'gray', borderColor: 'gray' }} />
                                </Box>
                            </Box>

                            <TextField
                                placeholder="Nhập mô tả cho video trực tiếp của bạn..."
                                multiline
                                rows={2}
                                fullWidth
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                sx={{
                                    bgcolor: 'rgba(255,255,255,0.05)',
                                    borderRadius: 1,
                                    input: { color: 'white' },
                                    textarea: { color: 'white' }
                                }}
                            />

                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                                <IconButton onClick={toggleAudio} sx={{ bgcolor: isMuted ? 'error.main' : 'rgba(255,255,255,0.1)', color: 'white', p: 2 }}>
                                    {isMuted ? <MicOffIcon /> : <MicIcon />}
                                </IconButton>
                                <IconButton onClick={toggleVideo} sx={{ bgcolor: isVideoOff ? 'error.main' : 'rgba(255,255,255,0.1)', color: 'white', p: 2 }}>
                                    {isVideoOff ? <VideocamOffIcon /> : <VideocamIcon />}
                                </IconButton>
                                <IconButton sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white', p: 2 }}>
                                    <SettingsIcon />
                                </IconButton>
                            </Box>

                            <Button
                                variant="contained"
                                color="error"
                                size="large"
                                onClick={handleGoLive}
                                sx={{ py: 1.5, fontSize: 18, fontWeight: 'bold' }}
                            >
                                PHÁT TRỰC TIẾP
                            </Button>
                        </Box>
                    ) : (
                        // LIVE CONTROLS
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                            <Button
                                variant="contained"
                                color="error"
                                onClick={handleEndLive}
                                sx={{ px: 4 }}
                            >
                                KẾT THÚC
                            </Button>
                            <IconButton onClick={toggleAudio} sx={{ bgcolor: isMuted ? 'error.main' : 'rgba(255,255,255,0.1)', color: 'white' }}>
                                {isMuted ? <MicOffIcon /> : <MicIcon />}
                            </IconButton>
                            <IconButton onClick={toggleVideo} sx={{ bgcolor: isVideoOff ? 'error.main' : 'rgba(255,255,255,0.1)', color: 'white' }}>
                                {isVideoOff ? <VideocamOffIcon /> : <VideocamIcon />}
                            </IconButton>
                        </Box>
                    )}
                </Box>

            </Box>
        </Dialog>
    );
}
