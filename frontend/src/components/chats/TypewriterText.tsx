'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Typography, useTheme } from '@mui/material';

interface TypewriterTextProps {
    text: string;
    speed?: number; // milliseconds per character
    onComplete?: () => void;
    isNew?: boolean; // Only animate if this is a new message
}

export default function TypewriterText({
    text,
    speed = 15,
    onComplete,
    isNew = false
}: TypewriterTextProps) {
    const theme = useTheme();
    const [displayedText, setDisplayedText] = useState(isNew ? '' : text);
    const [isTyping, setIsTyping] = useState(isNew);
    const indexRef = useRef(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Track if animation completed to avoid re-animating on re-renders
    const completedRef = useRef(!isNew);

    // Memoize the text to detect changes
    const textRef = useRef(text);

    useEffect(() => {
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

        // Typewriter effect with variable speed based on character
        const typeNextChar = () => {
            if (indexRef.current < text.length) {
                const nextChar = text[indexRef.current];
                setDisplayedText(text.substring(0, indexRef.current + 1));
                indexRef.current++;

                // Variable speed: pause longer on punctuation
                let nextDelay = speed;
                if (['.', '!', '?'].includes(nextChar)) {
                    nextDelay = speed * 8; // Longer pause after sentences
                } else if ([',', ';', ':'].includes(nextChar)) {
                    nextDelay = speed * 4; // Medium pause after commas
                } else if (nextChar === '\n') {
                    nextDelay = speed * 6; // Pause on newlines
                }

                intervalRef.current = setTimeout(typeNextChar, nextDelay);
            } else {
                setIsTyping(false);
                completedRef.current = true;
                onComplete?.();
            }
        };

        // Start typing after a small delay
        intervalRef.current = setTimeout(typeNextChar, 100);

        return () => {
            if (intervalRef.current) {
                clearTimeout(intervalRef.current);
            }
        };
    }, [text, speed, isNew, onComplete]);

    // Update textRef when text changes
    useEffect(() => {
        if (textRef.current !== text && completedRef.current) {
            // Text changed after completion, show new text immediately
            setDisplayedText(text);
        }
        textRef.current = text;
    }, [text]);

    return (
        <Box sx={{ position: 'relative', display: 'inline' }}>
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

            {/* Blinking cursor while typing */}
            {isTyping && (
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
