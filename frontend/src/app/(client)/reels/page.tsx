'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Box,
    Typography,
    Avatar,
    IconButton,
    CircularProgress,
    Button,
    Menu,
    Divider,
    useTheme,
} from '@mui/material';
import {
    ChatBubbleOutline as CommentIcon,
    Share as ShareIcon,
    MoreHoriz as MoreIcon,
    KeyboardArrowUp as ArrowUpIcon,
    KeyboardArrowDown as ArrowDownIcon,
    VolumeUp as VolumeIcon,
    VolumeOff as MuteIcon,
    ThumbUp as ThumbUpIcon,
    PlayArrow as PlayIcon,
    Pause as PauseIcon,
    Close as CloseIcon,
} from '@mui/icons-material';
import { useInfiniteQuery } from '@tanstack/react-query';
import { postService } from '@/services/post.service';
import { useAuthStore } from '@/stores/useAuthStore';
import { PostType, PostPrivacy } from '@/types/post';
import { formatPostTime, getAuthorName } from '@/utils/formatPost';
import { useRouter } from 'next/navigation';
import { CLIENT_PATH } from '@/constants/paths';
import ReactionButton from '@/components/posts/ReactionButton';
import CommentSection from '@/components/posts/CommentSection';
import Header from '@/components/home/Header';
import ShareContentModal from '@/components/posts/ShareContentModal';
import PostOptionContentMenu from '@/components/posts/PostOptionContentMenu';
import ReactionListDialog from '@/components/posts/ReactionListDialog';
import { toast } from 'sonner';
import { useReactionStore } from '@/stores/useReactionStore';
import { HashtagContent } from '@/utils/hashtagParser';

// Reaction emoji mapping
const reactionEmoji: Record<string, { emoji: string; bg: string }> = {
    LIKE: { emoji: '👍', bg: '#1877f2' },
    LOVE: { emoji: '❤️', bg: '#f33e58' },
    HAHA: { emoji: '😆', bg: '#f7b125' },
    WOW: { emoji: '😮', bg: '#f7b125' },
    SAD: { emoji: '😢', bg: '#f7b125' },
    ANGRY: { emoji: '😡', bg: '#e9710f' },
};

export default function ReelsPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const hoverBg = isDark ? 'rgba(255,255,255,0.1)' : '#f0f2f5';
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isMuted, setIsMuted] = useState(true);
    const [isPaused, setIsPaused] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

    // Share modal state
    const [openShareModal, setOpenShareModal] = useState(false);
    const [shareCaption, setShareCaption] = useState('');
    const [sharePrivacy] = useState<PostPrivacy>('PUBLIC');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Menu state
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

    // Reaction list dialog
    const [reactionListOpen, setReactionListOpen] = useState(false);

    // Reaction store
    const { postReactions, initPostReaction } = useReactionStore();

    // Touch handling for swipe
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    // Minimum swipe distance (in px)
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null); // Reset touch end
        setTouchStart(e.targetTouches[0].clientY);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientY);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;

        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) {
            // Swiped up (next)
            goToNext();
        }
        if (isRightSwipe) {
            // Swiped down (prev)
            goToPrev();
        }
    };

    // Fetch video posts from dedicated reels API
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
    } = useInfiniteQuery({
        queryKey: ['reels', user?.id],
        queryFn: async ({ pageParam = 1 }) => {
            const response = await postService.getVideoReels({ page: pageParam, limit: 10 });
            return response;
        },
        getNextPageParam: (lastPage) => {
            if (lastPage.page < lastPage.totalPages) {
                return lastPage.page + 1;
            }
            return undefined;
        },
        initialPageParam: 1,
        enabled: !!user?.id,
    });

    // Video posts are already filtered from backend
    const videoPosts = data?.pages.flatMap(page => page.data) || [];

    // Current video post
    const currentPost = videoPosts[currentIndex];

    // Get reaction state from store
    const reactionState = currentPost ? postReactions[currentPost._id] : null;
    const displayTotalReacts = reactionState?.totalReacts ?? currentPost?.totalReacts ?? 0;

    // Initialize reaction store
    useEffect(() => {
        if (currentPost) {
            initPostReaction(currentPost._id, currentPost.totalReacts);
        }
    }, [currentPost, initPostReaction]);

    // Handle video playback
    useEffect(() => {
        videoRefs.current.forEach((video, index) => {
            if (video) {
                if (index === currentIndex) {
                    if (!isPaused) {
                        video.play().catch(() => { });
                    }
                    video.muted = isMuted;
                } else {
                    video.pause();
                    video.currentTime = 0;
                }
            }
        });
    }, [currentIndex, isMuted, isPaused, videoPosts.length]);

    // Toggle play/pause
    const togglePlayPause = useCallback(() => {
        const currentVideo = videoRefs.current[currentIndex];
        if (currentVideo) {
            if (isPaused) {
                currentVideo.play().catch(() => { });
            } else {
                currentVideo.pause();
            }
            setIsPaused(!isPaused);
        }
    }, [currentIndex, isPaused]);

    // Navigate between reels
    const goToNext = useCallback(() => {
        if (currentIndex < videoPosts.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setIsPaused(false);
        } else if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage().then(() => {
                setCurrentIndex(prev => prev + 1);
                setIsPaused(false);
            });
        }
    }, [currentIndex, videoPosts.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

    const goToPrev = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setIsPaused(false);
        }
    }, [currentIndex]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                goToNext();
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                goToPrev();
            } else if (e.key === 'm' || e.key === 'M') {
                setIsMuted(prev => !prev);
            } else if (e.key === ' ') {
                e.preventDefault();
                togglePlayPause();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [goToNext, goToPrev, togglePlayPause]);

    const handleProfileClick = () => {
        if (currentPost?.userId?.username) {
            router.push(CLIENT_PATH.PROFILE_BY_USERNAME(currentPost.userId.username));
        }
    };

    const getVideoUrl = (post: PostType) => {
        const videoMedia = post.media?.find(m => m.mediaType === 'VIDEO');
        return videoMedia?.url || '';
    };

    // Handle post settings toggle
    const handleToggleComments = async (allow: boolean) => {
        if (!currentPost) return;
        try {
            await postService.updatePost(currentPost._id, { allowComments: allow });
            toast.success(allow ? 'Đã bật bình luận' : 'Đã tắt bình luận');
        } catch {
            toast.error('Có lỗi xảy ra');
        }
    };

    const handleToggleShares = async (allow: boolean) => {
        if (!currentPost) return;
        try {
            await postService.updatePost(currentPost._id, { allowShares: allow });
            toast.success(allow ? 'Đã bật chia sẻ' : 'Đã tắt chia sẻ');
        } catch {
            toast.error('Có lỗi xảy ra');
        }
    };

    const handleToggleReactions = async (allow: boolean) => {
        if (!currentPost) return;
        try {
            await postService.updatePost(currentPost._id, { allowReactions: allow });
            toast.success(allow ? 'Đã bật cảm xúc' : 'Đã tắt cảm xúc');
        } catch {
            toast.error('Có lỗi xảy ra');
        }
    };

    if (isLoading) {
        return (
            <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#000' }}>
                <Header />
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CircularProgress sx={{ color: 'white' }} />
                </Box>
            </Box>
        );
    }

    if (videoPosts.length === 0) {
        return (
            <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#000' }}>
                <Header />
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
                    <Typography sx={{ color: 'white', fontSize: 18 }}>Không có video nào</Typography>
                    <Button variant="contained" onClick={() => router.push('/')}>
                        Quay về trang chủ
                    </Button>
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ height: '100vh', width: '100%', bgcolor: '#000', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <Header />

            {/* Main Content - Fullscreen by default */}
            <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', mt: '56px' }}>
                {/* Video Area - Full width khi không show comments */}
                <Box sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    bgcolor: '#000',
                    minWidth: 0,
                    touchAction: 'none', // Prevent default browser scroll
                }}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                >
                    {/* Video Container - Contains video and all overlays */}
                    <Box sx={{
                        width: '100%',
                        maxWidth: 420,
                        height: 'calc(100vh - 56px)',
                        position: 'relative',
                        borderRadius: 3,
                        bgcolor: '#000',
                        mx: 'auto',
                    }}>
                        {videoPosts.map((post, index) => (
                            <Box
                                key={post._id}
                                sx={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    display: index === currentIndex ? 'flex' : 'none',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    bgcolor: '#000',
                                }}
                            >
                                <video
                                    ref={el => { videoRefs.current[index] = el; }}
                                    src={getVideoUrl(post)}
                                    loop
                                    playsInline
                                    muted={isMuted}
                                    autoPlay={index === currentIndex && !isPaused}
                                    onClick={togglePlayPause}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        cursor: 'pointer',
                                    }}
                                />

                                {/* Pause overlay */}
                                {isPaused && index === currentIndex && (
                                    <Box
                                        onClick={togglePlayPause}
                                        sx={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            width: 80,
                                            height: 80,
                                            borderRadius: '50%',
                                            bgcolor: 'rgba(0,0,0,0.6)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            transition: 'transform 0.2s',
                                            '&:hover': { transform: 'translate(-50%, -50%) scale(1.1)' }
                                        }}
                                    >
                                        <PlayIcon sx={{ fontSize: 50, color: 'white' }} />
                                    </Box>
                                )}
                            </Box>
                        ))}

                        {/* Gradient overlay for better text visibility */}
                        <Box sx={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: '40%',
                            background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
                            pointerEvents: 'none',
                            zIndex: 2,
                        }} />

                        {/* Author info overlay - Bottom */}
                        {currentPost && (
                            <Box sx={{
                                position: 'absolute',
                                bottom: 80,
                                left: 16,
                                right: 80,
                                zIndex: 5,
                            }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                                    <Avatar
                                        src={currentPost.userId?.avatar || ''}
                                        sx={{ width: 44, height: 44, cursor: 'pointer', border: '2px solid white' }}
                                        onClick={handleProfileClick}
                                    />
                                    <Box sx={{ flex: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography
                                                sx={{
                                                    color: 'white',
                                                    fontWeight: 700,
                                                    fontSize: 15,
                                                    cursor: 'pointer',
                                                    textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                                                    '&:hover': { textDecoration: 'underline' }
                                                }}
                                                onClick={handleProfileClick}
                                            >
                                                {getAuthorName(currentPost)}
                                            </Typography>
                                            <Typography sx={{ color: 'rgba(255,255,255,0.95)', fontSize: 14, fontWeight: 500, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                                                · Theo dõi
                                            </Typography>
                                        </Box>
                                        <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                                            {formatPostTime(currentPost.createdAt)}
                                        </Typography>
                                    </Box>
                                </Box>
                                {currentPost.content && (
                                    <Typography sx={{
                                        color: 'white',
                                        fontSize: 14,
                                        textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        lineHeight: 1.4,
                                    }}>
                                        {currentPost.content}
                                    </Typography>
                                )}
                            </Box>
                        )}

                        {/* Control buttons - Top left */}
                        <Box sx={{
                            position: 'absolute',
                            top: 16,
                            left: 16,
                            display: 'flex',
                            gap: 1,
                            zIndex: 5,
                        }}>
                            {/* Play/Pause */}
                            <IconButton
                                onClick={togglePlayPause}
                                sx={{
                                    bgcolor: 'rgba(255,255,255,0.2)',
                                    color: 'white',
                                    width: 40,
                                    height: 40,
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
                                }}
                            >
                                {isPaused ? <PlayIcon /> : <PauseIcon />}
                            </IconButton>
                            {/* Mute */}
                            <IconButton
                                onClick={() => setIsMuted(!isMuted)}
                                sx={{
                                    bgcolor: 'rgba(255,255,255,0.2)',
                                    color: 'white',
                                    width: 40,
                                    height: 40,
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
                                }}
                            >
                                {isMuted ? <MuteIcon /> : <VolumeIcon />}
                            </IconButton>
                        </Box>

                        {/* Sidebar Actions - Right side inside video */}
                        {currentPost && (
                            <Box sx={{
                                position: 'absolute',
                                right: 12,
                                bottom: 100,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 2,
                                zIndex: 100,
                            }}>
                                {/* Reaction */}
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1000 }}>
                                    <ReactionButton
                                        post={currentPost}
                                        initialTotalReacts={currentPost.totalReacts}
                                        variant="reels"
                                    />
                                </Box>

                                {/* Comments */}
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1000 }}>
                                    <IconButton
                                        onClick={() => setShowComments(!showComments)}
                                        sx={{
                                            bgcolor: showComments ? 'rgba(24,119,242,0.8)' : 'rgba(255,255,255,0.15)',
                                            color: 'white',
                                            width: 44,
                                            height: 44,
                                            '&:hover': { bgcolor: showComments ? 'rgba(24,119,242,0.9)' : 'rgba(255,255,255,0.25)' }
                                        }}
                                    >
                                        <CommentIcon sx={{ fontSize: 22 }} />
                                    </IconButton>
                                    <Typography sx={{ color: 'white', fontSize: 12, mt: 0.5, fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                                        {currentPost.totalComments || 0}
                                    </Typography>
                                </Box>

                                {/* Share */}
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <IconButton
                                        onClick={() => setOpenShareModal(true)}
                                        sx={{
                                            bgcolor: 'rgba(255,255,255,0.15)',
                                            color: 'white',
                                            width: 44,
                                            height: 44,
                                            '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }
                                        }}
                                    >
                                        <ShareIcon sx={{ fontSize: 22 }} />
                                    </IconButton>
                                    <Typography sx={{ color: 'white', fontSize: 12, mt: 0.5, fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                                        {currentPost.totalShares || 0}
                                    </Typography>
                                </Box>

                                {/* More Options */}
                                <IconButton
                                    onClick={(e) => setMenuAnchor(e.currentTarget)}
                                    sx={{
                                        bgcolor: 'rgba(255,255,255,0.15)',
                                        color: 'white',
                                        width: 44,
                                        height: 44,
                                        '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }
                                    }}
                                >
                                    <MoreIcon sx={{ fontSize: 22 }} />
                                </IconButton>
                            </Box>
                        )}
                    </Box>

                    {/* Navigation Arrows - Outside video container */}
                    <Box sx={{
                        position: 'absolute',
                        right: { xs: 'auto', md: 24 },
                        left: { xs: 16, md: 'auto' },
                        top: '50%',
                        transform: 'translateY(-50%)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                        zIndex: 10,
                    }}>
                        <IconButton
                            onClick={goToPrev}
                            disabled={currentIndex === 0}
                            sx={{
                                bgcolor: 'rgba(255,255,255,0.15)',
                                color: 'white',
                                width: 48,
                                height: 48,
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
                                '&:disabled': { color: 'rgba(255,255,255,0.3)', bgcolor: 'rgba(255,255,255,0.05)' }
                            }}
                        >
                            <ArrowUpIcon />
                        </IconButton>
                        <IconButton
                            onClick={goToNext}
                            disabled={currentIndex >= videoPosts.length - 1 && !hasNextPage}
                            sx={{
                                bgcolor: 'rgba(255,255,255,0.15)',
                                color: 'white',
                                width: 48,
                                height: 48,
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
                                '&:disabled': { color: 'rgba(255,255,255,0.3)', bgcolor: 'rgba(255,255,255,0.05)' }
                            }}
                        >
                            <ArrowDownIcon />
                        </IconButton>
                    </Box>
                </Box>

                {/* Right Panel - Comments (Responsive: Overlay on mobile, Side panel on desktop) */}
                {showComments && currentPost && (
                    <Box sx={{
                        width: { xs: '100%', md: 420 },
                        minWidth: { xs: '100%', md: 420 },
                        maxWidth: { xs: '100%', md: 420 },
                        bgcolor: 'background.paper',
                        display: 'flex',
                        flexDirection: 'column',
                        height: { xs: '75vh', md: 'calc(100vh - 56px)' },
                        borderLeft: { xs: 'none', md: `1px solid ${theme.palette.divider}` },
                        borderTopLeftRadius: { xs: 16, md: 0 },
                        borderTopRightRadius: { xs: 16, md: 0 },
                        position: { xs: 'fixed', md: 'static' },
                        bottom: 0,
                        left: 0,
                        zIndex: 1200,
                        flexShrink: 0,
                        boxShadow: { xs: '0 -4px 20px rgba(0,0,0,0.5)', md: 'none' },
                        transition: 'transform 0.3s ease-in-out',
                    }}>
                        {/* Mobile Drag Handle */}
                        <Box sx={{
                            display: { xs: 'flex', md: 'none' },
                            justifyContent: 'center',
                            pt: 1.5,
                            pb: 0.5,
                            cursor: 'grab'
                        }}>
                            <Box sx={{ width: 40, height: 4, bgcolor: 'grey.300', borderRadius: 2 }} />
                        </Box>
                        {/* Post Header */}
                        <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                                <Avatar
                                    src={currentPost.userId?.avatar || ''}
                                    sx={{ width: 40, height: 40, mr: 1.5, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
                                    onClick={handleProfileClick}
                                />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography
                                        sx={{
                                            fontSize: '15px',
                                            fontWeight: 600,
                                            color: 'text.primary',
                                            cursor: 'pointer',
                                            '&:hover': { textDecoration: 'underline' }
                                        }}
                                        onClick={handleProfileClick}
                                    >
                                        {getAuthorName(currentPost)}
                                    </Typography>
                                    <Typography sx={{ fontSize: '13px', color: 'text.secondary' }}>
                                        {formatPostTime(currentPost.createdAt)}
                                    </Typography>
                                </Box>
                                <IconButton onClick={() => setShowComments(false)} sx={{ mt: -0.5 }}>
                                    <CloseIcon />
                                </IconButton>
                            </Box>

                            {/* Post Content */}
                            {currentPost.content && (
                                <Typography sx={{ mb: 2, fontSize: '15px', lineHeight: 1.5, whiteSpace: 'pre-wrap', color: 'text.primary' }}>
                                    <HashtagContent content={currentPost.content} />
                                </Typography>
                            )}

                            {/* Reactions Count */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.5,
                                        cursor: displayTotalReacts > 0 ? 'pointer' : 'default',
                                        '&:hover': displayTotalReacts > 0 ? { textDecoration: 'underline' } : {}
                                    }}
                                    onClick={() => displayTotalReacts > 0 && setReactionListOpen(true)}
                                >
                                    {currentPost.topReactions && currentPost.topReactions.length > 0 ? (
                                        <Box sx={{ display: 'flex', ml: -0.5 }}>
                                            {currentPost.topReactions.slice(0, 3).map((reaction, index) => {
                                                const reactionData = reactionEmoji[reaction.type] || { emoji: '👍', bg: '#1877f2' };
                                                return (
                                                    <Box
                                                        key={reaction.type}
                                                        sx={{
                                                            width: 22,
                                                            height: 22,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: 16,
                                                            ml: index > 0 ? -0.5 : 0,
                                                            zIndex: 3 - index,
                                                        }}
                                                    >
                                                        {reactionData.emoji}
                                                    </Box>
                                                );
                                            })}
                                        </Box>
                                    ) : displayTotalReacts > 0 ? (
                                        <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: '#1877f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <ThumbUpIcon sx={{ fontSize: 12, color: 'white' }} />
                                        </Box>
                                    ) : null}
                                    {displayTotalReacts > 0 && (
                                        <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{displayTotalReacts}</Typography>
                                    )}
                                </Box>
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
                                        {currentPost.totalComments} bình luận
                                    </Typography>
                                    <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
                                        {currentPost.totalShares} chia sẻ
                                    </Typography>
                                </Box>
                            </Box>

                            <Divider sx={{ my: 1 }} />

                            {/* Action Buttons */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-around' }}>
                                <ReactionButton
                                    post={currentPost}
                                    initialTotalReacts={currentPost.totalReacts}
                                />

                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        py: 1,
                                        px: 2,
                                        cursor: 'pointer',
                                        borderRadius: 2,
                                        flex: 1,
                                        justifyContent: 'center',
                                        '&:hover': { bgcolor: hoverBg }
                                    }}
                                >
                                    <CommentIcon sx={{ fontSize: '20px', color: 'text.secondary' }} />
                                    <Typography sx={{ fontSize: '14px', fontWeight: 600, color: 'text.secondary' }}>Bình luận</Typography>
                                </Box>

                                <Box
                                    onClick={() => setOpenShareModal(true)}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        py: 1,
                                        px: 2,
                                        cursor: 'pointer',
                                        borderRadius: 2,
                                        flex: 1,
                                        justifyContent: 'center',
                                        '&:hover': { bgcolor: hoverBg }
                                    }}
                                >
                                    <ShareIcon sx={{ fontSize: '20px', color: 'text.secondary' }} />
                                    <Typography sx={{ fontSize: '14px', fontWeight: 600, color: 'text.secondary' }}>Chia sẻ</Typography>
                                </Box>
                            </Box>
                        </Box>

                        {/* Comments Section */}
                        <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                            <Box sx={{ px: 2, py: 1, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography sx={{ fontWeight: 600, fontSize: 15 }}>Bình luận</Typography>
                                <Typography sx={{ color: 'text.secondary', fontSize: 14, cursor: 'pointer' }}>
                                    Tất cả bình luận ▼
                                </Typography>
                            </Box>

                            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                                <CommentSection
                                    postId={currentPost._id}
                                    onChangeTotalComments={() => { }}
                                />
                            </Box>
                        </Box>
                    </Box>
                )}
            </Box>

            {/* Share Modal */}
            {openShareModal && currentPost && (
                <ShareContentModal
                    handleCloseShare={() => setOpenShareModal(false)}
                    user={user}
                    sharePrivacy={sharePrivacy}
                    shareCaption={shareCaption}
                    setShareCaption={setShareCaption}
                    showEmojiPicker={showEmojiPicker}
                    setShowEmojiPicker={setShowEmojiPicker}
                    handleEmojiSelect={(emoji: { native: string }) => setShareCaption(prev => prev + emoji.native)}
                    sharingPost={currentPost}
                />
            )}

            {/* Post Options Menu */}
            <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
                PaperProps={{
                    sx: {
                        borderRadius: 2,
                        minWidth: 300,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    }
                }}
            >
                {currentPost && (
                    <PostOptionContentMenu
                        menuPost={currentPost}
                        user={user}
                        handleEditPost={() => {
                            setMenuAnchor(null);
                            toast.info('Chức năng chỉnh sửa');
                        }}
                        handleDeletePost={() => {
                            setMenuAnchor(null);
                            toast.info('Chức năng xóa');
                        }}
                        isDeleting={false}
                        onToggleComments={handleToggleComments}
                        onToggleShares={handleToggleShares}
                        onToggleReactions={handleToggleReactions}
                    />
                )}
            </Menu>

            {/* Reaction List Dialog */}
            {currentPost && (
                <ReactionListDialog
                    open={reactionListOpen}
                    onClose={() => setReactionListOpen(false)}
                    postId={currentPost._id}
                    userId={user?.id || ''}
                />
            )}
        </Box>
    );
}
