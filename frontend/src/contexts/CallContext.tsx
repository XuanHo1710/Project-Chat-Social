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
    toggleVideo: () => void;

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

    const { socket } = useSocket();

    // Helper to stop all tracks
    const stopStream = () => {
        if (stream) {
            stream.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
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
                if (prev.find(p => p.peerId === userToSignal)) return prev;
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
                if (prev.find(p => p.peerId === callerId)) return prev;
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
    };

    useEffect(() => {
        if (!socket) return;

        // --- 1v1 EVENTS ---
        const handleCallIncoming = (data: IncomingCallData) => {
            console.log('Call Incoming:', data);
            if (isInCall) {
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
            const handleLeaveCall = () => {
                // If 1v1
                if (!isGroupCall) {
                    leaveCall(false);
                }

            }
            handleLeaveCall();
        };

        // --- GROUP EVENTS ---
        const handleGroupCallIncoming = (data: GroupCallIncomingData) => {
            console.log('Group Call Incoming:', data);
            if (isInCall) return; // Busy

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
            if (isInCall && isGroupCall) {
                const peerId = data.fromUserId;
                if (peersRef.current.has(peerId)) {
                    // Existing peer (e.g. answer or ice)
                    peersRef.current.get(peerId)?.signal(data.signal);
                } else {
                    // New peer offering (Incoming connection)
                    if (!stream) return; // Should have stream if in call

                    const newPeer = addPeer(data.signal, peerId, stream, data.conversationId);
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
    }, [socket, isInCall, isGroupCall, stream]);




    // Ensure 1v1 video element update
    useEffect(() => {
        if (stream && myVideo.current) {
            myVideo.current.srcObject = stream;
        }
    }, [stream]);

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
            const currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setStream(currentStream);

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
            toast.error('Không thể truy cập Camera/Microphone');
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
            const currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setStream(currentStream);

            // Notify others to join
            socket?.emit('group-call:start', { conversationId });

            // Join myself to activeGroupCalls
            socket?.emit('group-call:join', { conversationId }, (response: GroupJoinResponse) => {
                // Should return empty list if I'm first
                console.log('Joined group call session:', response);
            });

        } catch (err) {
            console.error(err);
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
            const currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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
            toast.error('Không thể tham gia');
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
            const currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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

    const toggleVideo = () => {
        if (stream) {
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOff(!videoTrack.enabled);
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
