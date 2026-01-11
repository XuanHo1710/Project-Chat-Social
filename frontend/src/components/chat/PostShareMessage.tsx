'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, Avatar, Paper, keyframes } from '@mui/material';
import {
    Public as PublicIcon,
    People as PeopleIcon,
    Lock as LockIcon,
    PlayArrow as PlayArrowIcon,
    Image as ImageIcon,
    ThumbUp as ThumbUpIcon,
} from '@mui/icons-material';
import { PostType } from '@/types/post';

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

interface PostShareMessageProps {
    post: PostType | null;
    isOwn: boolean;
    avatar?: string;
    themeColor?: string;
    onClick?: () => void;
}

export default function PostShareMessage({
    post,
    isOwn,
    avatar,
    themeColor = '#0084ff',
    onClick,
}: PostShareMessageProps) {
    const router = useRouter();

    // Navigate to feed with post highlighted
    const handlePostClick = () => {
        if (onClick) {
            onClick();
        } else if (post?._id) {
            // Navigate to feed with postId query to highlight/scroll to that post
            // Use window.location for full page navigation to ensure query param is processed
            router.push(`/?postId=${post._id}`);
        }
    };
    // Privacy icon
    const PrivacyIcon = post?.privacy === 'PUBLIC' ? PublicIcon : post?.privacy === 'FRIEND' ? PeopleIcon : LockIcon;

    if (!post || (post.privacy === 'PRIVATE' && !isOwn)) {
        return (
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isOwn ? 'flex-end' : 'flex-start',
                px: 2,
                py: 0.3,
            }}>
                <Box sx={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 0.5,
                    maxWidth: '70%',
                    flexDirection: isOwn ? 'row-reverse' : 'row'
                }}>
                    {!isOwn && avatar && (
                        <Avatar
                            src={avatar}
                            sx={{ width: 28, height: 28, mb: 0.5 }}
                        />
                    )}
                    <Paper
                        elevation={0}
                        sx={{
                            bgcolor: isOwn ? themeColor : '#e4e6eb',
                            color: isOwn ? 'white' : '#050505',
                            borderRadius: '18px',
                            p: 1.5,
                            maxWidth: 280,
                            animation: `${fadeIn} 0.3s ease-out`,
                        }}
                    >
                        <Typography fontSize={14} fontStyle="italic">
                            Bài viết không còn tồn tại
                        </Typography>
                    </Paper>
                </Box>
            </Box>
        );
    }

    const authorName = post.userId
        ? `${post.userId.firstName} ${post.userId.lastName}`
        : 'Unknown';

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: isOwn ? 'flex-end' : 'flex-start',
            px: 2,
            py: 0.3,
        }}>
            <Box sx={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 0.5,
                maxWidth: '70%',
                flexDirection: isOwn ? 'row-reverse' : 'row'
            }}>
                {/* Avatar người gửi */}
                {!isOwn && avatar && (
                    <Avatar
                        src={avatar}
                        sx={{ width: 28, height: 28, mb: 0.5 }}
                    />
                )}

                {/* Card bài viết */}
                <Paper
                    elevation={0}
                    onClick={handlePostClick}
                    sx={{
                        bgcolor: '#ffffff',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        maxWidth: 300,
                        cursor: 'pointer',
                        animation: `${fadeIn} 0.3s ease-out`,
                        transition: 'all 0.2s ease',
                        border: '1px solid #e4e6eb',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        '&:hover': onClick ? {
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        } : {},
                    }}
                >
                    {/* Post header */}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            p: 1.5,
                            bgcolor: '#fff',
                        }}
                    >
                        <Avatar
                            src={post.userId?.avatar}
                            sx={{
                                width: 36,
                                height: 36,
                            }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                                fontSize={14}
                                fontWeight={600}
                                sx={{
                                    color: '#050505',
                                    lineHeight: 1.2,
                                }}
                            >
                                {authorName}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                                <PrivacyIcon sx={{ fontSize: 12, color: '#65676b' }} />
                                <Typography fontSize={12} sx={{ color: '#65676b' }}>
                                    Bài viết
                                </Typography>
                            </Box>
                        </Box>
                    </Box>

                    {/* Post content preview */}
                    {post.content && !post.background && (
                        <Box sx={{ px: 1.5, pb: 1.5 }}>
                            <Typography
                                fontSize={14}
                                sx={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    lineHeight: 1.4,
                                    color: '#050505',
                                }}
                            >
                                {post.content}
                            </Typography>
                        </Box>
                    )}

                    {/* Post media preview */}
                    {post.media && post.media.length > 0 && (
                        <Box
                            sx={{
                                position: 'relative',
                                width: '100%',
                                height: 160,
                                bgcolor: '#000',
                            }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={post.media[0].url}
                                alt="Post media"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                }}
                            />

                            {/* Video indicator */}
                            {post.media[0].mediaType === 'VIDEO' && (
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        bgcolor: 'rgba(0,0,0,0.6)',
                                        borderRadius: '50%',
                                        width: 48,
                                        height: 48,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '2px solid white',
                                    }}
                                >
                                    <PlayArrowIcon sx={{ color: 'white', fontSize: 28, ml: 0.3 }} />
                                </Box>
                            )}

                            {/* Multiple media indicator */}
                            {post.media.length > 1 && (
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        top: 8,
                                        right: 8,
                                        bgcolor: 'rgba(0,0,0,0.7)',
                                        borderRadius: 1,
                                        px: 1,
                                        py: 0.25,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.5,
                                    }}
                                >
                                    <ImageIcon sx={{ color: 'white', fontSize: 14 }} />
                                    <Typography fontSize={11} color="white" fontWeight={600}>
                                        +{post.media.length - 1}
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    )}

                    {/* Post with background */}
                    {post.content && post.background && (
                        <Box
                            sx={{
                                background: post.background,
                                p: 2.5,
                                minHeight: 120,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Typography
                                fontSize={16}
                                fontWeight={600}
                                textAlign="center"
                                color="white"
                                sx={{
                                    textShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                    lineHeight: 1.4,
                                }}
                            >
                                {post.content}
                            </Typography>
                        </Box>
                    )}

                    {/* Stats footer */}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            px: 1.5,
                            py: 1,
                            bgcolor: '#f7f8fa',
                            borderTop: '1px solid #e4e6eb',
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Box
                                sx={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: '50%',
                                    bgcolor: '#1877f2',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <ThumbUpIcon sx={{ fontSize: 10, color: 'white' }} />
                            </Box>
                            <Typography fontSize={12} sx={{ color: '#65676b' }}>
                                {post.totalReacts || 0}
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Typography fontSize={12} sx={{ color: '#65676b' }}>
                                {post.totalComments || 0} bình luận
                            </Typography>
                            {(post.totalShares || 0) > 0 && (
                                <Typography fontSize={12} sx={{ color: '#65676b' }}>
                                    {post.totalShares} chia sẻ
                                </Typography>
                            )}
                        </Box>
                    </Box>
                </Paper>
            </Box>
        </Box>
    );
}