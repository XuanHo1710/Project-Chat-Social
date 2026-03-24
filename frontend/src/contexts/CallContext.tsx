'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import SimplePeer, { Instance, SignalData } from 'simple-peer';
import { useSocket } from '@/contexts/SocketContext';
import { toast } from 'sonner';

// --- Socket Event Payload Types ---
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

interface CallContextType {
    // 1v1
    callUser: (userId: string, conversationId: string, isTurnOff: boolean, targetName?: string, targetAvatar?: string) => void;

    // Group
    startGroupCall: (conversationId: string, isTurnOff: boolean) => void;
    joinGroupCall: (conversationId: string) => void;

    answerCall: () => void;
    leaveCall: () => void;
    rejectCall: () => void;
    toggleAudio: () => void;
    toggleVideo: () => Promise<void>;

    callReceived: boolean;
    isInCall: boolean;
    isGroupCall: boolean; // New flag
    isCallAccepted: boolean;

    stream: MediaStream | undefined; // Local stream
    remoteStreams: RemoteStream[]; // For Group Call

    // Legacy 1v1 refs (optional, can just use remoteStreams[0])
    userVideo: React.RefObject<HTMLVideoElement | null>;
    myVideo: React.RefObject<HTMLVideoElement | null>;

    callerInfo: {
        id: string; // userId or conversationId for group
        name: string;
        avatar: string;
        conversationId: string;
        isGroup?: boolean;
    } | null;
    recipientInfo: {
        id: string; // userId or conversationId
        conversationId: string;
    } | null;

    hasVideo: boolean;
    hasAudio: boolean;
    isMuted: boolean;
    isVideoOff: boolean;
}

const CallContext = createContext<CallContextType | null>(null);

export const useCall = () => {
    const context = useContext(CallContext);
    if (!context) {
        throw new Error('useCall must be used within a CallProvider');
    }
    return context;
};

export const CallProvider = ({ children }: { children: React.ReactNode }) => {
    // Local Stream
    const [stream, setStream] = useState<MediaStream>();
    const streamRef = useRef<MediaStream | undefined>(undefined);

    // Call States
    const [isInCall, setIsInCall] = useState(false);
    const [isGroupCall, setIsGroupCall] = useState(false);
    const [isCallAccepted, setIsCallAccepted] = useState(false);

    // Incoming Call State
    const [callReceived, setCallReceived] = useState(false);
    const [callerSignal, setCallerSignal] = useState<SignalData | null>(null); // For 1v1 answer
    const [callerInfo, setCallerInfo] = useState<{ id: string; name: string; avatar: string; conversationId: string; isGroup?: boolean } | null>(null);
    const [recipientInfo, setRecipientInfo] = useState<{ id: string; conversationId: string } | null>(null);

    // Media States
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);

    // Refs
    const myVideo = useRef<HTMLVideoElement | null>(null);
    const userVideo = useRef<HTMLVideoElement | null>(null); // For 1v1 specific

    // Peer Refs
    const connectionRef = useRef<Instance | null>(null); // 1v1 Peer
    const peersRef = useRef<Map<string, Instance>>(new Map()); // Group Peers Map<userId, Peer>

    // Group Streams State
    const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);

    // Refs to avoid stale closures in socket handlers
    const isInCallRef = useRef(false);
    const isGroupCallRef = useRef(false);

    const { socket } = useSocket();

    // Helper to stop all tracks
    const stopStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
            streamRef.current = undefined;
            setStream(undefined);
        }
    };

    // Helper: Create Peer (Group Mesh)
    const createPeer = (userToSignal: string, callerId: string, stream: MediaStream, conversationId: string) => {
        const peer = new SimplePeer({
            initiator: true,
            trickle: true,
            stream,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
        });

        peer.on('signal', signal => {
            socket?.emit('call:signal', {
                toUserId: userToSignal,
                signal,
                conversationId
            });
        });

        peer.on('stream', remoteStream => {
            setRemoteStreams(prev => {
                const existingIndex = prev.findIndex(p => p.peerId === userToSignal);
                if (existingIndex !== -1) {
                    const next = [...prev];
                    next[existingIndex] = { peerId: userToSignal, stream: remoteStream };
                    return next;
                }
                return [...prev, { peerId: userToSignal, stream: remoteStream }];
            });
        });

        peer.on('error', err => {
            console.error('Group Peer Error:', err);
            removePeer(userToSignal);
        });

        peer.on('close', () => {
            removePeer(userToSignal);
        });

        return peer;
    };

    // Helper: Add Peer (Incoming Signal - Group Mesh)
    const addPeer = (incomingSignal: SignalData, callerId: string, stream: MediaStream, conversationId: string) => {
        const peer = new SimplePeer({
            initiator: false,
            trickle: true,
            stream,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
        });

        peer.on('signal', signal => {
            socket?.emit('call:signal', {
                toUserId: callerId,
                signal,
                conversationId
            });
        });

        peer.on('stream', remoteStream => {
            setRemoteStreams(prev => {
                const existingIndex = prev.findIndex(p => p.peerId === callerId);
                if (existingIndex !== -1) {
                    const next = [...prev];
                    next[existingIndex] = { peerId: callerId, stream: remoteStream };
                    return next;
                }
                return [...prev, { peerId: callerId, stream: remoteStream }];
            });
        });

        peer.on('error', err => {
            console.error('Group Peer Error (Answer):', err);
            removePeer(callerId);
        });

        peer.on('close', () => {
            removePeer(callerId);
        });

        peer.signal(incomingSignal);
        return peer;
    };

    const removePeer = (peerId: string) => {
        if (peersRef.current.has(peerId)) {
            peersRef.current.get(peerId)?.destroy();
            peersRef.current.delete(peerId);
        }
        setRemoteStreams(prev => prev.filter(p => p.peerId !== peerId));
    };

    const leaveCall = (emitEvent = true) => {
        setIsInCall(false);
        setIsCallAccepted(false);
        setCallReceived(false);
        setRecipientInfo(null);
        setCallerInfo(null);
        setCallerSignal(null);
        setRemoteStreams([]);

        // Stop 1v1 Peer
        if (connectionRef.current) {
            connectionRef.current.destroy();
            connectionRef.current = null;
        }

        // Stop Group Peers
        peersRef.current.forEach(peer => peer.destroy());
        peersRef.current.clear();

        // Stop Local Stream
        stopStream();

        // Notify
        if (emitEvent && socket) {
            if (isGroupCall) {
                // If group call, we just leave the room
                const convId = callerInfo?.conversationId || recipientInfo?.conversationId;
                if (convId) socket.emit('group-call:leave', { conversationId: convId });
            } else {
                // 1v1
                const targetId = callerInfo?.id || recipientInfo?.id;
                if (targetId) socket.emit('call:end', { toUserId: targetId });
            }
        }

        setIsMuted(false);
        setIsVideoOff(false);
        setIsGroupCall(false);
        // Sync refs
        isInCallRef.current = false;
        isGroupCallRef.current = false;
    };

    // Keep refs in sync with state
    useEffect(() => { isInCallRef.current = isInCall; }, [isInCall]);
    useEffect(() => { isGroupCallRef.current = isGroupCall; }, [isGroupCall]);

    useEffect(() => {
        if (!socket) return;

        // --- 1v1 EVENTS ---
        const handleCallIncoming = (data: IncomingCallData) => {
            console.log('Call Incoming:', data);
            if (isInCallRef.current) {
                socket.emit('call:end', { toUserId: data.fromUserId });
                return;
            }
            setCallReceived(true);
            setIsGroupCall(false);
            setCallerInfo({
                id: data.fromUserId,
                name: data.callerName,
                avatar: data.callerAvatar,
                conversationId: data.conversationId,
                isGroup: false
            });
            setCallerSignal(data.offer);
        };

        const handleCallAccepted = (data: CallAcceptedData) => {
            console.log('1v1 Call Accepted by:', data.fromUserId);
            setIsCallAccepted(true);
            connectionRef.current?.signal(data.answer);
        };

        const handleIceCandidate = (data: IceCandidateData) => {
            connectionRef.current?.signal(data.candidate);
        };

        const handleCallEnded = () => {
            // If 1v1 (use ref to avoid stale closure)
            if (!isGroupCallRef.current) {
                leaveCall(false);
            }
        };

        // --- GROUP EVENTS ---
        const handleGroupCallIncoming = (data: GroupCallIncomingData) => {
            console.log('Group Call Incoming:', data);
            if (isInCallRef.current) return; // Busy

            setCallReceived(true);
            setIsGroupCall(true);
            setCallerInfo({
                id: data.conversationId, // Caller ID is group ID essentially
                name: `Group Call from ${data.callerName}`,
                avatar: data.callerAvatar, // Or group avatar
                conversationId: data.conversationId,
                isGroup: true
            });
            // No single offer, signaling happens after join
        };

        const handleGroupUserJoined = (data: GroupCallUserData) => {
            console.log('User Joined Group Call:', data.userId);
            // Wait for their signal? Or if they join, they will Initiate.
            // If they Initiate, we receive 'call:signal'.
            // So we don't strictly need to do anything here unless we want to show a toast.
            toast.info('New user joined the call');
        };

        const handleGroupUserLeft = (data: GroupCallUserData) => {
            console.log('User Left Group Call:', data.userId);
            removePeer(data.userId);
            toast.info('User left the call');
        };

        // Generic Signal Handler (Used for Group Mesh)
        const handleCallSignal = (data: GroupCallSignalData) => {
            // Only process if in group call mode or upgrading?
            // If we are in the group call:
            if (isInCallRef.current && isGroupCallRef.current) {
                const peerId = data.fromUserId;
                if (peersRef.current.has(peerId)) {
                    // Existing peer (e.g. answer or ice)
                    peersRef.current.get(peerId)?.signal(data.signal);
                } else {
                    // New peer offering (Incoming connection)
                    const localStream = streamRef.current;
                    if (!localStream) return;

                    const newPeer = addPeer(data.signal, peerId, localStream, data.conversationId);
                    peersRef.current.set(peerId, newPeer);
                }
            }
        };


        socket.on('call:incoming', handleCallIncoming);
        socket.on('call:accepted', handleCallAccepted);
        socket.on('call:ice-candidate', handleIceCandidate);
        socket.on('call:ended', handleCallEnded);

        socket.on('group-call:incoming', handleGroupCallIncoming);
        socket.on('group-call:user-joined', handleGroupUserJoined);
        socket.on('group-call:user-left', handleGroupUserLeft);
        socket.on('call:signal', handleCallSignal);

        return () => {
            socket.off('call:incoming', handleCallIncoming);
            socket.off('call:accepted', handleCallAccepted);
            socket.off('call:ice-candidate', handleIceCandidate);
            socket.off('call:ended', handleCallEnded);

            socket.off('group-call:incoming', handleGroupCallIncoming);
            socket.off('group-call:user-joined', handleGroupUserJoined);
            socket.off('group-call:user-left', handleGroupUserLeft);
            socket.off('call:signal', handleCallSignal);
        };
    }, [socket]);




    // Ensure 1v1 video element update
    useEffect(() => {
        if (stream && myVideo.current) {
            myVideo.current.srcObject = stream;
        }
    }, [stream]);

    // Helper: get media stream with optional video (camera not mandatory)
    const getMediaStream = async (wantVideo: boolean): Promise<MediaStream> => {
        if (wantVideo) {
            try {
                // Try to get both audio + video
                return await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            } catch {
                // Camera denied or unavailable – fall back to audio-only
                console.warn('Camera not available, falling back to audio-only');
                toast.info('Không thể truy cập Camera – tiếp tục với âm thanh');
                setIsVideoOff(true);
                return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            }
        }
        // Audio-only requested
        return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    };

    // 1v1 Call
    const callUser = async (userId: string, conversationId: string, isTurnOff: boolean, targetName?: string, targetAvatar?: string) => {
        if (isTurnOff) {
            setIsVideoOff(true);
        }
        setRecipientInfo({ id: userId, conversationId });
        setCallerInfo({
            id: userId,
            name: targetName || 'Nguoi dung',
            avatar: targetAvatar || '',
            conversationId,
            isGroup: false,
        });
        setIsInCall(true);
        setIsGroupCall(false);
        setIsCallAccepted(false);

        try {
            // Camera is optional – only request if not turned off
            const currentStream = await getMediaStream(!isTurnOff);
            streamRef.current = currentStream;
            setStream(currentStream);

            // If camera was requested but not obtained, mark video off
            if (!isTurnOff && currentStream.getVideoTracks().length === 0) {
                setIsVideoOff(true);
            }

            const peer = new SimplePeer({
                initiator: true,
                trickle: true,
                stream: currentStream,
                config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
            });

            peer.on('signal', (data) => {
                if (data.type === 'offer') {
                    socket?.emit('call:start', { toUserId: userId, offer: data, conversationId });
                } else if ("candidate" in data) {
                    socket?.emit('call:ice-candidate', { toUserId: userId, candidate: data, conversationId });
                }
            });

            peer.on('stream', (remoteStream) => {
                if (userVideo.current) userVideo.current.srcObject = remoteStream;
            });

            peer.on('error', (err) => {
                console.error('Peer Error:', err);
                toast.error('Lỗi kết nối P2P');
            });
            peer.on('close', () => leaveCall(false));

            connectionRef.current = peer;
        } catch (err) {
            console.error('Failed to get media:', err);
            toast.error('Không thể truy cập Microphone');
            setIsInCall(false);
        }
    };

    // Start Group Call
    const startGroupCall = async (conversationId: string, isTurnOff: boolean) => {
        if (isTurnOff) {
            setIsVideoOff(true);
        }
        // Starts the session (Notifies others)
        setRecipientInfo({ id: conversationId, conversationId });
        setIsInCall(true);
        setIsGroupCall(true);
        setIsCallAccepted(true); // You are in immediately

        try {
            // Camera is optional – only request if not turned off
            const currentStream = await getMediaStream(!isTurnOff);
            streamRef.current = currentStream;
            setStream(currentStream);

            if (!isTurnOff && currentStream.getVideoTracks().length === 0) {
                setIsVideoOff(true);
            }

            // Notify others to join
            socket?.emit('group-call:start', { conversationId });

            // Join myself to activeGroupCalls
            socket?.emit('group-call:join', { conversationId }, (response: GroupJoinResponse) => {
                // Should return empty list if I'm first
                console.log('Joined group call session:', response);
            });

        } catch (err) {
            console.error(err);
            toast.error('Không thể truy cập Microphone');
            setIsInCall(false);
        }
    };

    // Join Group Call (from Incoming Notification)
    const joinGroupCall = async (conversationId: string) => {
        setCallReceived(false);
        setIsInCall(true);
        setIsGroupCall(true);
        setIsCallAccepted(true);

        try {
            // Start with audio-only, camera is optional
            const currentStream = await getMediaStream(false);
            setIsVideoOff(true);
            streamRef.current = currentStream;
            setStream(currentStream);

            // Join and get existing users
            socket?.emit('group-call:join', { conversationId }, (response: { success: boolean, users: string[] }) => {
                if (response.success && response.users) {
                    console.log('Existing users in call:', response.users);
                    // Create initiator peer for each existing user
                    response.users.forEach(targetUserId => {
                        const peer = createPeer(targetUserId, socket?.id || '', currentStream, conversationId);
                        peersRef.current.set(targetUserId, peer);
                    });
                }
            });

        } catch (err) {
            console.error(err);
            toast.error('Không thể tham gia – kiểm tra quyền Microphone');
            leaveCall(false);
        }
    };


    const answerCall = async () => {
        // If Group Call handled by joinGroupCall via UI button, 
        // but if generic answer button used:
        if (callerInfo?.isGroup) {
            joinGroupCall(callerInfo.conversationId);
            return;
        }

        // 1v1 Answer Logic
        if (!callerInfo || !callerSignal) return;
        setCallReceived(false);
        setIsInCall(true);
        setIsGroupCall(false);
        setIsCallAccepted(true);

        try {
            // Start with audio-only when answering, camera is optional
            const currentStream = await getMediaStream(false);
            setIsVideoOff(true);
            streamRef.current = currentStream;
            setStream(currentStream);

            const peer = new SimplePeer({
                initiator: false,
                trickle: true,
                stream: currentStream,
                config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
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

            peer.on('close', () => leaveCall(false));
            peer.signal(callerSignal);
            connectionRef.current = peer;

        } catch (err) {
            console.error('Answer Call Error:', err);
            toast.error('Không thể truy cập Microphone');
            leaveCall();
        }
    };

    const rejectCall = () => {
        leaveCall(true);
    };

    const toggleAudio = () => {
        if (stream) {
            const audioTrack = stream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleVideo = async () => {
        if (!streamRef.current) return;

        const currentStream = streamRef.current;
        const existingVideoTrack = currentStream.getVideoTracks()[0];

        if (existingVideoTrack) {
            // Already have a video track – just toggle enabled
            existingVideoTrack.enabled = !existingVideoTrack.enabled;
            setIsVideoOff(!existingVideoTrack.enabled);
        } else {
            // No video track yet – request camera permission now
            try {
                const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                const newVideoTrack = videoStream.getVideoTracks()[0];
                if (newVideoTrack) {
                    // Add the new video track to the existing stream
                    currentStream.addTrack(newVideoTrack);

                    // Also add to all active peer connections so remote sees video
                    // 1v1 peer
                    if (connectionRef.current) {
                        try {
                            connectionRef.current.addTrack(newVideoTrack, currentStream);
                        } catch {
                            // Some SimplePeer versions may not support addTrack
                            console.warn('Could not add video track to 1v1 peer');
                        }
                    }
                    // Group peers
                    peersRef.current.forEach((peer) => {
                        try {
                            peer.addTrack(newVideoTrack, currentStream);
                        } catch {
                            console.warn('Could not add video track to group peer');
                        }
                    });

                    setStream(currentStream);
                    setIsVideoOff(false);
                    toast.success('Camera đã được bật');
                }
            } catch {
                toast.error('Không thể truy cập Camera. Vui lòng cấp quyền trong cài đặt trình duyệt.');
            }
        }
    };

    return (
        <CallContext.Provider value={{
            callUser,
            startGroupCall,
            joinGroupCall,
            answerCall,
            leaveCall,
            rejectCall,
            toggleAudio,
            toggleVideo,
            callReceived,
            isInCall,
            isGroupCall,
            isCallAccepted,
            stream,
            remoteStreams,
            myVideo,
            userVideo,
            callerInfo,
            recipientInfo,
            hasVideo: !isVideoOff,
            hasAudio: !isMuted,
            isMuted,
            isVideoOff
        }}>
            {children}
        </CallContext.Provider>
    );
};
