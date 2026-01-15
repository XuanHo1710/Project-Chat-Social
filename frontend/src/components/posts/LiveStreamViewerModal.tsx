'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
    Dialog,
    Box,
    Typography,
    IconButton,
    Avatar,
    Chip,
    CircularProgress
} from '@mui/material';
import {
    Close as CloseIcon,
    Favorite as HeartIcon,
    ChatBubble as ChatIcon
} from '@mui/icons-material';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSocket } from '@/contexts/SocketContext';
import SimplePeer, { Instance } from 'simple-peer';
import { PostType } from '@/types/post';

interface LiveStreamViewerModalProps {
    open: boolean;
    onClose: () => void;
    post: PostType;
}

export default function LiveStreamViewerModal({ open, onClose, post }: LiveStreamViewerModalProps) {
    const { user } = useAuthStore();
    const { socket } = useSocket();

    const [stream, setStream] = useState<MediaStream | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'failed' | 'ended'>('connecting');

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<Instance | null>(null);

    // Initialize Connection (Viewer Logic)
    useEffect(() => {
        if (!open || !socket || !post) return;

        setConnectionStatus('connecting');

        // Join Room
        socket.emit('livestream:join', { postId: post._id, broadcasterId: post.userId._id || post.userId });

        // Create Peer (Initiator)
        const peer = new SimplePeer({
            initiator: true,
            trickle: true,
            config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
        });

        peer.on('signal', (signal) => {
            // Send Offer to Broadcaster
            socket.emit('livestream:signal', {
                toUserId: post.userId._id || post.userId,
                signal,
                postId: post._id
            });
        });

        peer.on('stream', (remoteStream) => {
            console.log('Received Broadcast Stream');
            setStream(remoteStream);
            setConnectionStatus('connected');
            if (videoRef.current) {
                videoRef.current.srcObject = remoteStream;
            }
        });

        peer.on('error', (err) => {
            console.error('Viewer Peer Error:', err);
            setConnectionStatus('failed');
        });

        peer.on('close', () => {
            console.log('Stream ended');
            setConnectionStatus('ended');
            setStream(null);
        });

        peerRef.current = peer;

        // Handle Socket Events
        const handleSignal = (data: { signal: any }) => {
            peer.signal(data.signal);
        };

        const handleEnded = () => {
            setConnectionStatus('ended');
            toast.info("Buổi phát trực tiếp đã kết thúc");
            // peer.destroy();
        };

        socket.on('livestream:signal', handleSignal);
        socket.on('livestream:ended', handleEnded);

        return () => {
            socket.off('livestream:signal', handleSignal);
            socket.off('livestream:ended', handleEnded);
            socket.emit('livestream:leave', { postId: post._id, broadcasterId: post.userId._id || post.userId });
            peer.destroy();
            peerRef.current = null;
        };
    }, [open, socket, post]);

    // Ensure video ref is updated if stream changes
    useEffect(() => {
        if (stream && videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullScreen
            PaperProps={{
                sx: {
                    bgcolor: 'black',
                    color: 'white'
                }
            }}
        >
            <Box sx={{ position: 'relative', width: '100%', height: '100%', display: 'flex' }}>

                {/* Main Video Area */}
                <Box sx={{ flex: 1, position: 'relative', bgcolor: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

                    {/* Overlay Header */}
                    <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, p: 2, zIndex: 10, display: 'flex', alignItems: 'center', background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)' }}>
                        <IconButton onClick={onClose} sx={{ color: 'white', mr: 2 }}>
                            <CloseIcon />
                        </IconButton>
                        <Avatar src={typeof post.userId !== 'string' ? post.userId?.avatar : ''} />
                        <Box sx={{ ml: 2 }}>
                            <Typography variant="subtitle1" fontWeight="bold">
                                {typeof post.userId !== 'string' ? post.userId?.firstName + " " + post.userId?.lastName : 'Streamer'}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip label="TRỰC TIẾP" color="error" size="small" sx={{ height: 20, fontSize: 10, fontWeight: 'bold' }} />
                                {/* Viewer count could be passed via socket */}
                            </Box>
                        </Box>
                    </Box>

                    {/* Status Messages */}
                    {connectionStatus === 'connecting' && (
                        <Box sx={{ textAlign: 'center' }}>
                            <CircularProgress color="error" />
                            <Typography sx={{ mt: 2 }}>Đang kết nối tới Live stream...</Typography>
                        </Box>
                    )}
                    {connectionStatus === 'failed' && (
                        <Typography color="error">Kết nối thất bại. Vui lòng thử lại.</Typography>
                    )}
                    {connectionStatus === 'ended' && (
                        <Typography variant="h5">Buổi Live stream đã kết thúc.</Typography>
                    )}

                    {/* Video Player */}
                    <video
                        ref={videoRef}
                        autoPlay
                        controls={false}
                        playsInline
                        style={{ width: '100%', height: '100%', objectFit: 'contain', display: connectionStatus === 'connected' ? 'block' : 'none' }}
                    />
                </Box>

                {/* Right Side: Comments (Placeholder for now) */}
                <Box sx={{ width: 350, bgcolor: '#242526', borderLeft: '1px solid #333', display: { xs: 'none', md: 'flex' }, flexDirection: 'column' }}>
                    <Box sx={{ p: 2, borderBottom: '1px solid #333' }}>
                        <Typography variant="h6">Bình luận trực tiếp</Typography>
                    </Box>
                    <Box sx={{ flex: 1, p: 2, overflowY: 'auto' }}>
                        <Typography color="gray" align="center">Chưa có bình luận nào.</Typography>
                    </Box>
                    <Box sx={{ p: 2, borderTop: '1px solid #333' }}>
                        {/* Comment Input Placeholder */}
                        <Box sx={{ bgcolor: '#3a3b3c', p: 1.5, borderRadius: 4, color: 'gray' }}>
                            Viết bình luận...
                        </Box>
                    </Box>
                </Box>

            </Box>
        </Dialog>
    );
}

import { toast } from 'sonner';
