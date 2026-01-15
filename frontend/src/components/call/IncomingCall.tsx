'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useCall } from '@/contexts/CallContext';

export default function IncomingCall() {
    const { callReceived, callerInfo, answerCall, rejectCall } = useCall();

    if (!callReceived || !callerInfo) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -50, scale: 0.9 }}
                className="fixed top-4 right-4 z-[9999] w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700 pointer-events-auto"
            >
                <div className="p-6 flex flex-col items-center">
                    <div className="w-20 h-20 rounded-full mb-4 relative">
                        {/* Ringing animation ring */}
                        <div className="absolute inset-0 rounded-full border-4 border-blue-500 animate-ping opacity-75"></div>
                        <img
                            src={callerInfo.avatar || 'https://via.placeholder.com/150'}
                            alt={callerInfo.name}
                            className="w-full h-full rounded-full object-cover relative z-10 border-2 border-white dark:border-gray-700"
                        />
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 text-center">
                        {callerInfo.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 flex items-center gap-2">
                        <Video size={16} className="text-blue-500" />
                        Đang gọi video cho bạn...
                    </p>

                    <div className="flex gap-8 w-full justify-center">
                        <button
                            onClick={rejectCall}
                            className="group flex flex-col items-center gap-2"
                        >
                            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center transition-transform group-hover:scale-110">
                                <PhoneOff size={24} />
                            </div>
                            <span className="text-xs text-gray-500 font-medium">Từ chối</span>
                        </button>

                        <button
                            onClick={answerCall}
                            className="group flex flex-col items-center gap-2"
                        >
                            <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg shadow-green-500/30 transition-transform group-hover:scale-110 animate-pulse">
                                <Phone size={24} />
                            </div>
                            <span className="text-xs text-gray-500 font-medium">Trả lời</span>
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
