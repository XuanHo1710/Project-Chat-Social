'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Box, keyframes } from '@mui/material';

// Animation keyframes for floating up
const floatUp = keyframes`
  0% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  50% {
    opacity: 0.8;
    transform: translateY(-150px) scale(1.2);
  }
  100% {
    opacity: 0;
    transform: translateY(-300px) scale(0.8);
  }
`;

const wiggle = keyframes`
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-10px); }
  75% { transform: translateX(10px); }
`;

interface FloatingEmoji {
    id: number;
    emoji: string;
    x: number;
}

interface FloatingReactionsProps {
    onReactionComplete: (emoji: string) => void;
}

export default function FloatingReactions({ onReactionComplete }: FloatingReactionsProps) {
    const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
    const [pendingReaction, setPendingReaction] = useState<string | null>(null);
    const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

    const REACTIONS = ['👍', '❤️', '😆', '😮', '😢', '😡'];

    // Add floating emoji animation
    const addFloatingEmoji = useCallback((emoji: string) => {
        const id = Date.now() + Math.random();
        const x = Math.random() * 60 + 20; // Random position between 20-80%

        setFloatingEmojis(prev => [...prev, { id, emoji, x }]);

        // Remove after animation completes
        setTimeout(() => {
            setFloatingEmojis(prev => prev.filter(e => e.id !== id));
        }, 2000);
    }, []);

    // Handle reaction click with debounce
    const handleReactionClick = useCallback((emoji: string) => {
        // Add floating animation immediately
        addFloatingEmoji(emoji);

        // Update pending reaction
        setPendingReaction(emoji);

        // Clear existing timer
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        // Set new timer - wait 1.5s before sending to API
        const timer = setTimeout(() => {
            if (pendingReaction) {
                onReactionComplete(emoji);
            }
            setPendingReaction(null);
        }, 1500);

        setDebounceTimer(timer);
    }, [addFloatingEmoji, debounceTimer, onReactionComplete, pendingReaction]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
        };
    }, [debounceTimer]);

    return (
        <Box sx={{ position: 'relative', width: '100%' }}>
            {/* Floating emojis container */}
            <Box
                sx={{
                    position: 'absolute',
                    bottom: 60,
                    left: 0,
                    right: 0,
                    height: 300,
                    pointerEvents: 'none',
                    overflow: 'hidden',
                }}
            >
                {floatingEmojis.map(({ id, emoji, x }) => (
                    <Box
                        key={id}
                        sx={{
                            position: 'absolute',
                            bottom: 0,
                            left: `${x}%`,
                            fontSize: 32,
                            animation: `${floatUp} 2s ease-out forwards, ${wiggle} 0.5s ease-in-out infinite`,
                            zIndex: 100,
                        }}
                    >
                        {emoji}
                    </Box>
                ))}
            </Box>

            {/* Reaction buttons */}
            <Box
                sx={{
                    display: 'flex',
                    gap: 0.5,
                    justifyContent: 'center',
                }}
            >
                {REACTIONS.map((emoji) => (
                    <Box
                        key={emoji}
                        onClick={() => handleReactionClick(emoji)}
                        sx={{
                            fontSize: 28,
                            p: 0.5,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            borderRadius: '50%',
                            '&:hover': {
                                transform: 'scale(1.3)',
                                bgcolor: 'rgba(255,255,255,0.15)',
                            },
                            '&:active': {
                                transform: 'scale(0.9)',
                            },
                        }}
                    >
                        {emoji}
                    </Box>
                ))}
            </Box>
        </Box>
    );
}
