'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import SimplePeer, { Instance, SignalData } from 'simple-peer';
import { useSocket } from '@/contexts/SocketContext';
import { toast } from 'sonner';

// ─── Centralized ICE Server Configuration ───
const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    // Add TURN servers for better NAT traversal:
    // { urls: 'turn:your-turn-server.com:3478', username: '...', credential: '...' },
];

// ─── Types ───
interface IncomingCallData {
    fromUserId: string;
    callerName: string;
    callerAvatar: string;
    conversationId: string;
    offer: SignalData;
}

interface CallAcceptedData {
    fromUserId: string;
    answer: SignalData;
}

interface IceCandidateData {
    fromUserId: string;
    candidate: SignalData;
}

interface GroupCallIncomingData {
    conversationId: string;
    callerName: string;
    callerAvatar: string;
}

interface GroupCallSignalData {
    fromUserId: string;
    signal: SignalData;
    conversationId: string;
}

interface GroupCallUserData {
    userId: string;
}

interface GroupJoinResponse {
    success: boolean;
    users: string[];
}

interface RemoteStream {
    peerId: string;
    stream: MediaStream;
}

interface CallerInfo {
    id: string;
    name: string;
    avatar: string;
    conversationId: string;
    isGroup?: boolean;
}

interface RecipientInfo {
    id: string;
    conversationId: string;
}

interface CallContextType {
    callUser: (userId: string, conversationId: string, isTurnOff: boolean, targetName?: string, targetAvatar?: string) => void;
    startGroupCall: (conversationId: string, isTurnOff: boolean) => void;
    joinGroupCall: (conversationId: string) => void;
    answerCall: () => void;
    leaveCall: () => void;
    rejectCall: () => void;
    toggleAudio: () => void;
    toggleVideo: () => Promise<void>;
    callReceived: boolean;
    isInCall: boolean;
    isGroupCall: boolean;
    isCallAccepted: boolean;
    stream: MediaStream | undefined;
    remoteStreams: RemoteStream[];
    userVideo: React.RefObject<HTMLVideoElement | null>;
    myVideo: React.RefObject<HTMLVideoElement | null>;
    callerInfo: CallerInfo | null;
    recipientInfo: RecipientInfo | null;
    hasVideo: boolean;
    hasAudio: boolean;
    isMuted: boolean;
    isVideoOff: boolean;
}

const CallContext = createContext<CallContextType | null>(null);

export const useCall = () => {
    const context = useContext(CallContext);
    if (!context) throw new Error('useCall must be used within a CallProvider');
    return context;
};

export const CallProvider = ({ children }: { children: React.ReactNode }) => {
    // ─── State ───
    const [stream, setStream] = useState<MediaStream>();
    const streamRef = useRef<MediaStream | undefined>(undefined);

    const [isInCall, setIsInCall] = useState(false);
    const [isGroupCall, setIsGroupCall] = useState(false);
    const [isCallAccepted, setIsCallAccepted] = useState(false);
    const [callReceived, setCallReceived] = useState(false);

    const [callerSignal, setCallerSignal] = useState<SignalData | null>(null);
    const [callerInfo, setCallerInfo] = useState<CallerInfo | null>(null);
    const [recipientInfo, setRecipientInfo] = useState<RecipientInfo | null>(null);

    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);

    // ─── Refs ───
    const myVideo = useRef<HTMLVideoElement | null>(null);
    const userVideo = useRef<HTMLVideoElement | null>(null);

    const connectionRef = useRef<Instance | null>(null);
    const peersRef = useRef<Map<string, Instance>>(new Map());
    const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);

    // FIX: Buffer for ICE candidates arriving before peer is created (callee side)
    const pendingSignalsRef = useRef<SignalData[]>([]);

    // Stable refs to avoid stale closures in event handlers
    const isInCallRef = useRef(false);
    const isGroupCallRef = useRef(false);
    const callerInfoRef = useRef<CallerInfo | null>(null);
    const recipientInfoRef = useRef<RecipientInfo | null>(null);

    const { socket } = useSocket();

    // Sync state → refs
    useEffect(() => { isInCallRef.current = isInCall; }, [isInCall]);
    useEffect(() => { isGroupCallRef.current = isGroupCall; }, [isGroupCall]);
    useEffect(() => { callerInfoRef.current = callerInfo; }, [callerInfo]);
    useEffect(() => { recipientInfoRef.current = recipientInfo; }, [recipientInfo]);

    // ─── Helpers ───
    const stopStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => { t.stop(); t.enabled = false; });
            streamRef.current = undefined;
            setStream(undefined);
        }
    };

    const removePeer = (peerId: string) => {
        const peer = peersRef.current.get(peerId);
        if (peer) { peer.destroy(); peersRef.current.delete(peerId); }
        setRemoteStreams(prev => prev.filter(p => p.peerId !== peerId));
    };

    // FIX: leaveCall uses refs instead of state to avoid stale closures
    const leaveCall = (emitEvent = true) => {
        // Destroy 1v1 peer
        if (connectionRef.current) {
            connectionRef.current.destroy();
            connectionRef.current = null;
        }

        // Destroy group peers
        peersRef.current.forEach(p => p.destroy());
        peersRef.current.clear();

        // Clear signal buffer
        pendingSignalsRef.current = [];

        // Stop media
        stopStream();

        // Notify server (use refs for stable values)
        if (emitEvent && socket) {
            if (isGroupCallRef.current) {
                const convId = callerInfoRef.current?.conversationId || recipientInfoRef.current?.conversationId;
                if (convId) socket.emit('group-call:leave', { conversationId: convId });
            } else {
                const targetId = callerInfoRef.current?.id || recipientInfoRef.current?.id;
                if (targetId) socket.emit('call:end', { toUserId: targetId });
            }
        }

        // Reset all state + refs
        setIsInCall(false); isInCallRef.current = false;
        setIsCallAccepted(false);
        setCallReceived(false);
        setRecipientInfo(null); recipientInfoRef.current = null;
        setCallerInfo(null); callerInfoRef.current = null;
        setCallerSignal(null);
        setRemoteStreams([]);
        setIsMuted(false);
        setIsVideoOff(false);
        setIsGroupCall(false); isGroupCallRef.current = false;
    };

    // ─── Group Peer Helpers ───
    const createGroupPeer = (targetUserId: string, localStream: MediaStream, conversationId: string) => {
        const peer = new SimplePeer({
            initiator: true,
            trickle: true,
            stream: localStream,
            config: { iceServers: ICE_SERVERS },
        });

        peer.on('signal', signal => {
            socket?.emit('call:signal', { toUserId: targetUserId, signal, conversationId });
        });

        peer.on('stream', remoteStream => {
            setRemoteStreams(prev => {
                const idx = prev.findIndex(p => p.peerId === targetUserId);
                if (idx !== -1) {
                    const next = [...prev];
                    next[idx] = { peerId: targetUserId, stream: remoteStream };
                    return next;
                }
                return [...prev, { peerId: targetUserId, stream: remoteStream }];
            });
        });

        peer.on('error', () => removePeer(targetUserId));
        peer.on('close', () => removePeer(targetUserId));
        return peer;
    };

    const acceptGroupPeer = (incomingSignal: SignalData, fromUserId: string, localStream: MediaStream, conversationId: string) => {
        const peer = new SimplePeer({
            initiator: false,
            trickle: true,
            stream: localStream,
            config: { iceServers: ICE_SERVERS },
        });

        peer.on('signal', signal => {
            socket?.emit('call:signal', { toUserId: fromUserId, signal, conversationId });
        });

        peer.on('stream', remoteStream => {
            setRemoteStreams(prev => {
                const idx = prev.findIndex(p => p.peerId === fromUserId);
                if (idx !== -1) {
                    const next = [...prev];
                    next[idx] = { peerId: fromUserId, stream: remoteStream };
                    return next;
                }
                return [...prev, { peerId: fromUserId, stream: remoteStream }];
            });
        });

        peer.on('error', () => removePeer(fromUserId));
        peer.on('close', () => removePeer(fromUserId));
        peer.signal(incomingSignal);
        return peer;
    };

    // ─── Socket Event Handlers ───
    useEffect(() => {
        if (!socket) return;

        // 1v1: Incoming call
        const onCallIncoming = (data: IncomingCallData) => {
            console.log('[Call] Incoming from:', data.fromUserId);
            if (isInCallRef.current) {
                socket.emit('call:end', { toUserId: data.fromUserId });
                return;
            }
            pendingSignalsRef.current = []; // Clear buffer for new call
            setCallReceived(true);
            setIsGroupCall(false);
            setCallerInfo({
                id: data.fromUserId,
                name: data.callerName,
                avatar: data.callerAvatar,
                conversationId: data.conversationId,
                isGroup: false,
            });
            setCallerSignal(data.offer);
        };

        // 1v1: Caller receives answer
        const onCallAccepted = (data: CallAcceptedData) => {
            console.log('[Call] Accepted by:', data.fromUserId);
            setIsCallAccepted(true);
            if (connectionRef.current) {
                connectionRef.current.signal(data.answer);
            }
        };

        // 1v1: ICE candidate exchange
        // FIX: Buffer candidates when peer doesn't exist yet (callee waiting to answer)
        const onIceCandidate = (data: IceCandidateData) => {
            if (connectionRef.current) {
                connectionRef.current.signal(data.candidate);
            } else {
                console.log('[Call] Buffering ICE candidate (peer not ready yet)');
                pendingSignalsRef.current.push(data.candidate);
            }
        };

        // 1v1: Remote ended
        const onCallEnded = () => {
            if (!isGroupCallRef.current) {
                leaveCall(false);
            }
        };

        // Group: Incoming notification
        const onGroupIncoming = (data: GroupCallIncomingData) => {
            console.log('[Call] Group incoming:', data.conversationId);
            if (isInCallRef.current) return;
            setCallReceived(true);
            setIsGroupCall(true);
            setCallerInfo({
                id: data.conversationId,
                name: `Cuộc gọi nhóm từ ${data.callerName}`,
                avatar: data.callerAvatar,
                conversationId: data.conversationId,
                isGroup: true,
            });
        };

        // Group: User joined
        const onGroupUserJoined = () => {
            toast.info('Có người tham gia cuộc gọi');
        };

        // Group: User left
        const onGroupUserLeft = (data: GroupCallUserData) => {
            removePeer(data.userId);
            toast.info('Có người rời cuộc gọi');
        };

        // Group: Mesh signaling
        const onCallSignal = (data: GroupCallSignalData) => {
            if (!isInCallRef.current || !isGroupCallRef.current) return;

            const existing = peersRef.current.get(data.fromUserId);
            if (existing) {
                existing.signal(data.signal);
            } else {
                const localStream = streamRef.current;
                if (!localStream) return;
                const newPeer = acceptGroupPeer(data.signal, data.fromUserId, localStream, data.conversationId);
                peersRef.current.set(data.fromUserId, newPeer);
            }
        };

        socket.on('call:incoming', onCallIncoming);
        socket.on('call:accepted', onCallAccepted);
        socket.on('call:ice-candidate', onIceCandidate);
        socket.on('call:ended', onCallEnded);
        socket.on('group-call:incoming', onGroupIncoming);
        socket.on('group-call:user-joined', onGroupUserJoined);
        socket.on('group-call:user-left', onGroupUserLeft);
        socket.on('call:signal', onCallSignal);

        return () => {
            socket.off('call:incoming', onCallIncoming);
            socket.off('call:accepted', onCallAccepted);
            socket.off('call:ice-candidate', onIceCandidate);
            socket.off('call:ended', onCallEnded);
            socket.off('group-call:incoming', onGroupIncoming);
            socket.off('group-call:user-joined', onGroupUserJoined);
            socket.off('group-call:user-left', onGroupUserLeft);
            socket.off('call:signal', onCallSignal);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket]);

    // Update local video element when stream changes
    useEffect(() => {
        if (stream && myVideo.current) {
            myVideo.current.srcObject = stream;
        }
    }, [stream]);

    // Get media stream (camera optional, falls back to audio-only)
    const getMediaStream = async (wantVideo: boolean): Promise<MediaStream> => {
        if (wantVideo) {
            try {
                return await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            } catch {
                toast.info('Không thể truy cập Camera – tiếp tục với âm thanh');
                setIsVideoOff(true);
                return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            }
        }
        return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    };

    // ─── 1v1 Call ───
    const callUser = async (userId: string, conversationId: string, isTurnOff: boolean, targetName?: string, targetAvatar?: string) => {
        if (isTurnOff) setIsVideoOff(true);

        const info: CallerInfo = { id: userId, name: targetName || 'Người dùng', avatar: targetAvatar || '', conversationId, isGroup: false };
        const recipient: RecipientInfo = { id: userId, conversationId };

        setRecipientInfo(recipient); recipientInfoRef.current = recipient;
        setCallerInfo(info); callerInfoRef.current = info;
        setIsInCall(true); isInCallRef.current = true;
        setIsGroupCall(false); isGroupCallRef.current = false;
        setIsCallAccepted(false);
        pendingSignalsRef.current = [];

        try {
            const currentStream = await getMediaStream(!isTurnOff);
            streamRef.current = currentStream;
            setStream(currentStream);

            if (!isTurnOff && currentStream.getVideoTracks().length === 0) {
                setIsVideoOff(true);
            }

            const peer = new SimplePeer({
                initiator: true,
                trickle: true,
                stream: currentStream,
                config: { iceServers: ICE_SERVERS },
            });

            peer.on('signal', (data) => {
                if (data.type === 'offer') {
                    socket?.emit('call:start', { toUserId: userId, offer: data, conversationId });
                } else if ('candidate' in data) {
                    socket?.emit('call:ice-candidate', { toUserId: userId, candidate: data, conversationId });
                }
            });

            peer.on('stream', (remoteStream) => {
                if (userVideo.current) userVideo.current.srcObject = remoteStream;
            });

            peer.on('error', (err) => {
                console.error('[Call] Peer error:', err);
                toast.error('Lỗi kết nối cuộc gọi');
            });

            peer.on('close', () => leaveCall(false));

            connectionRef.current = peer;
        } catch (err) {
            console.error('[Call] Media error:', err);
            toast.error('Không thể truy cập Microphone');
            leaveCall(false);
        }
    };

    // ─── Start Group Call ───
    const startGroupCall = async (conversationId: string, isTurnOff: boolean) => {
        if (isTurnOff) setIsVideoOff(true);

        const recipient: RecipientInfo = { id: conversationId, conversationId };
        setRecipientInfo(recipient); recipientInfoRef.current = recipient;
        setIsInCall(true); isInCallRef.current = true;
        setIsGroupCall(true); isGroupCallRef.current = true;
        setIsCallAccepted(true);

        try {
            const currentStream = await getMediaStream(!isTurnOff);
            streamRef.current = currentStream;
            setStream(currentStream);

            if (!isTurnOff && currentStream.getVideoTracks().length === 0) {
                setIsVideoOff(true);
            }

            socket?.emit('group-call:start', { conversationId });
            socket?.emit('group-call:join', { conversationId }, (response: GroupJoinResponse) => {
                console.log('[Call] Joined group:', response);
            });
        } catch (err) {
            console.error('[Call] Group call error:', err);
            toast.error('Không thể truy cập Microphone');
            leaveCall(false);
        }
    };

    // ─── Join Group Call ───
    const joinGroupCall = async (conversationId: string) => {
        setCallReceived(false);
        setIsInCall(true); isInCallRef.current = true;
        setIsGroupCall(true); isGroupCallRef.current = true;
        setIsCallAccepted(true);

        try {
            const currentStream = await getMediaStream(false);
            setIsVideoOff(true);
            streamRef.current = currentStream;
            setStream(currentStream);

            socket?.emit('group-call:join', { conversationId }, (response: GroupJoinResponse) => {
                if (response.success && response.users) {
                    console.log('[Call] Existing users:', response.users);
                    response.users.forEach(targetUserId => {
                        const peer = createGroupPeer(targetUserId, currentStream, conversationId);
                        peersRef.current.set(targetUserId, peer);
                    });
                }
            });
        } catch (err) {
            console.error('[Call] Join error:', err);
            toast.error('Không thể tham gia – kiểm tra quyền Microphone');
            leaveCall(false);
        }
    };

    // ─── Answer Call ───
    const answerCall = async () => {
        // Group calls go through joinGroupCall
        if (callerInfo?.isGroup) {
            joinGroupCall(callerInfo.conversationId);
            return;
        }

        if (!callerInfo || !callerSignal) return;

        setCallReceived(false);
        setIsInCall(true); isInCallRef.current = true;
        setIsGroupCall(false); isGroupCallRef.current = false;
        setIsCallAccepted(true);

        try {
            const currentStream = await getMediaStream(false);
            setIsVideoOff(true);
            streamRef.current = currentStream;
            setStream(currentStream);

            const peer = new SimplePeer({
                initiator: false,
                trickle: true,
                stream: currentStream,
                config: { iceServers: ICE_SERVERS },
            });

            peer.on('signal', (data) => {
                if (data.type === 'answer') {
                    socket?.emit('call:answer', { toUserId: callerInfo.id, answer: data, conversationId: callerInfo.conversationId });
                } else if ('candidate' in data) {
                    socket?.emit('call:ice-candidate', { toUserId: callerInfo.id, candidate: data, conversationId: callerInfo.conversationId });
                }
            });

            peer.on('stream', (remoteStream) => {
                if (userVideo.current) userVideo.current.srcObject = remoteStream;
            });

            peer.on('error', (err) => {
                console.error('[Call] Answer peer error:', err);
                toast.error('Lỗi kết nối cuộc gọi');
            });

            peer.on('close', () => leaveCall(false));

            // Set ref FIRST so any new ICE candidates go to peer directly
            connectionRef.current = peer;

            // Process stored offer
            peer.signal(callerSignal);

            // FIX: Drain buffered ICE candidates that arrived before peer was created
            const buffered = pendingSignalsRef.current;
            if (buffered.length > 0) {
                console.log(`[Call] Draining ${buffered.length} buffered ICE candidates`);
                buffered.forEach(s => peer.signal(s));
            }
            pendingSignalsRef.current = [];
        } catch (err) {
            console.error('[Call] Answer error:', err);
            toast.error('Không thể truy cập Microphone');
            leaveCall(true);
        }
    };

    const rejectCall = () => leaveCall(true);

    const toggleAudio = () => {
        if (!streamRef.current) return;
        const track = streamRef.current.getAudioTracks()[0];
        if (track) {
            track.enabled = !track.enabled;
            setIsMuted(!track.enabled);
        }
    };

    const toggleVideo = async () => {
        if (!streamRef.current) return;
        const currentStream = streamRef.current;
        const videoTrack = currentStream.getVideoTracks()[0];

        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            setIsVideoOff(!videoTrack.enabled);
        } else {
            try {
                const vs = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                const newTrack = vs.getVideoTracks()[0];
                if (newTrack) {
                    currentStream.addTrack(newTrack);

                    // Add to active peer connections
                    if (connectionRef.current) {
                        try { connectionRef.current.addTrack(newTrack, currentStream); }
                        catch { console.warn('Could not add video track to 1v1 peer'); }
                    }
                    peersRef.current.forEach((peer) => {
                        try { peer.addTrack(newTrack, currentStream); }
                        catch { console.warn('Could not add video track to group peer'); }
                    });

                    setStream(currentStream);
                    setIsVideoOff(false);
                    toast.success('Camera đã được bật');
                }
            } catch {
                toast.error('Không thể truy cập Camera');
            }
        }
    };

    return (
        <CallContext.Provider value={{
            callUser, startGroupCall, joinGroupCall, answerCall, leaveCall, rejectCall,
            toggleAudio, toggleVideo, callReceived, isInCall, isGroupCall, isCallAccepted,
            stream, remoteStreams, myVideo, userVideo, callerInfo, recipientInfo,
            hasVideo: !isVideoOff, hasAudio: !isMuted, isMuted, isVideoOff,
        }}>
            {children}
        </CallContext.Provider>
    );
};
