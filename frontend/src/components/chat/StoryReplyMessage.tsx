'use client';

import React from 'react';
import { Box, Typography, Avatar, keyframes } from '@mui/material';
import Image from 'next/image';

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

interface StoryReplyMessageProps {
    storyReply: {
        storyId: string;
        storyMediaUrl: string;
        storyOwnerId: string;
        storyOwnerName: string;
        storyCaption?: string;
    };
    content: string;
    isOwnMessage: boolean;
    senderName?: string;
    senderAvatar?: string;
}

export default function StoryReplyMessage({
    storyReply,
    content,
    isOwnMessage,
    senderName,
    senderAvatar,
}: StoryReplyMessageProps) {
    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: isOwnMessage ? 'row-reverse' : 'row',
                alignItems: 'flex-end',
                gap: 1,
                animation: `${fadeIn} 0.3s ease-out`,
            }}
        >
            {/* Story thumbnail preview */}
            <Box
                sx={{
                    maxWidth: 280,
                    borderRadius: 3,
                    overflow: 'hidden',
                    bgcolor: isOwnMessage ? '#0084ff' : '#3a3b3c',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}
            >
                {/* Story reference header */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 1.5,
                        py: 1,
                        bgcolor: 'rgba(0,0,0,0.1)',
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                    }}
                >
                    <Box
                        sx={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            border: '2px solid',
                            borderColor: isOwnMessage ? 'rgba(255,255,255,0.6)' : '#0084ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Box
                            sx={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                bgcolor: isOwnMessage ? 'rgba(255,255,255,0.6)' : '#0084ff',
                            }}
                        />
                    </Box>
                    <Typography
                        variant="caption"
                        sx={{
                            color: isOwnMessage ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.6)',
                            fontSize: 11,
                        }}
                    >
                        Đã trả lời tin của {storyReply.storyOwnerName}
                    </Typography>
                </Box>

                {/* Story thumbnail */}
                <Box
                    sx={{
                        position: 'relative',
                        width: '100%',
                        height: 150,
                        bgcolor: '#000',
                    }}
                >
                    <Image
                        src={storyReply.storyMediaUrl}
                        alt="Story"
                        fill
                        style={{ objectFit: 'cover' }}
                    />
                    
                    {/* Story caption overlay */}
                    {storyReply.storyCaption && (
                        <Box
                            sx={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                                px: 1.5,
                                py: 1,
                            }}
                        >
                            <Typography
                                variant="caption"
                                sx={{
                                    color: 'white',
                                    fontSize: 11,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                }}
                            >
                                {storyReply.storyCaption}
                            </Typography>
                        </Box>
                    )}
                </Box>

                {/* Reply message content */}
                <Box sx={{ p: 1.5 }}>
                    <Typography
                        sx={{
                            color: 'white',
                            fontSize: 14,
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-wrap',
                        }}
                    >
                        {content}
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
}
