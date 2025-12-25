'use client';

import {
    Box, Card, CardContent, Avatar, Typography, IconButton, Divider,
    Modal, Button, Menu, MenuItem, ListItemIcon, InputBase, Fade, Skeleton
} from '@mui/material';
import {
    VideoCall as VideoIcon,
    PhotoLibrary as PhotoIcon,
    Mood as MoodIcon,
    MoreHoriz as MoreIcon,
    ThumbUp as ThumbUpIcon,
    ThumbUpOutlined as ThumbUpOutlinedIcon,
    ChatBubbleOutline as CommentIcon,
    Share as ShareIcon,
    Public as PublicIcon,
    Add as AddIcon,
    ArrowForward as ArrowForwardIcon,
    ArrowBack as ArrowBackIcon,
    Close as CloseIcon,
    Lock as LockIcon,
    KeyboardArrowDown as ArrowDownIcon,
    Gif as GifIcon,
    SentimentSatisfiedAlt as EmojiIcon,
    Favorite as FavoriteIcon,
    RemoveCircleOutline as RemoveIcon,
    BookmarkBorder as BookmarkBorderIcon,
    NotificationsActive as NotificationIcon,
    Info as InfoIcon,
    Report as ReportIcon,
    Block as BlockIcon,
    VisibilityOff as HideIcon,
    Send as SendIcon,
    People as PeopleIcon,
    Link as LinkIcon,
    Groups as GroupsIcon,
    Person as PersonIcon,
    WhatsApp as WhatsAppIcon,
    Message as MessageIcon,
    PlayArrow as PlayIcon,
    Edit as EditIcon,
} from '@mui/icons-material';
import { useAuthStore } from '@/stores/useAuthStore';
import { useState, useRef, useMemo } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useGetNewsFeed, useDeletePost } from '@/queries/usePostQueries';
import { PostType, PostPrivacy, MediaItem } from '@/types/post';
import CreatePostModal from './CreatePostModal';
import EditPostModal from './EditPostModal';
import ImageViewer from './ImageViewer';
import { DeleteMediaFiles } from '@/utils/uploadImage';
import { timeAgo } from '@/utils/formatDate';

// Reactions data
const reactions = [
    { id: 'like', emoji: '👍', label: 'Thích', color: '#1877f2' },
    { id: 'love', emoji: '❤️', label: 'Yêu thích', color: '#f33e58' },
    { id: 'care', emoji: '🥰', label: 'Thương thương', color: '#f7b125' },
    { id: 'haha', emoji: '😆', label: 'Haha', color: '#f7b125' },
    { id: 'wow', emoji: '😮', label: 'Wow', color: '#f7b125' },
    { id: 'sad', emoji: '😢', label: 'Buồn', color: '#f7b125' },
    { id: 'angry', emoji: '😡', label: 'Phẫn nộ', color: '#e9710f' },
];

// Privacy options
const privacyOptions = [
    { id: 'PUBLIC' as PostPrivacy, icon: PublicIcon, label: 'Công khai', description: 'Bất kỳ ai ở trên hoặc ngoài Facebook' },
    { id: 'FRIEND' as PostPrivacy, icon: PeopleIcon, label: 'Bạn bè', description: 'Bạn bè của bạn trên Facebook' },
    { id: 'PRIVATE' as PostPrivacy, icon: LockIcon, label: 'Chỉ mình tôi', description: 'Chỉ mình bạn' },
];

const stories = [
    { name: 'Tạo tin', isCreate: true },
    { name: 'Đức Khoa Quach', avatar: '/avatar1.jpg' },
    { name: '28Tech', avatar: '/avatar2.jpg' },
    { name: 'Anime - My Heart', avatar: '/avatar3.jpg' },
    { name: 'Trường Đại học Khoa học...', avatar: '/avatar4.jpg' },
    { name: 'VTV24', avatar: '/avatar5.jpg' },
    { name: 'F8 - Học Lập Trình', avatar: '/avatar6.jpg' },
];


const mockComments = [
    { id: 1, author: 'TD88', avatar: '', content: 'Mùi thơm nam tính khỏi chê', time: '1 tuần', likes: 45, isVerified: true },
    { id: 2, author: 'F88 100 Bà Triều', avatar: '', content: 'Sản phẩm tuyệt vời!', time: '3 ngày', likes: 12 },
];

// Mock friends for share modal
const mockFriends = [
    { id: 1, name: 'Huy Nguyen', avatar: '', isOnline: false },
    { id: 2, name: 'Mạnh Cường', avatar: '', isOnline: false },
    { id: 3, name: 'Hồ Minh Quân', avatar: '', isOnline: true },
    { id: 4, name: 'Trường Nguyễn', avatar: '', isOnline: false },
    { id: 5, name: 'Jupiter Nguyễn', avatar: '', isOnline: true },
];

// Share options
const shareOptions = [
    { id: 'messenger', icon: MessageIcon, label: 'Messenger', color: '#0084ff' },
    { id: 'whatsapp', icon: WhatsAppIcon, label: 'WhatsApp', color: '#25d366' },
    { id: 'copy', icon: LinkIcon, label: 'Sao chép liên kết', color: '#65676b' },
    { id: 'groups', icon: GroupsIcon, label: 'Nhóm', color: '#65676b' },
    { id: 'profile', icon: PersonIcon, label: 'Trang cá nhân của bạn bè', color: '#65676b' },
];

// Helper function to format time
const formatPostTime = (dateString: string) => {
    try {
        return timeAgo(dateString);
    } catch {
        return 'vài giây';
    }
};

// Helper to get privacy icon
const getPrivacyIcon = (privacy: PostPrivacy) => {
    switch (privacy) {
        case 'PUBLIC': return PublicIcon;
        case 'FRIEND': return PeopleIcon;
        case 'PRIVATE': return LockIcon;
        default: return PublicIcon;
    }
};

// Helper to get author display name
const getAuthorName = (post: PostType) => {
    if (post.userId?.firstName && post.userId?.lastName) {
        return `${post.userId.firstName} ${post.userId.lastName}`;
    }
    return post.userId?.username || 'Người dùng';
};

export default function Feed() {
    const { user } = useAuthStore();
    const storiesRef = useRef<HTMLDivElement>(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(true);

    // Fetch posts from API
    const { data: postsData, isLoading: isLoadingPosts } = useGetNewsFeed({ page: 1, limit: 20 });
    const deletePostMutation = useDeletePost();

    // Local state for reactions (until we implement reaction API)
    const [localReactions, setLocalReactions] = useState<Record<string, string | null>>({});

    // Create Post Modal
    const [openCreatePost, setOpenCreatePost] = useState(false);

    // Edit Post Modal
    const [openEditPost, setOpenEditPost] = useState(false);
    const [editingPost, setEditingPost] = useState<PostType | null>(null);

    // Image Viewer
    const [openImageViewer, setOpenImageViewer] = useState(false);
    const [viewerMedia, setViewerMedia] = useState<MediaItem[]>([]);
    const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

    // Post Options Menu
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [menuPost, setMenuPost] = useState<PostType | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Comment Modal
    const [openCommentModal, setOpenCommentModal] = useState(false);
    const [commentingPost, setCommentingPost] = useState<PostType | null>(null);
    const [commentText, setCommentText] = useState('');

    // Reaction hover
    const [hoveredPostId, setHoveredPostId] = useState<string | null>(null);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Share Modal
    const [openShareModal, setOpenShareModal] = useState(false);
    const [sharingPost, setSharingPost] = useState<PostType | null>(null);
    const [shareCaption, setShareCaption] = useState('');
    const [sharePrivacy, setSharePrivacy] = useState<PostPrivacy>('PUBLIC');

    // Emoji Picker
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Get posts from API data
    const posts = useMemo(() => postsData?.data || [], [postsData]);

    const scrollStories = (direction: 'left' | 'right') => {
        if (storiesRef.current) {
            const scrollAmount = 300;
            const newScrollLeft = direction === 'left'
                ? storiesRef.current.scrollLeft - scrollAmount
                : storiesRef.current.scrollLeft + scrollAmount;
            storiesRef.current.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
            setTimeout(() => {
                if (storiesRef.current) {
                    setShowLeftArrow(storiesRef.current.scrollLeft > 0);
                    setShowRightArrow(storiesRef.current.scrollLeft < storiesRef.current.scrollWidth - storiesRef.current.clientWidth - 10);
                }
            }, 300);
        }
    };

    const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, post: PostType) => {
        setMenuAnchor(event.currentTarget);
        setMenuPost(post);
    };

    const handleCloseMenu = () => {
        setMenuAnchor(null);
        setMenuPost(null);
    };

    // Delete post with media cleanup
    const handleDeletePost = async () => {
        if (!menuPost) return;

        setIsDeleting(true);
        try {
            // 1. Delete media from Cloudinary first
            if (menuPost.media && menuPost.media.length > 0) {
                const mediaItems = menuPost.media
                    .filter(m => m.publicId)
                    .map(m => ({
                        publicId: m.publicId,
                        mediaType: m.mediaType
                    }));
                if (mediaItems.length > 0) {
                    await DeleteMediaFiles(mediaItems);
                }
            }

            // 2. Delete post from backend
            await deletePostMutation.mutateAsync(menuPost._id);
            handleCloseMenu();
        } catch (error) {
            console.error('Error deleting post:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    // Edit post
    const handleEditPost = () => {
        if (menuPost) {
            setEditingPost(menuPost);
            setOpenEditPost(true);
            handleCloseMenu();
        }
    };

    // Open image viewer
    const handleOpenImageViewer = (media: MediaItem[], index: number) => {
        setViewerMedia(media);
        setViewerInitialIndex(index);
        setOpenImageViewer(true);
    };

    const handleOpenComments = (post: PostType) => {
        setCommentingPost(post);
        setOpenCommentModal(true);
    };

    const handleReaction = (postId: string, reactionId: string) => {
        setLocalReactions(prev => {
            const currentReaction = prev[postId];
            const isSameReaction = currentReaction === reactionId;
            return {
                ...prev,
                [postId]: isSameReaction ? null : reactionId
            };
        });
        setHoveredPostId(null);
    };

    const handleLikeHover = (postId: string) => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => setHoveredPostId(postId), 500);
    };

    const handleLikeLeave = () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => setHoveredPostId(null), 500);
    };

    const handleCloseCreatePost = () => {
        setOpenCreatePost(false);
    };

    const getReactionDisplay = (reactionId: string | null) => {
        if (!reactionId) return null;
        return reactions.find(r => r.id === reactionId);
    };

    const handleOpenShare = (post: PostType) => {
        setSharingPost(post);
        setOpenShareModal(true);
    };

    const handleCloseShare = () => {
        setOpenShareModal(false);
        setSharingPost(null);
        setShareCaption('');
    };

    const handleEmojiSelect = (emoji: { native: string }) => {
        setShareCaption(prev => prev + emoji.native);
    };

    const getSharePrivacyLabel = () => privacyOptions.find(p => p.id === sharePrivacy)?.label || 'Công khai';

    // Render media grid for post
    const renderPostMedia = (post: PostType) => {
        if (!post.media || post.media.length === 0) return null;

        const mediaCount = post.media.length;

        if (mediaCount === 1) {
            const media = post.media[0];
            return (
                <Box sx={{ mb: 2, position: 'relative' }}>
                    {media.mediaType === 'VIDEO' ? (
                        <Box sx={{ position: 'relative' }} onClick={() => handleOpenImageViewer(post.media, 0)}>
                            <video
                                src={media.url}
                                controls
                                style={{ width: '100%', maxHeight: 500, objectFit: 'cover', borderRadius: 4 }}
                            />
                        </Box>
                    ) : (
                        <Box
                            component="img"
                            src={media.url}
                            alt="Post media"
                            onClick={() => handleOpenImageViewer(post.media, 0)}
                            sx={{ width: '100%', maxHeight: 500, objectFit: 'cover', borderRadius: 1, cursor: 'pointer' }}
                        />
                    )}
                </Box>
            );
        }

        // Multiple media - grid layout
        return (
            <Box sx={{ mb: 2, display: 'grid', gridTemplateColumns: mediaCount === 2 ? '1fr 1fr' : 'repeat(2, 1fr)', gap: 0.5, borderRadius: 1, overflow: 'hidden' }}>
                {post.media.slice(0, 4).map((media, index) => (
                    <Box
                        key={index}
                        onClick={() => handleOpenImageViewer(post.media, index)}
                        sx={{
                            position: 'relative',
                            height: mediaCount === 2 ? 300 : 200,
                            gridColumn: mediaCount === 3 && index === 0 ? 'span 2' : 'span 1',
                            cursor: 'pointer',
                        }}
                    >
                        {media.mediaType === 'VIDEO' ? (
                            <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
                                <video
                                    src={media.url}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', bgcolor: 'rgba(0,0,0,0.6)', borderRadius: '50%', p: 1 }}>
                                    <PlayIcon sx={{ color: 'white', fontSize: 32 }} />
                                </Box>
                            </Box>
                        ) : (
                            <Box
                                component="img"
                                src={media.url}
                                alt={`Media ${index + 1}`}
                                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        )}
                        {index === 3 && mediaCount > 4 && (
                            <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Typography sx={{ color: 'white', fontSize: 32, fontWeight: 700 }}>+{mediaCount - 4}</Typography>
                            </Box>
                        )}
                    </Box>
                ))}
            </Box>
        );
    };

    return (
        <Box sx={{ maxWidth: 680, mx: 'auto', py: 2, px: { xs: 1, sm: 2 } }}>
            {/* Stories Section */}
            <Card sx={{ mb: 2, borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.1)', position: 'relative' }}>
                <Box sx={{ position: 'relative' }}>
                    <Box ref={storiesRef} sx={{ p: 2, display: 'flex', gap: 1, overflowX: 'hidden', scrollBehavior: 'smooth', '&::-webkit-scrollbar': { display: 'none' } }}>
                        {stories.map((story, index) => (
                            <Box key={index} sx={{
                                minWidth: 110, height: 190, borderRadius: 2, overflow: 'hidden', position: 'relative', cursor: 'pointer',
                                border: story.isCreate ? '1px solid #e4e6eb' : 'none',
                                bgcolor: story.isCreate ? 'white' : '#1877f2',
                                backgroundImage: story.isCreate ? 'none' : 'linear-gradient(135deg, #1877f2 0%, #1a2a6c 100%)',
                                '&:hover': { opacity: 0.9 },
                            }}>
                                {story.isCreate ? (
                                    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                        <Box sx={{ flex: 1, bgcolor: '#f0f2f5', position: 'relative' }}>
                                            <Avatar sx={{ width: '100%', height: '100%', borderRadius: 0 }} src={user?.avatar} />
                                        </Box>
                                        <Box sx={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', bgcolor: '#1877f2', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid white' }}>
                                            <AddIcon sx={{ color: 'white', fontSize: 20 }} />
                                        </Box>
                                        <Typography sx={{ fontSize: '13px', fontWeight: 600, textAlign: 'center', py: 1, color: '#050505' }}>Tạo tin</Typography>
                                    </Box>
                                ) : (
                                    <>
                                        <Avatar sx={{ width: 40, height: 40, position: 'absolute', top: 12, left: 12, border: '4px solid #1877f2' }} />
                                        <Typography sx={{ position: 'absolute', bottom: 12, left: 12, right: 12, color: 'white', fontSize: '13px', fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{story.name}</Typography>
                                    </>
                                )}
                            </Box>
                        ))}
                    </Box>
                    {showLeftArrow && (
                        <IconButton onClick={() => scrollStories('left')} sx={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', bgcolor: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', width: 48, height: 48, zIndex: 1, '&:hover': { bgcolor: '#f0f2f5' } }}>
                            <ArrowBackIcon />
                        </IconButton>
                    )}
                    {showRightArrow && (
                        <IconButton onClick={() => scrollStories('right')} sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', bgcolor: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', width: 48, height: 48, zIndex: 1, '&:hover': { bgcolor: '#f0f2f5' } }}>
                            <ArrowForwardIcon />
                        </IconButton>
                    )}
                </Box>
            </Card>

            {/* Create Post */}
            <Card sx={{ mb: 2, borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <Avatar sx={{ width: 40, height: 40 }} src={user?.avatar} />
                        <Box onClick={() => setOpenCreatePost(true)} sx={{ flex: 1, bgcolor: '#f0f2f5', borderRadius: '50px', display: 'flex', alignItems: 'center', px: 2, py: 1.5, cursor: 'pointer', '&:hover': { bgcolor: '#e4e6eb' } }}>
                            <Typography sx={{ color: '#65676b', fontSize: 17 }}>{user?.fullName || user?.username || 'Bạn'} ơi, bạn đang nghĩ gì thế?</Typography>
                        </Box>
                    </Box>
                    <Divider sx={{ mb: 1 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-around' }}>
                        <Box onClick={() => setOpenCreatePost(true)} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 2, cursor: 'pointer', borderRadius: 2, '&:hover': { bgcolor: '#f0f2f5' } }}>
                            <VideoIcon sx={{ color: '#f3425f' }} />
                            <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#65676b' }}>Video trực tiếp</Typography>
                        </Box>
                        <Box onClick={() => setOpenCreatePost(true)} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 2, cursor: 'pointer', borderRadius: 2, '&:hover': { bgcolor: '#f0f2f5' } }}>
                            <PhotoIcon sx={{ color: '#45bd62' }} />
                            <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#65676b' }}>Ảnh/video</Typography>
                        </Box>
                        <Box onClick={() => setOpenCreatePost(true)} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 2, cursor: 'pointer', borderRadius: 2, '&:hover': { bgcolor: '#f0f2f5' } }}>
                            <MoodIcon sx={{ color: '#f7b928' }} />
                            <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#65676b' }}>Cảm xúc</Typography>
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            {/* Loading State */}
            {isLoadingPosts && (
                <Card sx={{ mb: 2, borderRadius: 2, p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Skeleton variant="circular" width={40} height={40} />
                        <Box sx={{ flex: 1 }}>
                            <Skeleton variant="text" width="60%" />
                            <Skeleton variant="text" width="30%" />
                        </Box>
                    </Box>
                    <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
                </Card>
            )}

            {/* Empty State */}
            {!isLoadingPosts && posts.length === 0 && (
                <Card sx={{ mb: 2, borderRadius: 2, p: 4, textAlign: 'center' }}>
                    <Typography sx={{ color: '#65676b', fontSize: 16 }}>
                        Chưa có bài viết nào. Hãy đăng bài viết đầu tiên của bạn!
                    </Typography>
                </Card>
            )}

            {/* Posts */}
            {posts.map((post) => {
                const PrivacyIconComponent = getPrivacyIcon(post.privacy);
                const currentReaction = localReactions[post._id];

                return (
                    <Card key={post._id} sx={{ mb: 2, borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                        <CardContent sx={{ p: 2 }}>
                            {/* Post Header */}
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <Avatar sx={{ width: 40, height: 40, mr: 1.5 }} src={post.userId?.avatar} />
                                <Box sx={{ flex: 1 }}>
                                    <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#050505' }}>{getAuthorName(post)}</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Typography sx={{ fontSize: '13px', color: '#65676b' }}>{formatPostTime(post.createdAt)}</Typography>
                                        <Typography sx={{ fontSize: '13px', color: '#65676b' }}> · </Typography>
                                        <PrivacyIconComponent sx={{ fontSize: '12px', color: '#65676b' }} />
                                    </Box>
                                </Box>
                                <IconButton onClick={(e) => handleOpenMenu(e, post)}><MoreIcon /></IconButton>
                                <IconButton><CloseIcon /></IconButton>
                            </Box>

                            {/* Post Content */}
                            {post.background ? (
                                <Box sx={{ background: post.background, borderRadius: 2, p: 4, minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                                    <Typography sx={{ fontSize: 24, fontWeight: 700, color: 'white', textAlign: 'center' }}>{post.content}</Typography>
                                </Box>
                            ) : (
                                <Typography sx={{ mb: 2, fontSize: '15px', lineHeight: 1.5, whiteSpace: 'pre-wrap', color: '#050505' }}>{post.content}</Typography>
                            )}

                            {/* Render media */}
                            {renderPostMedia(post)}

                            {/* Like/Comment Count */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: '#1877f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <ThumbUpIcon sx={{ fontSize: 12, color: 'white' }} />
                                    </Box>
                                    <Typography sx={{ fontSize: 15, color: '#65676b' }}>{post.totalReacts}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <Typography sx={{ fontSize: 15, color: '#65676b', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }} onClick={() => handleOpenComments(post)}>{post.totalComments} bình luận</Typography>
                                    <Typography sx={{ fontSize: 15, color: '#65676b' }}>{post.totalShares} lượt chia sẻ</Typography>
                                </Box>
                            </Box>

                            <Divider sx={{ my: 1 }} />

                            {/* Post Actions with Reaction Picker */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-around', position: 'relative' }}>
                                {/* Like Button with Reactions */}
                                <Box
                                    sx={{ position: 'relative', flex: 1 }}
                                    onMouseEnter={() => handleLikeHover(post._id)}
                                    onMouseLeave={handleLikeLeave}
                                >
                                    {/* Reaction Picker Popup */}
                                    <Fade in={hoveredPostId === post._id}>
                                        <Box
                                            sx={{
                                                position: 'absolute',
                                                bottom: '100%',
                                                left: 0,
                                                mb: 1,
                                                bgcolor: 'white',
                                                borderRadius: '50px',
                                                boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                                                display: 'flex',
                                                gap: 0.5,
                                                p: 0.5,
                                                zIndex: 10,
                                            }}
                                            onMouseEnter={() => setHoveredPostId(post._id)}
                                            onMouseLeave={handleLikeLeave}
                                        >
                                            {reactions.map((reaction) => (
                                                <Box
                                                    key={reaction.id}
                                                    onClick={() => handleReaction(post._id, reaction.id)}
                                                    sx={{
                                                        fontSize: 32,
                                                        cursor: 'pointer',
                                                        transition: 'transform 0.2s',
                                                        p: 0.5,
                                                        '&:hover': {
                                                            transform: 'scale(1.3) translateY(-5px)',
                                                        },
                                                    }}
                                                    title={reaction.label}
                                                >
                                                    {reaction.emoji}
                                                </Box>
                                            ))}
                                        </Box>
                                    </Fade>

                                    <Box
                                        onClick={() => handleReaction(post._id, 'like')}
                                        sx={{
                                            display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 2,
                                            cursor: 'pointer', borderRadius: 2, justifyContent: 'center',
                                            '&:hover': { bgcolor: '#f0f2f5' },
                                        }}
                                    >
                                        {currentReaction ? (
                                            <>
                                                <Typography sx={{ fontSize: 20 }}>{getReactionDisplay(currentReaction)?.emoji}</Typography>
                                                <Typography sx={{ fontSize: '15px', fontWeight: 600, color: getReactionDisplay(currentReaction)?.color }}>
                                                    {getReactionDisplay(currentReaction)?.label}
                                                </Typography>
                                            </>
                                        ) : (
                                            <>
                                                <ThumbUpOutlinedIcon sx={{ fontSize: '20px', color: '#65676b' }} />
                                                <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#65676b' }}>Thích</Typography>
                                            </>
                                        )}
                                    </Box>
                                </Box>

                                <Box onClick={() => handleOpenComments(post)} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 2, cursor: 'pointer', borderRadius: 2, flex: 1, justifyContent: 'center', '&:hover': { bgcolor: '#f0f2f5' } }}>
                                    <CommentIcon sx={{ fontSize: '20px', color: '#65676b' }} />
                                    <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#65676b' }}>Bình luận</Typography>
                                </Box>

                                <Box onClick={() => handleOpenShare(post)} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 2, cursor: 'pointer', borderRadius: 2, flex: 1, justifyContent: 'center', '&:hover': { bgcolor: '#f0f2f5' } }}>
                                    <ShareIcon sx={{ fontSize: '20px', color: '#65676b' }} />
                                    <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#65676b' }}>Chia sẻ</Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                );
            })}

            {/* Create Post Modal */}
            <CreatePostModal open={openCreatePost} onClose={handleCloseCreatePost} />

            {/* Edit Post Modal */}
            {editingPost && (
                <EditPostModal
                    open={openEditPost}
                    onClose={() => {
                        setOpenEditPost(false);
                        setEditingPost(null);
                    }}
                    post={editingPost}
                />
            )}

            {/* Image Viewer */}
            <ImageViewer
                open={openImageViewer}
                onClose={() => setOpenImageViewer(false)}
                media={viewerMedia}
                initialIndex={viewerInitialIndex}
            />

            {/* Post Options Menu */}
            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleCloseMenu} PaperProps={{ sx: { width: 320, borderRadius: 2, boxShadow: '0 2px 12px rgba(0,0,0,0.15)', mt: 1 } }}>
                {/* Owner actions - Edit & Delete */}
                {menuPost && user?.id === menuPost.userId?._id ? (
                    <>
                        <MenuItem onClick={handleEditPost} sx={{ py: 1.5 }}>
                            <ListItemIcon><EditIcon /></ListItemIcon>
                            <Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>Chỉnh sửa bài viết</Typography></Box>
                        </MenuItem>
                        <MenuItem onClick={handleDeletePost} disabled={isDeleting} sx={{ py: 1.5 }}>
                            <ListItemIcon><CloseIcon sx={{ color: '#f44336' }} /></ListItemIcon>
                            <Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: '#f44336' }}>{isDeleting ? 'Đang xóa...' : 'Xóa bài viết'}</Typography></Box>
                        </MenuItem>
                        <Divider />
                    </>
                ) : null}
                <MenuItem sx={{ py: 1.5 }}><ListItemIcon><FavoriteIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>Quan tâm</Typography><Typography sx={{ fontSize: 12, color: '#65676b' }}>Bạn sẽ nhìn thấy nhiều bài viết tương tự hơn.</Typography></Box></MenuItem>
                <MenuItem sx={{ py: 1.5 }}><ListItemIcon><RemoveIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>Không quan tâm</Typography><Typography sx={{ fontSize: 12, color: '#65676b' }}>Bạn sẽ nhìn thấy ít bài viết tương tự hơn.</Typography></Box></MenuItem>
                <Divider />
                <MenuItem sx={{ py: 1.5 }}><ListItemIcon><BookmarkBorderIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>Lưu bài viết</Typography><Typography sx={{ fontSize: 12, color: '#65676b' }}>Thêm vào danh sách mục đã lưu.</Typography></Box></MenuItem>
                <Divider />
                <MenuItem sx={{ py: 1.5 }}><ListItemIcon><NotificationIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>Bật thông báo về bài viết này</Typography></Box></MenuItem>
                <MenuItem sx={{ py: 1.5 }}><ListItemIcon><InfoIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>Tại sao tôi nhìn thấy bài viết này?</Typography></Box></MenuItem>
                {/* Non-owner actions */}
                {menuPost && user?.id !== menuPost.userId?._id ? (
                    <>
                        <Divider />
                        <MenuItem sx={{ py: 1.5 }}><ListItemIcon><ReportIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>Báo cáo bài viết</Typography></Box></MenuItem>
                        <MenuItem sx={{ py: 1.5 }}><ListItemIcon><HideIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>Ẩn bài viết</Typography><Typography sx={{ fontSize: 12, color: '#65676b' }}>Ẩn bớt các bài viết tương tự.</Typography></Box></MenuItem>
                        <MenuItem sx={{ py: 1.5 }}><ListItemIcon><BlockIcon /></ListItemIcon><Box><Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>Tạm ẩn trong 30 ngày</Typography></Box></MenuItem>
                    </>
                ) : null}
            </Menu>

            {/* Comment Modal */}
            <Modal open={openCommentModal} onClose={() => setOpenCommentModal(false)}>
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 700, maxHeight: '90vh', bgcolor: 'white', borderRadius: 2, boxShadow: 24, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, borderBottom: '1px solid #e4e6eb', position: 'relative' }}>
                        <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#050505' }}>Bài viết của {commentingPost ? getAuthorName(commentingPost) : ''}</Typography>
                        <IconButton onClick={() => setOpenCommentModal(false)} sx={{ position: 'absolute', right: 12, bgcolor: '#e4e6eb', '&:hover': { bgcolor: '#d8dadf' } }}><CloseIcon /></IconButton>
                    </Box>

                    <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                        {commentingPost && renderPostMedia(commentingPost)}
                        {commentingPost && !commentingPost.media?.length && <Typography sx={{ mb: 2, fontSize: 15, color: '#050505' }}>{commentingPost?.content}</Typography>}

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: '#1877f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ThumbUpIcon sx={{ fontSize: 12, color: 'white' }} /></Box>
                                <Typography sx={{ fontSize: 15, color: '#65676b' }}>{commentingPost?.totalReacts}</Typography>
                            </Box>
                            <Typography sx={{ fontSize: 15, color: '#65676b' }}>{commentingPost?.totalComments} bình luận · {commentingPost?.totalShares} lượt chia sẻ</Typography>
                        </Box>

                        <Divider sx={{ my: 1 }} />

                        <Box sx={{ display: 'flex', justifyContent: 'space-around', mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}><ThumbUpOutlinedIcon sx={{ color: '#65676b' }} /><Typography sx={{ color: '#65676b', fontWeight: 600 }}>Thích</Typography></Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}><CommentIcon sx={{ color: '#050505' }} /><Typography sx={{ color: '#050505', fontWeight: 600 }}>Bình luận</Typography></Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}><ShareIcon sx={{ color: '#050505' }} /><Typography sx={{ color: '#050505', fontWeight: 600 }}>Chia sẻ</Typography></Box>
                        </Box>

                        <Divider sx={{ mb: 2 }} />

                        <Typography sx={{ fontSize: 14, fontWeight: 600, mb: 2, color: '#050505' }}>Tất cả bình luận ▼</Typography>

                        {mockComments.map((comment) => (
                            <Box key={comment.id} sx={{ display: 'flex', gap: 1, mb: 2 }}>
                                <Avatar sx={{ width: 32, height: 32 }} src={comment.avatar} />
                                <Box sx={{ flex: 1 }}>
                                    <Box sx={{ bgcolor: '#f0f2f5', borderRadius: 2, px: 1.5, py: 1, display: 'inline-block' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Typography sx={{ fontWeight: 600, fontSize: 13, color: '#050505' }}>{comment.author}</Typography>
                                            {comment.isVerified && <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: '#1877f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Typography sx={{ color: 'white', fontSize: 10 }}>✓</Typography></Box>}
                                            <Typography sx={{ fontSize: 13, color: '#1877f2' }}>· Theo dõi</Typography>
                                        </Box>
                                        <Typography sx={{ fontSize: 15, color: '#050505' }}>{comment.content}</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 2, mt: 0.5, ml: 1 }}>
                                        <Typography sx={{ fontSize: 12, color: '#050505' }}>{comment.time}</Typography>
                                        <Typography sx={{ fontSize: 12, color: '#050505', fontWeight: 600, cursor: 'pointer' }}>Thích</Typography>
                                        <Typography sx={{ fontSize: 12, color: '#050505', fontWeight: 600, cursor: 'pointer' }}>Trả lời</Typography>
                                    </Box>
                                </Box>
                            </Box>
                        ))}
                    </Box>

                    <Box sx={{ p: 2, borderTop: '1px solid #e4e6eb', display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Avatar sx={{ width: 32, height: 32 }} src={user?.avatar} />
                        <Box sx={{ flex: 1, bgcolor: '#f0f2f5', borderRadius: '20px', px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <InputBase fullWidth placeholder="Viết bình luận..." value={commentText} onChange={(e) => setCommentText(e.target.value)} sx={{ fontSize: 15, color: '#050505' }} />
                            <IconButton size="small"><EmojiIcon sx={{ fontSize: 20, color: '#050505' }} /></IconButton>
                            <IconButton size="small"><GifIcon sx={{ fontSize: 20, color: '#050505' }} /></IconButton>
                        </Box>
                        <IconButton disabled={!commentText.trim()}><SendIcon sx={{ color: commentText.trim() ? '#1877f2' : '#bcc0c4' }} /></IconButton>
                    </Box>
                </Box>
            </Modal>

            {/* Share Modal */}
            <Modal open={openShareModal} onClose={handleCloseShare}>
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 550, bgcolor: 'white', borderRadius: 2, boxShadow: 24, overflow: 'hidden' }}>
                    {/* Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, borderBottom: '1px solid #e4e6eb', position: 'relative' }}>
                        <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#050505' }}>Chia sẻ</Typography>
                        <IconButton onClick={handleCloseShare} sx={{ position: 'absolute', right: 12, bgcolor: '#e4e6eb', '&:hover': { bgcolor: '#d8dadf' } }}>
                            <CloseIcon />
                        </IconButton>
                    </Box>

                    {/* User Info & Caption */}
                    <Box sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                            <Avatar sx={{ width: 40, height: 40 }} src={user?.avatar} />
                            <Box>
                                <Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>{user?.fullName || user?.username}</Typography>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                        size="small"
                                        startIcon={<PublicIcon sx={{ fontSize: 12 }} />}
                                        sx={{ bgcolor: '#e4e6eb', color: '#050505', textTransform: 'none', fontSize: 12, fontWeight: 600, px: 1, py: 0.25, borderRadius: 1, '&:hover': { bgcolor: '#d8dadf' } }}
                                    >
                                        Bảng feed
                                    </Button>
                                    <Button
                                        size="small"
                                        startIcon={sharePrivacy === 'PUBLIC' ? <PublicIcon sx={{ fontSize: 12 }} /> : sharePrivacy === 'FRIEND' ? <PeopleIcon sx={{ fontSize: 12 }} /> : <LockIcon sx={{ fontSize: 12 }} />}
                                        endIcon={<ArrowDownIcon />}
                                        sx={{ bgcolor: '#e4e6eb', color: '#050505', textTransform: 'none', fontSize: 12, fontWeight: 600, px: 1, py: 0.25, borderRadius: 1, '&:hover': { bgcolor: '#d8dadf' } }}
                                    >
                                        {getSharePrivacyLabel()}
                                    </Button>
                                </Box>
                            </Box>
                        </Box>

                        {/* Caption Input with Emoji */}
                        <Box sx={{ position: 'relative' }}>
                            <InputBase
                                multiline
                                fullWidth
                                rows={2}
                                placeholder="Hãy nói gì đó về nội dung này..."
                                value={shareCaption}
                                onChange={(e) => setShareCaption(e.target.value)}
                                sx={{ fontSize: 15, color: '#050505', mb: 1 }}
                            />
                            <IconButton
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                sx={{ position: 'absolute', right: 0, top: 0 }}
                            >
                                <EmojiIcon sx={{ color: '#65676b' }} />
                            </IconButton>
                            {showEmojiPicker && (
                                <Box sx={{ position: 'absolute', right: 0, top: 40, zIndex: 100 }}>
                                    <Picker
                                        data={data}
                                        onEmojiSelect={handleEmojiSelect}
                                        theme="light"
                                        locale="vi"
                                        previewPosition="none"
                                        skinTonePosition="none"
                                    />
                                </Box>
                            )}
                        </Box>

                        {/* Share Now Button */}
                        <Button
                            fullWidth
                            variant="contained"
                            sx={{
                                bgcolor: '#1877f2',
                                color: 'white',
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: 15,
                                py: 1,
                                borderRadius: 2,
                                '&:hover': { bgcolor: '#166fe5' },
                            }}
                        >
                            Chia sẻ ngay
                        </Button>
                    </Box>

                    {/* Send via Messenger */}
                    <Box sx={{ px: 2, pb: 2 }}>
                        <Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505', mb: 1.5 }}>Gửi bằng Messenger</Typography>
                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', position: 'relative' }}>
                            <IconButton sx={{ p: 0 }}>
                                <ArrowBackIcon sx={{ color: '#65676b' }} />
                            </IconButton>
                            {mockFriends.map((friend) => (
                                <Box key={friend.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                                    <Box sx={{ position: 'relative' }}>
                                        <Avatar sx={{ width: 56, height: 56 }} src={friend.avatar} />
                                        {friend.isOnline && (
                                            <Box sx={{
                                                position: 'absolute', bottom: 2, right: 2,
                                                width: 14, height: 14, borderRadius: '50%',
                                                bgcolor: '#31a24c', border: '2px solid white'
                                            }} />
                                        )}
                                    </Box>
                                    <Typography sx={{ fontSize: 12, color: '#050505', textAlign: 'center', maxWidth: 64, mt: 0.5 }} noWrap>{friend.name}</Typography>
                                </Box>
                            ))}
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                                <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: '#e4e6eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <MoreIcon sx={{ color: '#050505' }} />
                                </Box>
                                <Typography sx={{ fontSize: 12, color: '#050505', textAlign: 'center', mt: 0.5 }}>Xem thêm</Typography>
                            </Box>
                        </Box>
                    </Box>

                    {/* Share Options */}
                    <Box sx={{ px: 2, pb: 2 }}>
                        <Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505', mb: 1.5 }}>Chia sẻ lên</Typography>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            {shareOptions.map((option) => (
                                <Box key={option.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', '&:hover': { opacity: 0.8 } }}>
                                    <Box sx={{
                                        width: 56, height: 56, borderRadius: '50%',
                                        bgcolor: option.id === 'messenger' ? '#0084ff' : option.id === 'whatsapp' ? '#25d366' : '#e4e6eb',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <option.icon sx={{ color: option.id === 'messenger' || option.id === 'whatsapp' ? 'white' : '#050505', fontSize: 28 }} />
                                    </Box>
                                    <Typography sx={{ fontSize: 12, color: '#050505', textAlign: 'center', maxWidth: 70, mt: 0.5 }}>{option.label}</Typography>
                                </Box>
                            ))}
                        </Box>
                    </Box>
                </Box>
            </Modal>
        </Box >
    );
}
