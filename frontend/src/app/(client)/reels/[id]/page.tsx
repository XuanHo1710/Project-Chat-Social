'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Box,
    Typography,
    Avatar,
    IconButton,
    CircularProgress,
    Button,
    Divider,
    Menu,
} from '@mui/material';
import {
    ChatBubbleOutline as CommentIcon,
    Share as ShareIcon,
    MoreHoriz as MoreIcon,
    VolumeUp as VolumeIcon,
    VolumeOff as MuteIcon,
    ThumbUp as ThumbUpIcon,
    PlayArrow as PlayIcon,
    Pause as PauseIcon,
    Close as CloseIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { postService } from '@/services/post.service';
import { useAuthStore } from '@/stores/useAuthStore';
import { formatPostTime, getAuthorName } from '@/utils/formatPost';
import { CLIENT_PATH } from '@/constants/paths';
import ReactionButton from '@/components/posts/ReactionButton';
import CommentSection from '@/components/posts/CommentSection';
import ShareContentModal from '@/components/posts/ShareContentModal';
import PostOptionContentMenu from '@/components/posts/PostOptionContentMenu';
import { PostType, PostPrivacy } from '@/types/post';
import { toast } from 'sonner';
import { useReactionStore } from '@/stores/useReactionStore';
import HashtagContent from '@/utils/hashtagParser';
import ReactionListDialog from '@/components/posts/ReactionListDialog';
import Header from '@/components/home/Header';

// Reaction emoji mapping
const reactionEmoji: Record<string, { emoji: string; bg: string }> = {
    LIKE: { emoji: '👍', bg: '#1877f2' },
    LOVE: { emoji: '❤️', bg: '#f33e58' },
    HAHA: { emoji: '😆', bg: '#f7b125' },
    WOW: { emoji: '😮', bg: '#f7b125' },
    SAD: { emoji: '😢', bg: '#f7b125' },
    ANGRY: { emoji: '😡', bg: '#e9710f' },
};

export default function ReelDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuthStore();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [showComments, setShowComments] = useState(false);


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

    const postId = params.id as string;

    // Fetch post detail
    const { data: post, isLoading } = useQuery({
        queryKey: ['post', postId],
        queryFn: () => postService.getPostById(postId),
        enabled: !!postId && !!user?.id,
    });

    // Use totalComments from post data
    const totalComments = post?.totalComments ?? 0;

    // Get reaction state from store
    const reactionState = post ? postReactions[post._id] : null;
    const displayTotalReacts = reactionState?.totalReacts ?? post?.totalReacts ?? 0;

    useEffect(() => {
        if (post) {
            initPostReaction(post._id, post.totalReacts);
        }
    }, [post, initPostReaction]);


    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.play().catch(() => { });
            videoRef.current.muted = isMuted;
        }
    }, [isMuted]);

    // Toggle play/pause
    const togglePlayPause = useCallback(() => {
        const currentVideo = videoRef.current;
        if (currentVideo) {
            if (isPaused) {
                currentVideo.play().catch(() => { });
            } else {
                currentVideo.pause();
            }
            setIsPaused(!isPaused);
        }
    }, [isPaused]);




    const handleProfileClick = () => {
        if (post?.userId?.username) {
            router.push(CLIENT_PATH.PROFILE_BY_USERNAME(post.userId.username));
        }
    };

    const getVideoUrl = (p: PostType) => {
        const videoMedia = p.media?.find(m => m.mediaType === 'VIDEO');
        return videoMedia?.url || '';
    };

    // Handle post settings toggle
    const handleToggleComments = async (allow: boolean) => {
        if (!post) return;
        try {
            await postService.updatePost(post._id, { allowComments: allow });
            toast.success(allow ? 'Đã bật bình luận' : 'Đã tắt bình luận');
        } catch {
            toast.error('Có lỗi xảy ra');
        }
    };

    const handleToggleShares = async (allow: boolean) => {
        if (!post) return;
        try {
            await postService.updatePost(post._id, { allowShares: allow });
            toast.success(allow ? 'Đã bật chia sẻ' : 'Đã tắt chia sẻ');
        } catch {
            toast.error('Có lỗi xảy ra');
        }
    };

    const handleToggleReactions = async (allow: boolean) => {
        if (!post) return;
        try {
            await postService.updatePost(post._id, { allowReactions: allow });
            toast.success(allow ? 'Đã bật cảm xúc' : 'Đã tắt cảm xúc');
        } catch {
            toast.error('Có lỗi xảy ra');
        }
    };

    if (isLoading) {
        return (
            <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#000' }}>
                <CircularProgress sx={{ color: 'white' }} />
            </Box>
        );
    }

    if (!post) {
        return (
            <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#000' }}>
                <Typography sx={{ color: 'white' }}>Không tìm thấy video</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{
            height: '100vh',
            width: '100%',
            bgcolor: '#000',
            display: 'flex',
            overflow: 'hidden',
        }}>
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
                }}>
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

                        <Box
                            key={post._id}
                            sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: '#000',
                            }}
                        >
                            <video
                                ref={el => { videoRef.current = el; }}
                                src={getVideoUrl(post)}
                                loop
                                playsInline
                                muted={isMuted}
                                autoPlay={!isPaused}
                                onClick={togglePlayPause}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    cursor: 'pointer',
                                }}
                            />

                            {/* Pause overlay */}
                            {isPaused && (
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
                        {post && (
                            <Box sx={{
                                position: 'absolute',
                                bottom: 80,
                                left: 16,
                                right: 80,
                                zIndex: 5,
                            }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                                    <Avatar
                                        src={post.userId?.avatar || ''}
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
                                                {getAuthorName(post)}
                                            </Typography>
                                            <Typography sx={{ color: 'rgba(255,255,255,0.95)', fontSize: 14, fontWeight: 500, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                                                · Theo dõi
                                            </Typography>
                                        </Box>
                                        <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                                            {formatPostTime(post.createdAt)}
                                        </Typography>
                                    </Box>
                                </Box>
                                {post.content && (
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
                                        {post.content}
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
                        {post && (
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
                                        post={post}
                                        initialTotalReacts={post.totalReacts}
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
                                        {post.totalComments || 0}
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
                                        {post.totalShares || 0}
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
                </Box>

                {/* Right Panel - Comments (chỉ hiện khi bấm nút comment) */}
                {showComments && post && (
                    <Box sx={{
                        width: 420,
                        minWidth: 420,
                        maxWidth: 420,
                        bgcolor: 'background.paper',
                        display: 'flex',
                        flexDirection: 'column',
                        height: 'calc(100vh - 56px)',
                        borderLeft: 1,
                        borderColor: 'divider',
                        flexShrink: 0,
                    }}>
                        {/* Post Header */}
                        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                                <Avatar
                                    src={post.userId?.avatar || ''}
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
                                        {getAuthorName(post)}
                                    </Typography>
                                    <Typography sx={{ fontSize: '13px', color: 'text.secondary' }}>
                                        {formatPostTime(post.createdAt)}
                                    </Typography>
                                </Box>
                                <IconButton onClick={() => setShowComments(false)} sx={{ mt: -0.5 }}>
                                    <CloseIcon />
                                </IconButton>
                            </Box>

                            {/* Post Content */}
                            {post.content && (
                                <Typography sx={{ mb: 2, fontSize: '15px', lineHeight: 1.5, whiteSpace: 'pre-wrap', color: 'text.primary' }}>
                                    <HashtagContent content={post.content} />
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
                                    {post.topReactions && post.topReactions.length > 0 ? (
                                        <Box sx={{ display: 'flex', ml: -0.5 }}>
                                            {post.topReactions.slice(0, 3).map((reaction, index) => {
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
                                        {post.totalComments} bình luận
                                    </Typography>
                                    <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
                                        {post.totalShares} chia sẻ
                                    </Typography>
                                </Box>
                            </Box>

                            <Divider sx={{ my: 1 }} />

                            {/* Action Buttons */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-around' }}>
                                <ReactionButton
                                    post={post}
                                    initialTotalReacts={post.totalReacts}
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
                                        '&:hover': { bgcolor: 'action.hover' }
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
                                        '&:hover': { bgcolor: 'action.hover' }
                                    }}
                                >
                                    <ShareIcon sx={{ fontSize: '20px', color: 'text.secondary' }} />
                                    <Typography sx={{ fontSize: '14px', fontWeight: 600, color: 'text.secondary' }}>Chia sẻ</Typography>
                                </Box>
                            </Box>
                        </Box>

                        {/* Comments Section */}
                        <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                            <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography sx={{ fontWeight: 600, fontSize: 15 }}>Bình luận</Typography>
                                <Typography sx={{ color: 'text.secondary', fontSize: 14, cursor: 'pointer' }}>
                                    Tất cả bình luận ▼
                                </Typography>
                            </Box>

                            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                                <CommentSection
                                    postId={post._id}
                                    onChangeTotalComments={() => { }}
                                />
                            </Box>
                        </Box>
                    </Box>
                )}
            </Box>

            {/* Share Modal */}
            {openShareModal && post && (
                <ShareContentModal
                    handleCloseShare={() => setOpenShareModal(false)}
                    user={user}
                    sharePrivacy={sharePrivacy}
                    shareCaption={shareCaption}
                    setShareCaption={setShareCaption}
                    showEmojiPicker={showEmojiPicker}
                    setShowEmojiPicker={setShowEmojiPicker}
                    handleEmojiSelect={(emoji: { native: string }) => setShareCaption(prev => prev + emoji.native)}
                    sharingPost={post}
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
                {post && (
                    <PostOptionContentMenu
                        menuPost={post}
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
            {post && (
                <ReactionListDialog
                    open={reactionListOpen}
                    onClose={() => setReactionListOpen(false)}
                    postId={post._id}
                    userId={user?.id || ''}
                />
            )}
        </Box>
    );
}
