'use client';

import { useEffect, useRef, useState } from 'react';
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
    ArrowBack as BackIcon,
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

// Reaction emoji mapping
const reactionEmoji: Record<string, string> = {
    LIKE: '👍',
    LOVE: '❤️',
    HAHA: '😆',
    WOW: '😮',
    SAD: '😢',
    ANGRY: '😡',
};

export default function ReelDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuthStore();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isMuted, setIsMuted] = useState(false);

    // Share modal state
    const [openShareModal, setOpenShareModal] = useState(false);
    const [shareCaption, setShareCaption] = useState('');
    const [sharePrivacy] = useState<PostPrivacy>('PUBLIC');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Menu state
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

    const postId = params.id as string;

    // Fetch post detail
    const { data: post, isLoading } = useQuery({
        queryKey: ['post', postId],
        queryFn: () => postService.getPostById(postId),
        enabled: !!postId && !!user?.id,
    });

    // Use totalComments from post data
    const totalComments = post?.totalComments ?? 0;

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.play().catch(() => { });
            videoRef.current.muted = isMuted;
        }
    }, [isMuted]);

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
            {/* Video Area */}
            <Box sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
            }}>
                {/* Back Button */}
                <IconButton
                    onClick={() => router.back()}
                    sx={{
                        position: 'absolute',
                        top: 16,
                        left: 16,
                        bgcolor: 'rgba(255,255,255,0.15)',
                        color: 'white',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }
                    }}
                >
                    <BackIcon />
                </IconButton>

                {/* Video Container */}
                <Box sx={{
                    width: 'auto',
                    maxWidth: 500,
                    height: 'calc(100vh - 80px)',
                    position: 'relative',
                    borderRadius: 2,
                    overflow: 'hidden',
                }}>
                    <video
                        ref={videoRef}
                        src={getVideoUrl(post)}
                        loop
                        playsInline
                        autoPlay
                        onClick={() => setIsMuted(!isMuted)}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            cursor: 'pointer',
                        }}
                    />

                    {/* Mute Button */}
                    <IconButton
                        onClick={() => setIsMuted(!isMuted)}
                        sx={{
                            position: 'absolute',
                            top: 16,
                            right: 16,
                            bgcolor: 'rgba(0,0,0,0.5)',
                            color: 'white',
                            '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
                        }}
                    >
                        {isMuted ? <MuteIcon /> : <VolumeIcon />}
                    </IconButton>
                </Box>

                {/* Sidebar Actions */}
                <Box sx={{
                    position: 'absolute',
                    right: 16,
                    bottom: '20%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                }}>
                    {/* Reaction with hover popup */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <ReactionButton
                            post={post}
                            initialTotalReacts={post.totalReacts}
                            variant="reels"
                        />
                    </Box>

                    {/* Comments */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <IconButton
                            sx={{
                                bgcolor: 'rgba(255,255,255,0.15)',
                                color: 'white',
                                width: 48,
                                height: 48,
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }
                            }}
                        >
                            <CommentIcon />
                        </IconButton>
                        <Typography sx={{ color: 'white', fontSize: 13, mt: 0.5 }}>
                            {totalComments || ''}
                        </Typography>
                    </Box>

                    {/* Share */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <IconButton
                            onClick={() => setOpenShareModal(true)}
                            sx={{
                                bgcolor: 'rgba(255,255,255,0.15)',
                                color: 'white',
                                width: 48,
                                height: 48,
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }
                            }}
                        >
                            <ShareIcon />
                        </IconButton>
                        <Typography sx={{ color: 'white', fontSize: 13, mt: 0.5 }}>
                            {post.totalShares || ''}
                        </Typography>
                    </Box>

                    {/* More Options */}
                    <IconButton
                        onClick={(e) => setMenuAnchor(e.currentTarget)}
                        sx={{
                            bgcolor: 'rgba(255,255,255,0.15)',
                            color: 'white',
                            width: 48,
                            height: 48,
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }
                        }}
                    >
                        <MoreIcon />
                    </IconButton>
                </Box>
            </Box>

            {/* Comments Panel */}
            <Box sx={{
                width: 400,
                bgcolor: 'white',
                borderLeft: '1px solid #e4e6eb',
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
            }}>
                {/* Post Info Header */}
                <Box sx={{ p: 2, borderBottom: '1px solid #e4e6eb' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Avatar
                            src={post.userId?.avatar || ''}
                            sx={{ width: 40, height: 40, cursor: 'pointer' }}
                            onClick={handleProfileClick}
                        />
                        <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography
                                    sx={{
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        '&:hover': { textDecoration: 'underline' }
                                    }}
                                    onClick={handleProfileClick}
                                >
                                    {getAuthorName(post)}
                                </Typography>
                                <Typography sx={{ color: '#65676b', fontSize: 12 }}>·</Typography>
                                <Button
                                    size="small"
                                    sx={{
                                        textTransform: 'none',
                                        p: 0,
                                        minWidth: 'auto',
                                        fontWeight: 600,
                                        color: '#1877f2'
                                    }}
                                >
                                    Theo dõi
                                </Button>
                            </Box>
                            <Typography sx={{ color: '#65676b', fontSize: 12 }}>
                                {formatPostTime(post.createdAt)}
                            </Typography>
                        </Box>
                    </Box>

                    {/* Content */}
                    {post.content && (
                        <Typography sx={{ fontSize: 14, mb: 2 }}>
                            {post.content}
                        </Typography>
                    )}

                    {/* Reactions Summary */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {post.topReactions && post.topReactions.length > 0 ? (
                                <Box sx={{ display: 'flex' }}>
                                    {post.topReactions.slice(0, 3).map((reaction, index) => (
                                        <Box
                                            key={reaction.type}
                                            sx={{
                                                fontSize: 18,
                                                ml: index > 0 ? -0.5 : 0,
                                                zIndex: 3 - index,
                                            }}
                                        >
                                            {reactionEmoji[reaction.type] || '👍'}
                                        </Box>
                                    ))}
                                </Box>
                            ) : null}
                            {(post.totalReacts ?? 0) > 0 && (
                                <Typography sx={{ fontSize: 14, color: '#65676b', ml: 0.5 }}>
                                    {post.totalReacts}
                                </Typography>
                            )}
                        </Box>
                        <Typography sx={{ fontSize: 14, color: '#65676b' }}>
                            {totalComments} bình luận
                        </Typography>
                    </Box>

                    <Divider sx={{ my: 1 }} />

                    {/* Action Buttons */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-around' }}>
                        <ReactionButton post={post} initialTotalReacts={post.totalReacts} />
                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            py: 1,
                            px: 2,
                            borderRadius: 2,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: '#f0f2f5' }
                        }}>
                            <CommentIcon sx={{ fontSize: 20, color: '#65676b' }} />
                            <Typography sx={{ color: '#65676b', fontWeight: 600, fontSize: 15 }}>Bình luận</Typography>
                        </Box>
                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            py: 1,
                            px: 2,
                            borderRadius: 2,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: '#f0f2f5' }
                        }}
                            onClick={() => setOpenShareModal(true)}
                        >
                            <ShareIcon sx={{ fontSize: 20, color: '#65676b' }} />
                            <Typography sx={{ color: '#65676b', fontWeight: 600, fontSize: 15 }}>Chia sẻ</Typography>
                        </Box>
                    </Box>
                </Box>

                {/* Comments Header */}
                <Box sx={{ px: 2, py: 1, borderBottom: '1px solid #e4e6eb' }}>
                    <Typography sx={{ color: '#65676b', fontSize: 14 }}>
                        Tất cả bình luận ▼
                    </Typography>
                </Box>

                {/* Comments List */}
                <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                    <CommentSection
                        postId={post._id}
                        onChangeTotalComments={() => { }}
                    />
                </Box>
            </Box>

            {/* Share Modal */}
            {openShareModal && (
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
            </Menu>
        </Box>
    );
}
