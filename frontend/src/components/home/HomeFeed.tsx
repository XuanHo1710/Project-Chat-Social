'use client';
import {
    Box, Card, CardContent, Avatar, Typography, Divider,
    Modal, Menu, Skeleton, CircularProgress, useTheme, Chip
} from '@mui/material';
import {
    VideoCall as VideoIcon,
    PhotoLibrary as PhotoIcon,
    Mood as MoodIcon,
    PlayCircle as PlayIcon,
} from '@mui/icons-material';
import { useAuthStore } from '@/stores/useAuthStore';
import { usePostStore } from '@/stores/usePostStore';
import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useGetNewsFeedInfinite, useDeletePost } from '@/queries/usePostQueries';
import { PostType, PostPrivacy, MediaItem } from '@/types/post';
import { postService } from '@/services/post.service';
import CreatePostModal from '../posts/CreatePostModal';
import EditPostModal from '../posts/EditPostModal';
import ImageViewer from '../posts/ImageViewer';
import { deleteCloudinaryMedia } from '@/services/cloudinary.service';
import PostItem from '@/components/posts/PostItem';
import { getPrivacyIcon } from '@/utils/formatPost';
import LiveStreamModal from '@/components/posts/LiveStreamModal';
import LiveStreamViewerModal from '@/components/posts/LiveStreamViewerModal';
import CommentContentModal from '@/components/posts/CommentContentModal';
import ShareContentModal from '@/components/posts/ShareContentModal';
import PostOptionContentMenu from '@/components/posts/PostOptionContentMenu';
import StoriesBar from '@/components/story/StoriesBar';


export default function HomeFeed() {
    const { user } = useAuthStore();
    const { posts: storePosts, setPosts: setStorePosts } = usePostStore();
    const searchParams = useSearchParams();
    const router = useRouter();
    const highlightedPostRef = useRef<HTMLDivElement>(null);

    // Get highlighted post ID from URL query
    const highlightedPostIdFromUrl = searchParams.get('postId');

    // Debug log
    console.log('🎯 Highlight postId from URL:', highlightedPostIdFromUrl);

    // Store highlighted post ID in ref to persist even after URL change
    const persistedHighlightedPostId = useRef<string | null>(null);

    // Update persisted ID when URL has postId
    useEffect(() => {
        if (highlightedPostIdFromUrl) {
            console.log('💾 Persisting highlight postId:', highlightedPostIdFromUrl);
            persistedHighlightedPostId.current = highlightedPostIdFromUrl;
        }
    }, [highlightedPostIdFromUrl]);

    // Fetch posts from API with infinite scroll
    const {
        data: postsData,
        isLoading: isLoadingPosts,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useGetNewsFeedInfinite(10);
    const deletePostMutation = useDeletePost();

    // Ref for infinite scroll observer
    const loadMoreRef = useRef<HTMLDivElement>(null);

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

    // Livestream
    const [openLiveStudio, setOpenLiveStudio] = useState(false);
    const [viewingLivePost, setViewingLivePost] = useState<PostType | null>(null);

    // Highlight animation state (separate from URL so we can turn it off after timeout)
    const [showHighlightAnimation, setShowHighlightAnimation] = useState<string | null>(null);

    // Flatten all pages into single array
    const allApiPosts = useMemo(() => {
        if (!postsData?.pages) return [];
        return postsData.pages.flatMap((page) => page.data || []);
    }, [postsData]);

    // State for fetched highlighted post (if not in newsfeed)
    const [fetchedHighlightedPost, setFetchedHighlightedPost] = useState<PostType | null>(null);
    const fetchedPostIdRef = useRef<string | null>(null);

    // Fetch highlighted post if not in current list
    useEffect(() => {
        if (!highlightedPostIdFromUrl) return;
        if (isLoadingPosts) return;

        // Check if already fetched this post
        if (fetchedPostIdRef.current === highlightedPostIdFromUrl) return;

        // Check if post exists in API posts
        const existsInApiPosts = allApiPosts.some(p => p._id === highlightedPostIdFromUrl);
        const existsInStorePosts = storePosts.some((p: PostType) => p._id === highlightedPostIdFromUrl);

        if (!existsInApiPosts && !existsInStorePosts) {
            console.log('🔍 Post not in newsfeed, fetching:', highlightedPostIdFromUrl);
            fetchedPostIdRef.current = highlightedPostIdFromUrl;

            postService.getPostById(highlightedPostIdFromUrl)
                .then((post) => {
                    console.log('✅ Fetched highlighted post:', post._id);
                    setFetchedHighlightedPost(post);
                })
                .catch((err) => {
                    console.log('❌ Failed to fetch highlighted post:', err);
                });
        } else {
            console.log('✅ Post found in newsfeed');
        }
    }, [highlightedPostIdFromUrl, isLoadingPosts, allApiPosts, storePosts]);

    // Sync API data with store - only when API data actually changes
    useEffect(() => {
        if (allApiPosts.length > 0) {
            // Only update if posts actually differ
            const currentIds = storePosts.map((p: PostType) => p._id).join(',');
            const newIds = allApiPosts.map((p: PostType) => p._id).join(',');
            if (currentIds !== newIds) {
                setStorePosts(allApiPosts);
            }
        }
    }, [allApiPosts]); // Remove setStorePosts from deps to avoid loops

    // Get posts from store - sort to put highlighted post first (use persisted ID)
    const posts = useMemo(() => {
        // Merge store posts with API data (store posts take precedence for new posts)
        const apiPosts = allApiPosts;
        const apiPostIds = new Set(apiPosts.map((p: PostType) => p._id));

        // Get new posts from store that aren't in API yet
        const newStorePosts = storePosts.filter((p: PostType) => !apiPostIds.has(p._id));

        // Merge: new store posts + API posts (using store version if exists)
        let allPosts: PostType[] = [
            ...newStorePosts,
            ...apiPosts.map((apiPost: PostType) => {
                const storePost = storePosts.find((sp: PostType) => sp._id === apiPost._id);
                return storePost || apiPost;
            })
        ];

        // Use URL param directly for sorting (more reliable)
        const postIdToHighlight = highlightedPostIdFromUrl || persistedHighlightedPostId.current;

        if (!postIdToHighlight) return allPosts;

        // First, check if highlighted post exists in list
        let highlightedPost = allPosts.find((p: PostType) => p._id === postIdToHighlight);

        // If not found, use fetched post (if available)
        if (!highlightedPost && fetchedHighlightedPost && fetchedHighlightedPost._id === postIdToHighlight) {
            highlightedPost = fetchedHighlightedPost;
            console.log('📦 Using fetched highlighted post');
        }

        if (!highlightedPost) {
            console.log('⚠️ Highlighted post not found anywhere:', postIdToHighlight);
            return allPosts;
        }

        console.log('✅ Moving highlighted post to top:', postIdToHighlight);
        const otherPosts = allPosts.filter((p: PostType) => p._id !== postIdToHighlight);
        return [highlightedPost, ...otherPosts];
    }, [allApiPosts, storePosts, highlightedPostIdFromUrl, fetchedHighlightedPost]);

    // Track if we've already handled the highlight for current postId
    const highlightHandledRef = useRef<string | null>(null);

    // Scroll to highlighted post and clear URL after viewing
    useEffect(() => {
        // Only proceed if we have a postId from URL
        if (!highlightedPostIdFromUrl) return;
        if (isLoadingPosts) {
            console.log('⏳ Still loading posts, waiting...');
            return;
        }

        // Check if already handled
        if (highlightHandledRef.current === highlightedPostIdFromUrl) {
            console.log('🔄 Already handled this postId');
            return;
        }

        // Check if the highlighted post actually exists in our posts
        const postExists = posts.find(p => p._id === highlightedPostIdFromUrl);
        if (!postExists) {
            console.log('❌ Post not found in current list:', highlightedPostIdFromUrl, 'Available posts:', posts.length);
            return;
        }

        console.log('✅ Post found! Scrolling and highlighting...');

        // Mark as handled to prevent re-running
        highlightHandledRef.current = highlightedPostIdFromUrl;
        // Also persist for sorting
        persistedHighlightedPostId.current = highlightedPostIdFromUrl;

        // Start highlight animation
        setShowHighlightAnimation(highlightedPostIdFromUrl);

        // Wait for render then scroll
        const scrollTimer = setTimeout(() => {
            if (highlightedPostRef.current) {
                highlightedPostRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                console.log('📍 Scrolled to post');
            } else {
                console.log('⚠️ Ref not attached to element');
            }
        }, 500);

        // Turn off highlight animation after 4 seconds
        const highlightTimer = setTimeout(() => {
            setShowHighlightAnimation(null);
            console.log('🔇 Turned off highlight animation');
        }, 4000);

        // Clear the postId from URL after animation done (5 seconds)
        const clearTimer = setTimeout(() => {
            window.history.replaceState(null, '', '/');
            console.log('🧹 Cleared URL');
        }, 5000);

        return () => {
            clearTimeout(scrollTimer);
            clearTimeout(highlightTimer);
            clearTimeout(clearTimer);
        };
    }, [highlightedPostIdFromUrl, isLoadingPosts, posts]);

    // Infinite scroll: Intersection Observer to load more when reaching bottom
    useEffect(() => {
        const element = loadMoreRef.current;
        if (!element) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const first = entries[0];
                if (first.isIntersecting && hasNextPage && !isFetchingNextPage) {
                    console.log('📥 Loading more posts...');
                    fetchNextPage();
                }
            },
            { threshold: 0.1, rootMargin: '100px' }
        );

        observer.observe(element);

        return () => {
            observer.disconnect();
        };
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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

    // Open video in Reels
    const handleOpenVideoReel = (post: PostType) => {
        router.push(`/reels/${post._id}`);
    };

    const handleOpenComments = (post: PostType) => {
        // If post has video, open in Reels view
        const hasVideo = post.media?.some(m => m.mediaType === 'VIDEO');
        if (hasVideo) {
            handleOpenVideoReel(post);
            return;
        }
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

    // Toggle post settings handlers
    const handleToggleComments = async (allow: boolean) => {
        if (!menuPost) return;
        try {
            await postService.updatePost(menuPost._id, { allowComments: allow });
            // Update local state
            const updatedPost = { ...menuPost, allowComments: allow };
            usePostStore.getState().updatePost(menuPost._id, updatedPost);
            setMenuPost(updatedPost);
        } catch (error) {
            console.error('Error toggling comments:', error);
        }
    };

    const handleToggleShares = async (allow: boolean) => {
        if (!menuPost) return;
        try {
            await postService.updatePost(menuPost._id, { allowShares: allow });
            const updatedPost = { ...menuPost, allowShares: allow };
            usePostStore.getState().updatePost(menuPost._id, updatedPost);
            setMenuPost(updatedPost);
        } catch (error) {
            console.error('Error toggling shares:', error);
        }
    };

    const handleToggleReactions = async (allow: boolean) => {
        if (!menuPost) return;
        try {
            await postService.updatePost(menuPost._id, { allowReactions: allow });
            const updatedPost = { ...menuPost, allowReactions: allow };
            usePostStore.getState().updatePost(menuPost._id, updatedPost);
            setMenuPost(updatedPost);
        } catch (error) {
            console.error('Error toggling reactions:', error);
        }
    };

    // Render media grid for post
    const renderPostMedia = (post: PostType) => {
        // Handle Livestream Post
        if (post.type === 'LIVESTREAM') {
            const isLive = post.livestreamStatus === 'LIVE';
            const isEnded = post.livestreamStatus === 'ENDED';
            const hasVideo = post.media && post.media.length > 0 && post.media[0].url;
            const userAvatar = typeof post.userId !== 'string' ? post.userId?.avatar : '';

            // If ended and has recorded video - show video player
            if (isEnded && hasVideo) {
                return (
                    <Box sx={{ mb: 2, position: 'relative' }}>
                        <video
                            src={post.media[0].url}
                            controls
                            poster={userAvatar}
                            style={{
                                width: '100%',
                                maxHeight: 500,
                                objectFit: 'contain',
                                borderRadius: 8
                            }}
                        />
                        <Chip
                            label="📺 Phát lại"
                            size="small"
                            sx={{
                                position: 'absolute',
                                top: 12,
                                left: 12,
                                bgcolor: 'rgba(0,0,0,0.7)',
                                color: 'white',
                                fontWeight: 600
                            }}
                        />
                    </Box>
                );
            }

            // Live or ended without video
            return (
                <Box
                    sx={{
                        mb: 2,
                        position: 'relative',
                        cursor: isLive ? 'pointer' : 'default',
                        height: 260,
                        bgcolor: isDark ? '#1c1e21' : '#e4e6eb',
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden'
                    }}
                    onClick={() => {
                        if (isLive) setViewingLivePost(post);
                    }}
                >
                    {userAvatar && (
                        <Box
                            component="img"
                            src={userAvatar}
                            sx={{
                                position: 'absolute',
                                inset: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                filter: 'blur(30px) brightness(0.4)',
                                opacity: 0.8
                            }}
                        />
                    )}

                    <Box sx={{ position: 'relative', textAlign: 'center', zIndex: 1 }}>
                        {isLive ? (
                            <>
                                <Chip
                                    label="🔴 TRỰC TIẾP"
                                    sx={{
                                        bgcolor: '#e41e3f',
                                        color: 'white',
                                        fontWeight: 700,
                                        fontSize: 14,
                                        mb: 2
                                    }}
                                />
                                <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, mb: 1 }}>
                                    Bấm để xem Live
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                                    Đang phát trực tiếp
                                </Typography>
                            </>
                        ) : (
                            <>
                                <Typography sx={{ fontSize: 48, mb: 1 }}>📺</Typography>
                                <Typography variant="body1" sx={{ color: textSecondary, fontWeight: 500 }}>
                                    Video trực tiếp đã kết thúc
                                </Typography>
                                <Typography variant="body2" sx={{ color: textSecondary, mt: 0.5 }}>
                                    Video không được lưu
                                </Typography>
                            </>
                        )}
                    </Box>
                </Box>
            );
        }

        if (!post.media || post.media.length === 0) return null;

        const mediaCount = post.media.length;

        if (mediaCount === 1) {
            const media = post.media[0];
            return (
                <Box sx={{ mb: 2, position: 'relative' }}>
                    {media.mediaType === 'VIDEO' ? (
                        <Box
                            sx={{ position: 'relative', cursor: 'pointer' }}
                            onClick={() => handleOpenVideoReel(post)}
                        >
                            <video
                                src={media.url}
                                style={{ width: '100%', maxHeight: 500, objectFit: 'cover', borderRadius: 4 }}
                            />
                            <Box sx={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                bgcolor: 'rgba(0,0,0,0.6)',
                                borderRadius: '50%',
                                p: 1.5
                            }}>
                                <PlayIcon sx={{ color: 'white', fontSize: 48 }} />
                            </Box>
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
                        onClick={() => {
                            if (media.mediaType === 'VIDEO') {
                                handleOpenVideoReel(post);
                            } else {
                                handleOpenImageViewer(post.media, index);
                            }
                        }}
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

    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const hoverBg = isDark ? 'rgba(255,255,255,0.1)' : '#f0f2f5';
    const inputBg = isDark ? 'rgba(255,255,255,0.1)' : '#f0f2f5';
    const textSecondary = isDark ? '#b0b3b8' : '#65676b';

    return (
        <Box sx={{ maxWidth: 680, mx: 'auto', py: 2, px: { xs: 1, sm: 2 } }}>
            {/* Stories Section */}
            {user && <StoriesBar currentUser={user} />}

            {/* Create Post */}
            <Card sx={{ mb: 2, borderRadius: 2, boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.1)' }}>
                <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <Avatar sx={{ width: 40, height: 40 }} src={user?.avatar} />
                        <Box onClick={() => setOpenCreatePost(true)} sx={{ flex: 1, bgcolor: inputBg, borderRadius: '50px', display: 'flex', alignItems: 'center', px: 2, py: 1.5, cursor: 'pointer', '&:hover': { bgcolor: hoverBg } }}>
                            <Typography sx={{ color: 'text.secondary', fontSize: 17 }}>{user?.fullName || user?.username || 'Bạn'} ơi, bạn đang nghĩ gì thế?</Typography>
                        </Box>
                    </Box>
                    <Divider sx={{ mb: 1 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-around' }}>
                        <Box onClick={() => setOpenLiveStudio(true)} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 2, cursor: 'pointer', borderRadius: 2, '&:hover': { bgcolor: hoverBg } }}>
                            <VideoIcon sx={{ color: '#f3425f' }} />
                            <Typography sx={{ fontSize: '15px', fontWeight: 600, color: 'text.secondary' }}>Video trực tiếp</Typography>
                        </Box>
                        <Box onClick={() => setOpenCreatePost(true)} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 2, cursor: 'pointer', borderRadius: 2, '&:hover': { bgcolor: hoverBg } }}>
                            <PhotoIcon sx={{ color: '#45bd62' }} />
                            <Typography sx={{ fontSize: '15px', fontWeight: 600, color: 'text.secondary' }}>Ảnh/video</Typography>
                        </Box>
                        <Box onClick={() => setOpenCreatePost(true)} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 2, cursor: 'pointer', borderRadius: 2, '&:hover': { bgcolor: hoverBg } }}>
                            <MoodIcon sx={{ color: '#f7b928' }} />
                            <Typography sx={{ fontSize: '15px', fontWeight: 600, color: 'text.secondary' }}>Cảm xúc</Typography>
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
                    <Typography sx={{ color: 'text.secondary', fontSize: 16 }}>
                        Chưa có bài viết nào. Hãy đăng bài viết đầu tiên của bạn!
                    </Typography>
                </Card>
            )}

            {/* Posts */}
            {posts.map((post) => {
                const PrivacyIconComponent = getPrivacyIcon(post.privacy);
                const isHighlighted = post._id === showHighlightAnimation; // Use animation state (auto turns off)
                const isTargetPost = post._id === highlightedPostIdFromUrl; // Same as isHighlighted for ref

                // Check if post belongs to a group
                const groupInfo = post.groupId && typeof post.groupId === 'object' ? post.groupId : null;
                const isGroupPost = !!groupInfo;

                return (
                    <PostItem
                        key={post._id}
                        ref={isTargetPost ? highlightedPostRef : undefined}
                        post={post}
                        userId={user?.id || ''}
                        handleOpenMenu={handleOpenMenu}
                        handleOpenComments={handleOpenComments}
                        handleOpenShare={handleOpenShare}
                        renderPostMedia={renderPostMedia}
                        PrivacyIconComponent={PrivacyIconComponent}
                        isHighlighted={isHighlighted}
                        isGroupPost={isGroupPost}
                        groupName={groupInfo?.name}
                        groupAvatar={groupInfo?.avatar}
                        groupId={groupInfo?._id}
                    />
                );
            })}

            {/* Load More Trigger & Indicator */}
            <Box ref={loadMoreRef} sx={{ py: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 1 }}>
                {isFetchingNextPage && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <CircularProgress size={24} sx={{ color: 'primary.main' }} />
                        <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>Đang tải thêm bài viết...</Typography>
                    </Box>
                )}
                {!hasNextPage && posts.length > 0 && !isFetchingNextPage && (
                    <Typography sx={{ color: 'text.secondary', fontSize: 14, textAlign: 'center' }}>
                        🎉 Đã hết bài viết. Bạn đã xem tất cả!
                    </Typography>
                )}
            </Box>

            {/* Create Post Modal */}
            <CreatePostModal
                open={openCreatePost}
                onClose={handleCloseCreatePost}
                onPostCreated={(newPost) => {
                    // Add new post to store for instant update
                    usePostStore.getState().addPost(newPost);
                }}
            />

            {/* Edit Post Modal */}
            {editingPost && (
                <EditPostModal
                    open={openEditPost}
                    onClose={() => {
                        setOpenEditPost(false);
                        setEditingPost(null);
                    }}
                    post={editingPost}
                    onPostUpdated={(updatedPost) => {
                        // Update global post store
                        usePostStore.getState().updatePost(updatedPost._id, updatedPost);
                    }}
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
                    onToggleComments={handleToggleComments}
                    onToggleShares={handleToggleShares}
                    onToggleReactions={handleToggleReactions}
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
                    sharingPost={sharingPost}
                />
            </Modal>

            {/* Livestream Studio */}
            <LiveStreamModal
                open={openLiveStudio}
                onClose={() => setOpenLiveStudio(false)}
            />

            {/* Livestream Viewer */}
            {viewingLivePost && (
                <LiveStreamViewerModal
                    open={Boolean(viewingLivePost)}
                    onClose={() => setViewingLivePost(null)}
                    post={viewingLivePost}
                />
            )}
        </Box >
    );
}
