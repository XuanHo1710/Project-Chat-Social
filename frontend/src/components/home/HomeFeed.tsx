'use client';
import {
    Box, Card, CardContent, Avatar, Typography, IconButton, Divider,
    Modal, Menu, Skeleton
} from '@mui/material';
import {
    VideoCall as VideoIcon,
    PhotoLibrary as PhotoIcon,
    Mood as MoodIcon,
    Add as AddIcon,
    ArrowForward as ArrowForwardIcon,
    ArrowBack as ArrowBackIcon,
    PlayArrow as PlayIcon,
} from '@mui/icons-material';
import { useAuthStore } from '@/stores/useAuthStore';
import { useState, useRef, useMemo } from 'react';
import { useGetNewsFeed, useDeletePost } from '@/queries/usePostQueries';
import { PostType, PostPrivacy, MediaItem } from '@/types/post';
import CreatePostModal from '../posts/CreatePostModal';
import EditPostModal from '../posts/EditPostModal';
import ImageViewer from '../posts/ImageViewer';
import { deleteCloudinaryMedia } from '@/services/cloudinary.service';
import PostItem from '@/components/posts/PostItem';
import { getPrivacyIcon } from '@/utils/formatPost';
import CommentContentModal from '@/components/posts/CommentContentModal';
import ShareContentModal from '@/components/posts/ShareContentModal';
import PostOptionContentMenu from '@/components/posts/PostOptionContentMenu';


const stories = [
    { name: 'Tạo tin', isCreate: true },
    { name: 'Đức Khoa Quach', avatar: '/avatar1.jpg' },
    { name: '28Tech', avatar: '/avatar2.jpg' },
    { name: 'Anime - My Heart', avatar: '/avatar3.jpg' },
    { name: 'Trường Đại học Khoa học...', avatar: '/avatar4.jpg' },
    { name: 'VTV24', avatar: '/avatar5.jpg' },
    { name: 'F8 - Học Lập Trình', avatar: '/avatar6.jpg' },
];


export default function HomeFeed() {
    const { user } = useAuthStore();
    const storiesRef = useRef<HTMLDivElement>(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(true);

    // Fetch posts from API
    const { data: postsData, isLoading: isLoadingPosts } = useGetNewsFeed({ page: 1, limit: 20 });
    const deletePostMutation = useDeletePost();

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
            // 1. Delete media from Cloudinary first (via backend API)
            if (menuPost.media && menuPost.media.length > 0) {
                const mediaItems = menuPost.media
                    .filter(m => m.publicId)
                    .map(m => ({
                        publicId: m.publicId,
                        mediaType: m.mediaType
                    }));
                if (mediaItems.length > 0) {
                    await deleteCloudinaryMedia(mediaItems);
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

    const handleCloseCreatePost = () => {
        setOpenCreatePost(false);
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
                return (
                    <PostItem
                        key={post._id}
                        post={post}
                        handleOpenMenu={handleOpenMenu}
                        handleOpenComments={handleOpenComments}
                        handleOpenShare={handleOpenShare}
                        renderPostMedia={renderPostMedia}
                        PrivacyIconComponent={PrivacyIconComponent}
                    />
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
                <PostOptionContentMenu
                    handleDeletePost={handleDeletePost}
                    handleEditPost={handleEditPost}
                    isDeleting={isDeleting}
                    menuPost={menuPost}
                    user={user}
                />
            </Menu>

            {/* Comment Modal */}
            <Modal open={openCommentModal} onClose={() => setOpenCommentModal(false)}>
                <CommentContentModal
                    setOpenCommentModal={setOpenCommentModal}
                    commentingPost={commentingPost}
                    renderPostMedia={renderPostMedia}
                    handleOpenShare={handleOpenShare}
                />
            </Modal>

            {/* Share Modal */}
            <Modal open={openShareModal} onClose={handleCloseShare}>
                <ShareContentModal
                    handleCloseShare={handleCloseShare}
                    handleEmojiSelect={handleEmojiSelect}
                    setShareCaption={setShareCaption}
                    setShowEmojiPicker={setShowEmojiPicker}
                    shareCaption={shareCaption}
                    sharePrivacy={sharePrivacy}
                    showEmojiPicker={showEmojiPicker}
                    user={user}
                />
            </Modal>
        </Box >
    );
}
