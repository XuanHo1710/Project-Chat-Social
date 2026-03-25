'use client';

import React, { useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    PhoneOff,
    Mic,
    MicOff,
    Video as VideoIcon,
    VideoOff
} from 'lucide-react';
import { useCall } from '@/contexts/CallContext';

export default function VideoCall() {
    const {
        isInCall,
        leaveCall,
        myVideo,
        userVideo,
        stream,
        peerStream,
        isCallAccepted,
        isMuted,
        isVideoOff,
        toggleAudio,
        toggleVideo,
        callerInfo,
        remoteStreams,
        isGroupCall
    } = useCall();

    // FIX: Sync peerStream → userVideo whenever peerStream or isCallAccepted changes
    // This handles the case where peerStream arrives AFTER the video element mounts
    useEffect(() => {
        if (peerStream && userVideo.current && userVideo.current.srcObject !== peerStream) {
            userVideo.current.srcObject = peerStream;
        }
    }, [peerStream, isCallAccepted, userVideo]);

    // FIX: Callback ref for the remote video element.
    // This handles the case where the video element mounts AFTER peerStream is already set.
    const remoteVideoRef = useCallback((el: HTMLVideoElement | null) => {
        // Keep the shared ref in sync
        (userVideo as React.MutableRefObject<HTMLVideoElement | null>).current = el;
        if (el && peerStream && el.srcObject !== peerStream) {
            el.srcObject = peerStream;
            void el.play().catch(() => { /* autoplay race */ });
        }
    }, [peerStream, userVideo]);

    if (!isInCall) return null;

    const renderGroupGrid = () => {
        // Collect all streams: Myself + Remote Peers
        const allStreams = [
            { peerId: 'me', stream: stream },
            ...remoteStreams
        ];

        const count = allStreams.length;

        // Responsive Grid Columns
        let gridCols = 'grid-cols-1';
        if (count > 1) gridCols = 'grid-cols-1 md:grid-cols-2';
        if (count > 2) gridCols = 'grid-cols-2 md:grid-cols-3';
        if (count > 4) gridCols = 'grid-cols-2 md:grid-cols-4';

        return (
            <div className={`w-full h-full p-4 grid ${gridCols} gap-4 overflow-y-auto content-center`}>
                {allStreams.map((item, idx) => (
                    item.stream ? (
                        <div key={item.peerId || idx} className="relative bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-700 min-h-[200px] flex items-center justify-center">
                            <video
                                ref={(el) => {
                                    if (!el) return;
                                    if (el.srcObject !== item.stream) {
                                        el.srcObject = item.stream!;
                                    }
                                    void el.play().catch(() => {
                                        // Playback can be blocked transiently; user interaction will resume.
                                    });
                                }}
                                muted={item.peerId === 'me'} // Always mute self
                                className="w-full h-full object-cover"
                                autoPlay
                                playsInline
                            />
                            <div className="absolute bottom-2 left-2 text-white bg-black/50 px-2 py-0.5 rounded text-xs font-medium">
                                {item.peerId === 'me' ? 'Bạn' : 'Người dùng'}
                            </div>
                        </div>
                    ) : null
                ))}
            </div>
        );
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center overflow-hidden"
        >
            {isGroupCall ? (
                // --- GROUP CALL UI ---
                <>
                    {renderGroupGrid()}
                </>
            ) : (
                // --- 1v1 CALL UI ---
                <>
                    {/* Remote Video (Full Screen) */}
                    <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-900">
                        {isCallAccepted ? (
                            <video
                                ref={remoteVideoRef}
                                className="w-full h-full object-cover"
                                autoPlay
                                playsInline
                                onLoadedMetadata={(event) => {
                                    void event.currentTarget.play().catch(() => {
                                        // Ignore autoplay race; controls remain available.
                                    });
                                }}
                            />
                        ) : (
                            <div className="flex flex-col items-center animate-pulse">
                                <div className="w-24 h-24 rounded-full bg-gray-700 mb-4 overflow-hidden border-4 border-gray-600">
                                    <img
                                        src={callerInfo?.avatar || 'https://via.placeholder.com/150'}
                                        alt="Avatar"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <h3 className="text-white text-2xl font-semibold">Đang kết nối...</h3>
                                <p className="text-gray-400 mt-2">Đang gọi cho {callerInfo?.name}...</p>
                            </div>
                        )}
                    </div>

                    {/* Local Video (Floating) */}
                    {stream && (
                        <motion.div
                            drag
                            whileDrag={{ scale: 1.1 }}
                            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                            className="absolute top-4 right-4 w-32 h-48 md:w-48 md:h-72 bg-gray-800 rounded-xl overflow-hidden shadow-2xl border-2 border-gray-700 cursor-move"
                        >
                            <video
                                ref={myVideo}
                                muted
                                className={`w-full h-full object-cover ${isVideoOff ? 'opacity-0' : 'opacity-100'}`}
                                autoPlay
                                playsInline
                                onLoadedMetadata={(event) => {
                                    void event.currentTarget.play().catch(() => {
                                        // Ignore autoplay race for local preview.
                                    });
                                }}
                            />
                            {isVideoOff && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-600 text-white text-xs">
                                    Camera Off
                                </div>
                            )}
                            <div className="absolute bottom-2 left-2 text-white bg-black/50 px-2 py-0.5 rounded text-xs">
                                Bạn
                            </div>
                        </motion.div>
                    )}
                </>
            )}

            {/* Controls Bar (Shared) */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-gray-900/80 backdrop-blur-md px-6 py-3 md:px-8 md:py-4 rounded-full flex items-center gap-4 md:gap-6 shadow-2xl border border-gray-700 z-50">
                <button
                    onClick={toggleAudio}
                    className={`p-3 md:p-4 rounded-full transition-colors ${isMuted ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-gray-700 text-white hover:bg-gray-600'}`}
                >
                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>

                <button
                    onClick={() => leaveCall()}
                    className="p-4 md:p-5 rounded-full bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/30 transform hover:scale-105 transition-all"
                >
                    <PhoneOff size={32} />
                </button>

                <button
                    onClick={toggleVideo}
                    className={`p-3 md:p-4 rounded-full transition-colors ${isVideoOff ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-gray-700 text-white hover:bg-gray-600'}`}
                >
                    {isVideoOff ? <VideoOff size={24} /> : <VideoIcon size={24} />}
                </button>
            </div>
        </motion.div>
    );
}
