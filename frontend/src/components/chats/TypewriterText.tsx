'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, useTheme } from '@mui/material';

interface TypewriterTextProps {
    text: string;
    speed?: number; // milliseconds per character
    onComplete?: () => void;
    isNew?: boolean; // Only animate if this is a new message
    isStreaming?: boolean; // SSE streaming mode — text grows from outside
}

export default function TypewriterText({
    text,
    speed = 15,
    onComplete,
    isNew = false,
    isStreaming = false,
}: TypewriterTextProps) {
    const theme = useTheme();
    const [displayedText, setDisplayedText] = useState(isNew && !isStreaming ? '' : text);
    const [isTyping, setIsTyping] = useState(isNew || isStreaming);
    const indexRef = useRef(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Track if animation completed to avoid re-animating on re-renders
    const completedRef = useRef(!isNew && !isStreaming);

    // Memoize the text to detect changes
    const textRef = useRef(text);

    // === SSE STREAMING MODE ===
    // Text prop grows as tokens arrive → just display it directly
    useEffect(() => {
        if (!isStreaming) return;
        setDisplayedText(text);
        setIsTyping(true);
    }, [text, isStreaming]);

    // When streaming stops (isStreaming flips false), mark completed
    useEffect(() => {
        if (!isStreaming && textRef.current !== text && completedRef.current) {
            setDisplayedText(text);
        }
        if (!isStreaming && isTyping && displayedText === text && text.length > 0) {
            setIsTyping(false);
            completedRef.current = true;
            onComplete?.();
        }
        textRef.current = text;
    }, [text, isStreaming]);

    // === LEGACY TYPEWRITER MODE (full text arrives at once) ===
    useEffect(() => {
        if (isStreaming) return; // Skip if streaming

        // If not a new message or already completed, show full text
        if (!isNew || completedRef.current) {
            setDisplayedText(text);
            setIsTyping(false);
            return;
        }

        // Reset for new animation
        indexRef.current = 0;
        setDisplayedText('');
        setIsTyping(true);

        const typeNextChar = () => {
            if (indexRef.current < text.length) {
                const nextChar = text[indexRef.current];
                setDisplayedText(text.substring(0, indexRef.current + 1));
                indexRef.current++;

                let nextDelay = speed;
                if (['.', '!', '?'].includes(nextChar)) {
                    nextDelay = speed * 8;
                } else if ([',', ';', ':'].includes(nextChar)) {
                    nextDelay = speed * 4;
                } else if (nextChar === '\n') {
                    nextDelay = speed * 6;
                }

                intervalRef.current = setTimeout(typeNextChar, nextDelay);
            } else {
                setIsTyping(false);
                completedRef.current = true;
                onComplete?.();
            }
        };

        intervalRef.current = setTimeout(typeNextChar, 100);

        return () => {
            if (intervalRef.current) {
                clearTimeout(intervalRef.current);
            }
        };
    }, [text, speed, isNew, onComplete, isStreaming]);

    return (
        <Box sx={{ position: 'relative', display: 'inline' }}>
            {/* Show thinking dots when streaming starts but no text yet */}
            {isStreaming && !displayedText && (
                <Box component="span" sx={{ display: 'inline-flex', gap: '3px', alignItems: 'center', py: 0.5 }}>
                    {[0, 1, 2].map((i) => (
                        <Box
                            key={i}
                            component="span"
                            sx={{
                                display: 'inline-block',
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                bgcolor: 'primary.main',
                                opacity: 0.6,
                                animation: 'thinkingPulse 1.2s infinite ease-in-out',
                                animationDelay: `${i * 0.2}s`,
                                '@keyframes thinkingPulse': {
                                    '0%, 80%, 100%': { transform: 'scale(0.5)', opacity: 0.3 },
                                    '40%': { transform: 'scale(1)', opacity: 0.8 },
                                },
                            }}
                        />
                    ))}
                </Box>
            )}

            <Typography
                component="span"
                sx={{
                    lineHeight: 1.6,
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    '& code': {
                        background: (theme) => theme.palette.mode === 'dark'
                            ? 'rgba(102, 126, 234, 0.2)'
                            : 'rgba(102, 126, 234, 0.1)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontSize: 13,
                    },
                }}
            >
                {displayedText}
            </Typography>

            {/* Blinking cursor while typing (only show when there's text) */}
            {isTyping && displayedText && (
                <Box
                    component="span"
                    sx={{
                        display: 'inline-block',
                        width: '2px',
                        height: '1em',
                        backgroundColor: 'primary.main',
                        marginLeft: '2px',
                        verticalAlign: 'text-bottom',
                        animation: 'cursorBlink 0.8s infinite',
                        '@keyframes cursorBlink': {
                            '0%, 50%': { opacity: 1 },
                            '51%, 100%': { opacity: 0 },
                        },
                    }}
                />
            )}
        </Box>
    );
}
