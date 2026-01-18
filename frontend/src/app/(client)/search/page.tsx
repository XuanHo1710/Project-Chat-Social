'use client';

import { useState, useEffect, Suspense, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Box, Typography, InputBase, Card,
    IconButton, Divider, Skeleton,
    List, ListItemIcon, ListItemText, CircularProgress,
    Modal,
    Menu,
    Select,
    MenuItem,
    FormControl,
    Slider,
    ListItemButton,
    Avatar,
    Collapse,
    useTheme
} from '@mui/material';

import {
    Search as SearchIcon,
    ArrowBack as ArrowBackIcon,
    FilterList as FilterIcon,
    People as PeopleIcon,
    OndemandVideo as VideoIcon,
    Groups as GroupsIcon,
    PlayCircle as PlayIcon,
    SortByAlpha as SortIcon,
    CalendarMonth as CalendarIcon,
    Bookmark as BookmarkIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { useAuthStore } from '@/stores/useAuthStore';
import Header from '@/components/home/Header';
import { MediaItem, PostPrivacy, PostType } from '@/types/post';
import { useDeletePost, useSearchFeedInfinite } from '@/queries/usePostQueries';
import { usePostStore } from '@/stores/usePostStore';
import { postService } from '@/services/post.service';
import { deleteCloudinaryMedia } from '@/services/cloudinary.service';
import ShareContentModal from '@/components/posts/ShareContentModal';
import { getPrivacyIcon } from '@/utils/formatPost';
import PostItem from '@/components/posts/PostItem';
import EditPostModal from '@/components/posts/EditPostModal';
import ImageViewer from '@/components/posts/ImageViewer';
import PostOptionContentMenu from '@/components/posts/PostOptionContentMenu';
import CommentContentModal from '@/components/posts/CommentContentModal';
import Link from 'next/link';


// Main component wrapped in Suspense
function SearchContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const { isAuthenticated, isLoading: authLoading } = useAuthStore();
    const { user } = useAuthStore();

    const { posts: storePosts, setPosts: setStorePosts } = usePostStore();

    // Theme-aware colors
    const bgColor = isDark ? theme.palette.background.default : '#f0f2f5';
    const cardBg = isDark ? theme.palette.background.paper : 'white';
    const borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb';
    const hoverBg = isDark ? 'rgba(255,255,255,0.1)' : '#f0f2f5';
    const textSecondary = isDark ? 'rgba(255,255,255,0.7)' : '#65676b';
    const chipBg = isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb';
    const chipText = isDark ? 'white' : '#050505';

    // Search input state with debounce for performance
    const [inputValue, setInputValue] = useState('');

    // Filter states
    const [activeFilter, setActiveFilter] = useState('all');
    const [sortBy, setSortBy] = useState('relevance');
    const [yearRange, setYearRange] = useState<number[]>([2010, 2026]);
    const [showFilters, setShowFilters] = useState(false);

    // Get initial query from URL
    const urlQuery = searchParams.get('q')?.toString() || '';

    // Sync input with URL query on mount
    useEffect(() => {
        if (urlQuery) {
            setInputValue(urlQuery);
        }
    }, [urlQuery]);

    // Fetch posts from API with infinite scroll - use URL query for actual search
    const {
        data: postsData,
        isLoading: isLoadingPosts,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useSearchFeedInfinite(10, urlQuery);


    const deletePostMutation = useDeletePost();

    // Ref for infinite scroll observer
    const loadMoreRef = useRef<HTMLDivElement>(null);


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
    const sharePrivacy: PostPrivacy = 'PUBLIC';

    // Emoji Picker
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Flatten all pages into single array
    const allApiPosts = useMemo(() => {
        if (!postsData?.pages) return [];
        return postsData.pages.flatMap((page) => page.data || []);
    }, [postsData]);

    // Sync API data with store - only when IDs differ
    useEffect(() => {
        if (allApiPosts.length > 0) {
            const currentIds = storePosts.map((p: PostType) => p._id).join(',');
            const newIds = allApiPosts.map((p: PostType) => p._id).join(',');
            if (currentIds !== newIds) {
                setStorePosts(allApiPosts);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allApiPosts]);

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

        // Apply year filter
        if (yearRange[0] !== 2010 || yearRange[1] !== 2026) {
            allPosts = allPosts.filter((post: PostType) => {
                const postYear = new Date(post.createdAt).getFullYear();
                return postYear >= yearRange[0] && postYear <= yearRange[1];
            });
        }

        // Apply sorting
        if (sortBy === 'newest') {
            allPosts = [...allPosts].sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
        } else if (sortBy === 'oldest') {
            allPosts = [...allPosts].sort((a, b) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
        }
        // 'relevance' keeps original AI-ranked order

        return allPosts;
    }, [allApiPosts, storePosts, sortBy, yearRange]);


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


    // Redirect if not authenticated
    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.replace('/auth/login');
        }
    }, [authLoading, isAuthenticated, router]);



    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim()) {
            router.push(`/search?q=${encodeURIComponent(inputValue)}`);
        }
    };

    // Handle input change with useCallback for performance
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    }, []);

    const handleBack = () => {
        router.push('/');
    };

    // Loading auth
    if (authLoading) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', bgcolor: bgColor }}>
                <CircularProgress sx={{ color: 'primary.main' }} />
            </Box>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <Box sx={{ bgcolor: bgColor, minHeight: '100vh' }}>
            {/* Header */}
            <Header />

            <Box sx={{ display: 'flex' }}>
                {/* Left Sidebar - Like Home Sidebar */}
                <Box
                    sx={{
                        width: 360,
                        bgcolor: cardBg,
                        borderRight: `1px solid ${borderColor}`,
                        height: 'calc(100vh - 56px)',
                        position: 'fixed',
                        left: 0,
                        top: 56,
                        overflowY: 'auto',
                        p: 2,
                        display: { xs: 'none', md: 'block' },
                        '&::-webkit-scrollbar': { width: '8px' },
                        '&::-webkit-scrollbar-thumb': { backgroundColor: 'transparent', borderRadius: '4px' },
                        '&:hover::-webkit-scrollbar-thumb': { backgroundColor: isDark ? 'rgba(255,255,255,0.3)' : '#bcc0c4' },
                    }}
                >
                    <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>
                        Kết quả tìm kiếm
                    </Typography>

                    {/* Navigation Menu - Like Home Sidebar */}
                    <List sx={{ p: 0 }}>
                        {/* User Profile */}
                        <ListItemButton
                            onClick={() => router.push(user?.username ? `/profile/${user.username}` : '/')}
                            sx={{ borderRadius: 2, py: 1, '&:hover': { bgcolor: hoverBg } }}
                        >
                            <Avatar
                                src={user?.avatar}
                                sx={{ width: 36, height: 36, mr: 1.5 }}
                            >
                                {user?.fullName?.[0] || user?.username?.[0] || 'U'}
                            </Avatar>
                            <ListItemText
                                primary={user?.fullName || user?.username || 'User'}
                                primaryTypographyProps={{ fontWeight: 500, fontSize: 15 }}
                            />
                        </ListItemButton>

                        {/* Friends */}
                        <ListItemButton
                            component={Link}
                            href="/friends"
                            sx={{ borderRadius: 2, py: 1, '&:hover': { bgcolor: hoverBg } }}
                        >
                            <ListItemIcon sx={{ minWidth: 44 }}>
                                <PeopleIcon sx={{ fontSize: 28, color: 'primary.main' }} />
                            </ListItemIcon>
                            <ListItemText primary="Bạn bè" primaryTypographyProps={{ fontWeight: 500, fontSize: 15 }} />
                        </ListItemButton>

                        {/* Groups */}
                        <ListItemButton
                            component={Link}
                            href="/groups"
                            sx={{ borderRadius: 2, py: 1, '&:hover': { bgcolor: hoverBg } }}
                        >
                            <ListItemIcon sx={{ minWidth: 44 }}>
                                <GroupsIcon sx={{ fontSize: 28, color: 'primary.main' }} />
                            </ListItemIcon>
                            <ListItemText primary="Nhóm" primaryTypographyProps={{ fontWeight: 500, fontSize: 15 }} />
                        </ListItemButton>

                        {/* Watch/Reels */}
                        <ListItemButton
                            component={Link}
                            href="/reels"
                            sx={{ borderRadius: 2, py: 1, '&:hover': { bgcolor: hoverBg } }}
                        >
                            <ListItemIcon sx={{ minWidth: 44 }}>
                                <VideoIcon sx={{ fontSize: 28, color: 'primary.main' }} />
                            </ListItemIcon>
                            <ListItemText primary="Watch" primaryTypographyProps={{ fontWeight: 500, fontSize: 15 }} />
                        </ListItemButton>

                        {/* Saved */}
                        <ListItemButton
                            component={Link}
                            href="/saved"
                            sx={{ borderRadius: 2, py: 1, '&:hover': { bgcolor: hoverBg } }}
                        >
                            <ListItemIcon sx={{ minWidth: 44 }}>
                                <BookmarkIcon sx={{ fontSize: 28, color: '#a333c8' }} />
                            </ListItemIcon>
                            <ListItemText primary="Đã lưu" primaryTypographyProps={{ fontWeight: 500, fontSize: 15 }} />
                        </ListItemButton>
                    </List>

                    <Divider sx={{ my: 2 }} />

                    {/* Filters Section - Collapsible */}
                    <ListItemButton
                        onClick={() => setShowFilters(!showFilters)}
                        sx={{ borderRadius: 2, py: 1, mb: 1, '&:hover': { bgcolor: hoverBg } }}
                    >
                        <ListItemIcon sx={{ minWidth: 44 }}>
                            <FilterIcon sx={{ fontSize: 24, color: textSecondary }} />
                        </ListItemIcon>
                        <ListItemText
                            primary="Bộ lọc tìm kiếm"
                            primaryTypographyProps={{ fontWeight: 600, fontSize: 15 }}
                        />
                        {showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </ListItemButton>

                    <Collapse in={showFilters}>
                        <Box sx={{ pl: 1, pr: 1 }}>
                            {/* Filter Type */}
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block', fontWeight: 600 }}>
                                Loại kết quả
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                                <Box
                                    onClick={() => setActiveFilter('all')}
                                    sx={{
                                        px: 2, py: 0.75,
                                        borderRadius: 5,
                                        cursor: 'pointer',
                                        bgcolor: activeFilter === 'all' ? 'primary.main' : chipBg,
                                        color: activeFilter === 'all' ? 'white' : chipText,
                                        fontSize: 14, fontWeight: 500,
                                        '&:hover': { bgcolor: activeFilter === 'all' ? 'primary.dark' : (isDark ? 'rgba(255,255,255,0.15)' : '#d8dadf') }
                                    }}
                                >
                                    Tất cả
                                </Box>
                                <Box
                                    onClick={() => setActiveFilter('posts')}
                                    sx={{
                                        px: 2, py: 0.75,
                                        borderRadius: 5,
                                        cursor: 'pointer',
                                        bgcolor: activeFilter === 'posts' ? 'primary.main' : chipBg,
                                        color: activeFilter === 'posts' ? 'white' : chipText,
                                        fontSize: 14, fontWeight: 500,
                                        '&:hover': { bgcolor: activeFilter === 'posts' ? 'primary.dark' : (isDark ? 'rgba(255,255,255,0.15)' : '#d8dadf') }
                                    }}
                                >
                                    Bài viết
                                </Box>
                            </Box>

                            {/* Sorting Filter */}
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block', fontWeight: 600 }}>
                                <SortIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                                Sắp xếp
                            </Typography>
                            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                                <Select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    sx={{ borderRadius: 2, fontSize: 14 }}
                                >
                                    <MenuItem value="relevance">Liên quan nhất</MenuItem>
                                    <MenuItem value="newest">Mới nhất</MenuItem>
                                    <MenuItem value="oldest">Cũ nhất</MenuItem>
                                </Select>
                            </FormControl>

                            {/* Year Range Filter */}
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block', fontWeight: 600 }}>
                                <CalendarIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                                Ngày đăng ({yearRange[0]} - {yearRange[1]})
                            </Typography>
                            <Box sx={{ px: 1, pb: 2 }}>
                                <Slider
                                    value={yearRange}
                                    onChange={(_, newValue) => setYearRange(newValue as number[])}
                                    valueLabelDisplay="auto"
                                    min={2010}
                                    max={2026}
                                    marks={[
                                        { value: 2010, label: '2010' },
                                        { value: 2026, label: '2026' }
                                    ]}
                                    sx={{
                                        color: 'primary.main',
                                        '& .MuiSlider-thumb': { width: 14, height: 14 },
                                        '& .MuiSlider-mark': { display: 'none' },
                                    }}
                                />
                            </Box>
                        </Box>
                    </Collapse>
                </Box>

                {/* Main Content */}
                <Box
                    sx={{
                        flex: 1,
                        ml: { xs: 0, md: '80px' },
                        p: 3,
                        width: "100%",
                        mx: 'auto'
                    }}
                >
                    {/* Search Box */}
                    <Box
                        component="form"
                        onSubmit={handleSubmit}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            mb: 3,
                            bgcolor: cardBg,
                            borderRadius: 2,
                            p: 1,
                            boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.1)',
                            border: isDark ? `1px solid ${borderColor}` : 'none',
                        }}
                    >
                        <IconButton onClick={handleBack}>
                            <ArrowBackIcon />
                        </IconButton>
                        <InputBase
                            value={inputValue}
                            onChange={handleInputChange}
                            placeholder="Tìm kiếm trên Facebook"
                            sx={{ flex: 1, fontSize: 16 }}
                            autoFocus
                        />
                        <IconButton type="submit" disabled={!inputValue.trim() || isLoadingPosts}>
                            {isLoadingPosts ? <CircularProgress size={24} /> : <SearchIcon />}
                        </IconButton>
                    </Box>

                    {/* Results */}
                    {isLoadingPosts ? (
                        // Loading skeletons
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
                    ) : !isLoadingPosts && posts.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 5 }}>
                            <SearchIcon sx={{ fontSize: 64, color: '#bcc0c4', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary">
                                {urlQuery ? `Không tìm thấy kết quả cho "${urlQuery}"` : 'Nhập từ khóa để tìm kiếm'}
                            </Typography>
                            <Typography color="text.secondary">
                                {urlQuery ? 'Thử tìm kiếm với từ khóa khác' : 'Tìm kiếm bài viết, người dùng, nhóm...'}
                            </Typography>
                        </Box>
                    ) : (
                        <>
                            {/* Posts */}
                            {posts.map((post) => {
                                const PrivacyIconComponent = getPrivacyIcon(post.privacy);
                                // Check if post belongs to a group
                                const groupInfo = post.groupId && typeof post.groupId === 'object' ? post.groupId : null;
                                const isGroupPost = !!groupInfo;

                                return (
                                    <PostItem
                                        key={post._id}
                                        post={post}
                                        userId={user?.id || ''}
                                        handleOpenMenu={handleOpenMenu}
                                        handleOpenComments={handleOpenComments}
                                        handleOpenShare={handleOpenShare}
                                        renderPostMedia={renderPostMedia}
                                        PrivacyIconComponent={PrivacyIconComponent}
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
                                        <Typography sx={{ color: textSecondary, fontSize: 14 }}>Đang tải thêm bài viết...</Typography>
                                    </Box>
                                )}
                                {!hasNextPage && posts.length > 0 && !isFetchingNextPage && (
                                    <Typography sx={{ color: textSecondary, fontSize: 14, textAlign: 'center' }}>
                                        🎉 Đã hết bài viết. Bạn đã xem tất cả!
                                    </Typography>
                                )}
                            </Box>

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
                        </>
                    )}
                </Box>
            </Box>
        </Box>
    );
}

// Wrapper with Suspense for useSearchParams
export default function SearchPage() {
    return (
        <Suspense fallback={
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', bgcolor: 'background.default' }}>
                <CircularProgress sx={{ color: 'primary.main' }} />
            </Box>
        }>
            <SearchContent />
        </Suspense>
    );
}
