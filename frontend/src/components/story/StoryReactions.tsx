'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Typography, keyframes } from '@mui/material';

// Pop animation like Facebook
const popIn = keyframes`
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.4);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
`;

const bounce = keyframes`
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
`;

interface ReactionBubble {
    id: number;
    emoji: string;
}

interface StoryReactionsProps {
    onReactionComplete: (emoji: string) => void;
    storyOwnerName?: string;
    addFloatingEmoji: (emoji: string) => void;
}

const REACTIONS = [
    { emoji: '👍', label: 'Thích' },
    { emoji: '❤️', label: 'Yêu thích' },
    { emoji: '🥰', label: 'Thương thương' },
    { emoji: '😆', label: 'Haha' },
    { emoji: '😮', label: 'Wow' },
    { emoji: '😢', label: 'Buồn' },
    { emoji: '😡', label: 'Phẫn nộ' },
];

export default function StoryReactions({ onReactionComplete, storyOwnerName, addFloatingEmoji }: StoryReactionsProps) {
    const [reactionBubbles, setReactionBubbles] = useState<ReactionBubble[]>([]);
    const [reactionLabel, setReactionLabel] = useState<string>('');
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const labelTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Add reaction bubble with pop animation
    const addReactionBubble = useCallback((emoji: string) => {
        const id = Date.now() + Math.random();
        setReactionBubbles(prev => [...prev.slice(-4), { id, emoji }]); // Keep max 5 bubbles

        // Remove after animation
        setTimeout(() => {
            setReactionBubbles(prev => prev.filter(b => b.id !== id));
        }, 1500);
    }, []);

    // Handle reaction click with short debounce
    const handleReactionClick = useCallback((emoji: string, label: string) => {
        // Add bubble animation
        addReactionBubble(emoji);
        addFloatingEmoji(emoji);


        // Show label
        setReactionLabel(label);
        if (labelTimerRef.current) clearTimeout(labelTimerRef.current);
        labelTimerRef.current = setTimeout(() => setReactionLabel(''), 2000);

        // Clear existing debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Short debounce: only 300ms to batch rapid clicks, then send immediately
        debounceTimerRef.current = setTimeout(() => {
            onReactionComplete(emoji);
        }, 300);
    }, [addReactionBubble, onReactionComplete, addFloatingEmoji]);

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            if (labelTimerRef.current) clearTimeout(labelTimerRef.current);
        };
    }, []);

    return (
        <Box sx={{ position: 'relative' }}>
            {/* Reaction bubbles display (like Facebook's sent reactions) */}
            {reactionBubbles.length > 0 && (
                <Box
                    sx={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        mb: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        bgcolor: 'rgba(0,0,0,0.7)',
                        borderRadius: 3,
                        px: 1.5,
                        py: 0.5,
                    }}
                >
                    {reactionBubbles.map(({ id, emoji }) => (
                        <Box
                            key={id}
                            sx={{
                                fontSize: 20,
                                animation: `${popIn} 0.3s ease-out`,
                            }}
                        >
                            {emoji}
                        </Box>
                    ))}
                    {storyOwnerName && (
                        <Typography
                            variant="caption"
                            sx={{ color: 'white', ml: 0.5, whiteSpace: 'nowrap' }}
                        >
                            Đã gửi cho {storyOwnerName}
                        </Typography>
                    )}
                </Box>
            )}

            {/* Reaction label tooltip */}
            {reactionLabel && (
                <Box
                    sx={{
                        position: 'absolute',
                        bottom: '100%',
                        right: 0,
                        mb: 1,
                        bgcolor: 'rgba(0,0,0,0.8)',
                        color: 'white',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 1,
                        fontSize: 12,
                        fontWeight: 500,
                        animation: `${popIn} 0.2s ease-out`,
                    }}
                >
                    {reactionLabel}
                </Box>
            )}

            {/* Reaction buttons - Facebook/TikTok style - larger and more visible */}
            <Box
                sx={{
                    display: 'flex',
                    gap: 0.5,
                    alignItems: 'center',
                    bgcolor: 'rgba(0,0,0,0.4)',
                    borderRadius: 5,
                    px: 1,
                    py: 0.5,
                }}
            >
                {REACTIONS.map(({ emoji, label }) => (
                    <Box
                        key={emoji}
                        onClick={() => handleReactionClick(emoji, label)}
                        sx={{
                            width: 44,
                            height: 44,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 28,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            borderRadius: '50%',
                            '&:hover': {
                                transform: 'scale(1.4)',
                                animation: `${bounce} 0.5s ease infinite`,
                                bgcolor: 'rgba(255,255,255,0.15)',
                            },
                            '&:active': {
                                transform: 'scale(0.85)',
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
