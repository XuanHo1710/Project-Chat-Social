'use client';

import {
    Box, Card, CardContent, Avatar, Typography, IconButton, Divider,
    Modal, Button, Menu, MenuItem, ListItemIcon, InputBase
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
    PersonAdd as PersonAddIcon,
    Gif as GifIcon,
    SentimentSatisfiedAlt as EmojiIcon,
    LocationOn as LocationIcon,
    Favorite as FavoriteIcon,
    RemoveCircleOutline as RemoveIcon,
    BookmarkBorder as BookmarkBorderIcon,
    NotificationsActive as NotificationIcon,
    Info as InfoIcon,
    Report as ReportIcon,
    Block as BlockIcon,
    VisibilityOff as HideIcon,
    Send as SendIcon,
} from '@mui/icons-material';
import { useAuthStore } from '@/stores/useAuthStore';
import { useState, useRef } from 'react';

const stories = [
    { name: 'Tạo tin', isCreate: true },
    { name: 'Đức Khoa Quach', avatar: '/avatar1.jpg' },
    { name: '28Tech', avatar: '/avatar2.jpg' },
    { name: 'Anime - My Heart', avatar: '/avatar3.jpg' },
    { name: 'Trường Đại học Khoa học...', avatar: '/avatar4.jpg' },
    { name: 'VTV24', avatar: '/avatar5.jpg' },
    { name: 'F8 - Học Lập Trình', avatar: '/avatar6.jpg' },
];

const backgroundColors = [
    { id: 'none', color: 'transparent', preview: 'white' },
    { id: 'gradient1', color: 'linear-gradient(135deg, #f5af19, #f12711)', preview: 'linear-gradient(135deg, #f5af19, #f12711)' },
    { id: 'gradient2', color: 'linear-gradient(135deg, #667eea, #764ba2)', preview: 'linear-gradient(135deg, #667eea, #764ba2)' },
    { id: 'solid1', color: '#e91e63', preview: '#e91e63' },
    { id: 'solid2', color: '#000000', preview: '#000000' },
    { id: 'gradient3', color: 'linear-gradient(135deg, #4facfe, #00f2fe)', preview: 'linear-gradient(135deg, #4facfe, #00f2fe)' },
    { id: 'gradient4', color: 'linear-gradient(135deg, #fa709a, #fee140)', preview: 'linear-gradient(135deg, #fa709a, #fee140)' },
    { id: 'solid3', color: '#9c88ff', preview: '#9c88ff' },
    { id: 'solid4', color: '#f0f2f5', preview: '#f0f2f5' },
];

const initialPosts = [
    {
        id: 1,
        author: 'IUH - Đại học Công nghiệp TP Hồ Chí Minh',
        authorAvatar: '',
        time: '8 phút',
        content: 'TRƯỜNG OI, SAO BÊN WEB VẪN CHƯA HIỆN CÔNG NỢ VẬY A. VẬY ĐÓNG HỌC PHÍ KIỂU GÌ ĐÂY A, NAY NGÀY 15 RỒI HHHHHH',
        image: null,
        background: null,
        likes: 143,
        comments: 8,
        shares: 21,
        isLiked: false,
    },
    {
        id: 2,
        author: 'Dior',
        authorAvatar: '',
        time: '2 giờ',
        content: 'SAUVAGE ELIXIR: ĐIỂM SÁNG CỦA BUỔI TỐI\nDưới lều sao lộng lẫy của Dior Circus of Dreams...',
        image: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=800',
        background: null,
        likes: 2500,
        comments: 156,
        shares: 89,
        isLiked: true,
        isSponsored: true,
    },
];

const mockComments = [
    {
        id: 1,
        author: 'TD88',
        avatar: '',
        content: 'Mùi thơm nam tính khỏi chê',
        time: '1 tuần',
        likes: 45,
        isVerified: true,
    },
    {
        id: 2,
        author: 'F88 100 Bà Triều',
        avatar: '',
        content: 'Sản phẩm tuyệt vời!',
        time: '3 ngày',
        likes: 12,
    },
];

export default function Feed() {
    const { user } = useAuthStore();
    const storiesRef = useRef<HTMLDivElement>(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(true);

    // Create Post Modal
    const [openCreatePost, setOpenCreatePost] = useState(false);
    const [postContent, setPostContent] = useState('');
    const [selectedBackground, setSelectedBackground] = useState('none');
    const [showBackgrounds, setShowBackgrounds] = useState(false);

    // Post Options Menu
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

    // Comment Modal
    const [openCommentModal, setOpenCommentModal] = useState(false);
    const [commentingPost, setCommentingPost] = useState<typeof initialPosts[0] | null>(null);
    const [commentText, setCommentText] = useState('');

    // Posts state
    const [posts, setPosts] = useState(initialPosts);

    const scrollStories = (direction: 'left' | 'right') => {
        if (storiesRef.current) {
            const scrollAmount = 300;
            const newScrollLeft = direction === 'left'
                ? storiesRef.current.scrollLeft - scrollAmount
                : storiesRef.current.scrollLeft + scrollAmount;

            storiesRef.current.scrollTo({
                left: newScrollLeft,
                behavior: 'smooth'
            });

            setTimeout(() => {
                if (storiesRef.current) {
                    setShowLeftArrow(storiesRef.current.scrollLeft > 0);
                    setShowRightArrow(
                        storiesRef.current.scrollLeft <
                        storiesRef.current.scrollWidth - storiesRef.current.clientWidth - 10
                    );
                }
            }, 300);
        }
    };

    const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
        setMenuAnchor(event.currentTarget);
    };

    const handleCloseMenu = () => {
        setMenuAnchor(null);
    };

    const handleOpenComments = (post: typeof initialPosts[0]) => {
        setCommentingPost(post);
        setOpenCommentModal(true);
    };

    const handleLikePost = (postId: number) => {
        setPosts(posts.map(post =>
            post.id === postId
                ? { ...post, isLiked: !post.isLiked, likes: post.isLiked ? post.likes - 1 : post.likes + 1 }
                : post
        ));
    };

    const getSelectedBg = () => {
        const bg = backgroundColors.find(b => b.id === selectedBackground);
        return bg?.color || 'transparent';
    };

    return (
        <Box sx={{ maxWidth: 680, mx: 'auto', py: 2, px: { xs: 1, sm: 2 } }}>
            {/* Stories Section - Carousel */}
            <Card sx={{ mb: 2, borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.1)', position: 'relative' }}>
                <Box sx={{ position: 'relative' }}>
                    <Box
                        ref={storiesRef}
                        sx={{
                            p: 2,
                            display: 'flex',
                            gap: 1,
                            overflowX: 'hidden',
                            scrollBehavior: 'smooth',
                            '&::-webkit-scrollbar': { display: 'none' }
                        }}
                    >
                        {stories.map((story, index) => (
                            <Box
                                key={index}
                                sx={{
                                    minWidth: 110,
                                    height: 190,
                                    borderRadius: 2,
                                    overflow: 'hidden',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    border: story.isCreate ? '1px solid #e4e6eb' : 'none',
                                    bgcolor: story.isCreate ? 'white' : '#1877f2',
                                    backgroundImage: story.isCreate ? 'none' : 'linear-gradient(135deg, #1877f2 0%, #1a2a6c 100%)',
                                    '&:hover': { opacity: 0.9 },
                                }}
                            >
                                {story.isCreate ? (
                                    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                        <Box sx={{ flex: 1, bgcolor: '#f0f2f5', position: 'relative' }}>
                                            <Avatar
                                                sx={{
                                                    width: '100%',
                                                    height: '100%',
                                                    borderRadius: 0,
                                                }}
                                                src={user?.avatar}
                                            />
                                        </Box>
                                        <Box sx={{
                                            position: 'absolute',
                                            bottom: 30,
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            bgcolor: '#1877f2',
                                            borderRadius: '50%',
                                            width: 36,
                                            height: 36,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '4px solid white',
                                        }}>
                                            <AddIcon sx={{ color: 'white', fontSize: 20 }} />
                                        </Box>
                                        <Typography sx={{ fontSize: '13px', fontWeight: 600, textAlign: 'center', py: 1, color: '#050505' }}>
                                            Tạo tin
                                        </Typography>
                                    </Box>
                                ) : (
                                    <>
                                        <Avatar
                                            sx={{
                                                width: 40,
                                                height: 40,
                                                position: 'absolute',
                                                top: 12,
                                                left: 12,
                                                border: '4px solid #1877f2',
                                            }}
                                        />
                                        <Typography
                                            sx={{
                                                position: 'absolute',
                                                bottom: 12,
                                                left: 12,
                                                right: 12,
                                                color: 'white',
                                                fontSize: '13px',
                                                fontWeight: 600,
                                                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                                            }}
                                        >
                                            {story.name}
                                        </Typography>
                                    </>
                                )}
                            </Box>
                        ))}
                    </Box>

                    {/* Navigation Arrows */}
                    {showLeftArrow && (
                        <IconButton
                            onClick={() => scrollStories('left')}
                            sx={{
                                position: 'absolute',
                                left: 8,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                bgcolor: 'white',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                width: 48,
                                height: 48,
                                zIndex: 1,
                                '&:hover': { bgcolor: '#f0f2f5' },
                            }}
                        >
                            <ArrowBackIcon />
                        </IconButton>
                    )}
                    {showRightArrow && (
                        <IconButton
                            onClick={() => scrollStories('right')}
                            sx={{
                                position: 'absolute',
                                right: 8,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                bgcolor: 'white',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                width: 48,
                                height: 48,
                                zIndex: 1,
                                '&:hover': { bgcolor: '#f0f2f5' },
                            }}
                        >
                            <ArrowForwardIcon />
                        </IconButton>
                    )}
                </Box>
            </Card>

            {/* Create Post */}
            <Card sx={{ mb: 2, borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <Avatar sx={{ width: 40, height: 40 }} src={user?.avatar || '/avatar-placeholder.jpg'} />
                        <Box
                            onClick={() => setOpenCreatePost(true)}
                            sx={{
                                flex: 1,
                                bgcolor: '#f0f2f5',
                                borderRadius: '50px',
                                display: 'flex',
                                alignItems: 'center',
                                px: 2,
                                py: 1.5,
                                cursor: 'pointer',
                                '&:hover': { bgcolor: '#e4e6eb' },
                            }}
                        >
                            <Typography sx={{ color: '#050505', fontSize: 17 }}>
                                {user?.fullName || user?.username || 'Bạn'} ơi, bạn đang nghĩ gì thế?
                            </Typography>
                        </Box>
                    </Box>

                    <Divider sx={{ mb: 1 }} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-around' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 2, cursor: 'pointer', borderRadius: 2, '&:hover': { bgcolor: '#f0f2f5' } }}>
                            <VideoIcon sx={{ color: '#f3425f' }} />
                            <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#050505' }}>Video trực tiếp</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 2, cursor: 'pointer', borderRadius: 2, '&:hover': { bgcolor: '#f0f2f5' } }}>
                            <PhotoIcon sx={{ color: '#45bd62' }} />
                            <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#050505' }}>Ảnh/video</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 2, cursor: 'pointer', borderRadius: 2, '&:hover': { bgcolor: '#f0f2f5' } }}>
                            <MoodIcon sx={{ color: '#f7b928' }} />
                            <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#050505' }}>Cảm xúc</Typography>
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            {/* Posts */}
            {posts.map((post) => (
                <Card key={post.id} sx={{ mb: 2, borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                    <CardContent sx={{ p: 2 }}>
                        {/* Post Header */}
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <Avatar sx={{ width: 40, height: 40, mr: 1.5 }} src={post.authorAvatar} />
                            <Box sx={{ flex: 1 }}>
                                <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#050505' }}>
                                    {post.author}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    {'isSponsored' in post && post.isSponsored && (
                                        <Typography sx={{ fontSize: '13px', color: '#050505' }}>Được tài trợ · </Typography>
                                    )}
                                    <Typography sx={{ fontSize: '13px', color: '#050505' }}>{post.time}</Typography>
                                    <Typography sx={{ fontSize: '13px', color: '#050505' }}> · </Typography>
                                    <PublicIcon sx={{ fontSize: '12px', color: '#050505' }} />
                                </Box>
                            </Box>
                            <IconButton onClick={handleOpenMenu}>
                                <MoreIcon />
                            </IconButton>
                            <IconButton>
                                <CloseIcon />
                            </IconButton>
                        </Box>

                        {/* Post Content */}
                        {post.background ? (
                            <Box
                                sx={{
                                    background: post.background,
                                    borderRadius: 2,
                                    p: 4,
                                    minHeight: 200,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    mb: 2,
                                }}
                            >
                                <Typography sx={{ fontSize: 24, fontWeight: 700, color: 'white', textAlign: 'center' }}>
                                    {post.content}
                                </Typography>
                            </Box>
                        ) : (
                            <Typography sx={{ mb: 2, fontSize: '15px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                {post.content}
                            </Typography>
                        )}

                        {/* Post Image */}
                        {post.image && (
                            <Box
                                component="img"
                                src={post.image}
                                alt="Post"
                                sx={{ width: '100%', borderRadius: 1, mb: 2, cursor: 'pointer' }}
                            />
                        )}

                        {/* Like/Comment Count */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Box sx={{
                                    width: 18, height: 18, borderRadius: '50%', bgcolor: '#1877f2',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <ThumbUpIcon sx={{ fontSize: 12, color: 'white' }} />
                                </Box>
                                <Typography sx={{ fontSize: 15, color: '#050505' }}>{post.likes}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <Typography
                                    sx={{ fontSize: 15, color: '#050505', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                                    onClick={() => handleOpenComments(post)}
                                >
                                    {post.comments} bình luận
                                </Typography>
                                <Typography sx={{ fontSize: 15, color: '#050505' }}>{post.shares} lượt chia sẻ</Typography>
                            </Box>
                        </Box>

                        <Divider sx={{ my: 1 }} />

                        {/* Post Actions */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-around' }}>
                            <Box
                                onClick={() => handleLikePost(post.id)}
                                sx={{
                                    display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 2,
                                    cursor: 'pointer', borderRadius: 2, flex: 1, justifyContent: 'center',
                                    '&:hover': { bgcolor: '#f0f2f5' },
                                }}
                            >
                                {post.isLiked ? (
                                    <ThumbUpIcon sx={{ fontSize: '20px', color: '#1877f2' }} />
                                ) : (
                                    <ThumbUpOutlinedIcon sx={{ fontSize: '20px', color: '#050505' }} />
                                )}
                                <Typography sx={{ fontSize: '15px', fontWeight: 600, color: post.isLiked ? '#1877f2' : '#050505' }}>
                                    Thích
                                </Typography>
                            </Box>

                            <Box
                                onClick={() => handleOpenComments(post)}
                                sx={{
                                    display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 2,
                                    cursor: 'pointer', borderRadius: 2, flex: 1, justifyContent: 'center',
                                    '&:hover': { bgcolor: '#f0f2f5' },
                                }}
                            >
                                <CommentIcon sx={{ fontSize: '20px', color: '#050505' }} />
                                <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#050505' }}>Bình luận</Typography>
                            </Box>

                            <Box
                                sx={{
                                    display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 2,
                                    cursor: 'pointer', borderRadius: 2, flex: 1, justifyContent: 'center',
                                    '&:hover': { bgcolor: '#f0f2f5' },
                                }}
                            >
                                <ShareIcon sx={{ fontSize: '20px', color: '#050505' }} />
                                <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#050505' }}>Chia sẻ</Typography>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>
            ))}

            {/* Create Post Modal */}
            <Modal open={openCreatePost} onClose={() => setOpenCreatePost(false)}>
                <Box sx={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    width: 500, bgcolor: 'white', borderRadius: 2, boxShadow: 24, overflow: 'hidden',
                }}>
                    {/* Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, borderBottom: '1px solid #e4e6eb', position: 'relative' }}>
                        <Typography sx={{ fontSize: 20, fontWeight: 700, color: "black" }}>Tạo bài viết</Typography>
                        <IconButton
                            onClick={() => setOpenCreatePost(false)}
                            sx={{ position: 'absolute', right: 12, bgcolor: '#e4e6eb', '&:hover': { bgcolor: '#d8dadf' } }}
                        >
                            <CloseIcon />
                        </IconButton>
                    </Box>

                    {/* User Info */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2 }}>
                        <Avatar sx={{ width: 40, height: 40 }} src={user?.avatar} />
                        <Box>
                            <Typography sx={{ fontWeight: 600, fontSize: 15, color: "black" }}>{user?.fullName || user?.username}</Typography>
                            <Button
                                size="small"
                                startIcon={<LockIcon sx={{ fontSize: 12 }} />}
                                endIcon={<ArrowDownIcon />}
                                sx={{
                                    bgcolor: '#e4e6eb', color: '#050505', textTransform: 'none',
                                    fontSize: 12, fontWeight: 600, px: 1, py: 0.25,
                                    '&:hover': { bgcolor: '#d8dadf' },
                                }}
                            >
                                Chỉ mình tôi
                            </Button>
                        </Box>
                    </Box>

                    {/* Content Area */}
                    <Box sx={{
                        p: 2,
                        minHeight: selectedBackground !== 'none' ? 200 : 100,
                        background: getSelectedBg(),
                        display: 'flex',
                        alignItems: selectedBackground !== 'none' ? 'center' : 'flex-start',
                        justifyContent: selectedBackground !== 'none' ? 'center' : 'flex-start',
                    }}>
                        <InputBase
                            multiline
                            fullWidth
                            placeholder={`${user?.fullName || 'Hồ'} ơi, bạn đang nghĩ gì thế?`}
                            value={postContent}
                            onChange={(e) => setPostContent(e.target.value)}
                            sx={{
                                fontSize: selectedBackground !== 'none' ? 24 : 24,
                                fontWeight: selectedBackground !== 'none' ? 700 : 400,
                                color: selectedBackground !== 'none' && selectedBackground !== 'solid4' ? 'white' : '#050505',
                                textAlign: selectedBackground !== 'none' ? 'center' : 'left',
                                '& textarea': {
                                    textAlign: selectedBackground !== 'none' ? 'center' : 'left',
                                },
                            }}
                        />
                    </Box>

                    {/* Background Selector */}
                    {showBackgrounds && (
                        <Box sx={{ px: 2, pb: 1, display: 'flex', gap: 0.5, alignItems: 'center' }}>
                            <IconButton onClick={() => setShowBackgrounds(false)} size="small">
                                <ArrowBackIcon sx={{ fontSize: 20 }} />
                            </IconButton>
                            {backgroundColors.map((bg) => (
                                <Box
                                    key={bg.id}
                                    onClick={() => setSelectedBackground(bg.id)}
                                    sx={{
                                        width: 32, height: 32, borderRadius: 1, cursor: 'pointer',
                                        background: bg.preview, border: selectedBackground === bg.id ? '2px solid #1877f2' : '1px solid #e4e6eb',
                                    }}
                                />
                            ))}
                        </Box>
                    )}

                    {/* Tools */}
                    <Box sx={{ px: 2, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Box
                                onClick={() => setShowBackgrounds(!showBackgrounds)}
                                sx={{
                                    width: 36, height: 36, borderRadius: 1, cursor: 'pointer',
                                    background: 'linear-gradient(135deg, #f5af19, #f12711)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: '2px solid transparent',
                                    '&:hover': { opacity: 0.8 },
                                }}
                            >
                                <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 14 }}>Aa</Typography>
                            </Box>
                            <IconButton><EmojiIcon sx={{ color: '#f7b928' }} /></IconButton>
                        </Box>
                    </Box>

                    {/* Add to Post */}
                    <Box sx={{
                        mx: 2, mb: 2, p: 1.5, border: '1px solid #e4e6eb', borderRadius: 2,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                        <Typography sx={{ fontWeight: 600, fontSize: 15, color: "black" }}>Thêm vào bài viết của bạn</Typography>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <IconButton size="small"><PhotoIcon sx={{ color: '#45bd62' }} /></IconButton>
                            <IconButton size="small"><PersonAddIcon sx={{ color: '#1877f2' }} /></IconButton>
                            <IconButton size="small"><EmojiIcon sx={{ color: '#f7b928' }} /></IconButton>
                            <IconButton size="small"><LocationIcon sx={{ color: '#f3425f' }} /></IconButton>
                            <IconButton size="small"><GifIcon sx={{ color: '#45bd62' }} /></IconButton>
                            <IconButton size="small"><MoreIcon /></IconButton>
                        </Box>
                    </Box>

                    {/* Submit Button */}
                    <Box sx={{ px: 2, pb: 2 }}>
                        <Button
                            fullWidth
                            variant="contained"
                            disabled={!postContent.trim()}
                            sx={{
                                bgcolor: postContent.trim() ? '#1877f2' : '#e4e6eb',
                                color: postContent.trim() ? 'white' : '#bcc0c4',
                                textTransform: 'none', fontWeight: 700, fontSize: 15, py: 1,
                                '&:hover': { bgcolor: postContent.trim() ? '#166fe5' : '#e4e6eb' },
                                '&.Mui-disabled': { bgcolor: '#e4e6eb', color: '#bcc0c4' },
                            }}
                        >
                            Đăng
                        </Button>
                    </Box>
                </Box>
            </Modal>

            {/* Post Options Menu */}
            <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={handleCloseMenu}
                PaperProps={{
                    sx: { width: 320, borderRadius: 2, boxShadow: '0 2px 12px rgba(0,0,0,0.15)', mt: 1 }
                }}
            >
                <MenuItem sx={{ py: 1.5 }}>
                    <ListItemIcon><FavoriteIcon /></ListItemIcon>
                    <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: 15 }}>Quan tâm</Typography>
                        <Typography sx={{ fontSize: 12, color: '#050505' }}>Bạn sẽ nhìn thấy nhiều bài viết tương tự hơn.</Typography>
                    </Box>
                </MenuItem>
                <MenuItem sx={{ py: 1.5 }}>
                    <ListItemIcon><RemoveIcon /></ListItemIcon>
                    <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: 15 }}>Không quan tâm</Typography>
                        <Typography sx={{ fontSize: 12, color: '#050505' }}>Bạn sẽ nhìn thấy ít bài viết tương tự hơn.</Typography>
                    </Box>
                </MenuItem>
                <Divider />
                <MenuItem sx={{ py: 1.5 }}>
                    <ListItemIcon><BookmarkBorderIcon /></ListItemIcon>
                    <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: 15 }}>Lưu bài viết</Typography>
                        <Typography sx={{ fontSize: 12, color: '#050505' }}>Thêm vào danh sách mục đã lưu.</Typography>
                    </Box>
                </MenuItem>
                <Divider />
                <MenuItem sx={{ py: 1.5 }}>
                    <ListItemIcon><NotificationIcon /></ListItemIcon>
                    <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: 15 }}>Bật thông báo về bài viết này</Typography>
                    </Box>
                </MenuItem>
                <MenuItem sx={{ py: 1.5 }}>
                    <ListItemIcon><InfoIcon /></ListItemIcon>
                    <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: 15 }}>Tại sao tôi nhìn thấy bài viết này?</Typography>
                    </Box>
                </MenuItem>
                <Divider />
                <MenuItem sx={{ py: 1.5 }}>
                    <ListItemIcon><ReportIcon /></ListItemIcon>
                    <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: 15 }}>Báo cáo bài viết với quản trị viên nhóm</Typography>
                    </Box>
                </MenuItem>
                <MenuItem sx={{ py: 1.5 }}>
                    <ListItemIcon><HideIcon /></ListItemIcon>
                    <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: 15 }}>Ẩn bài viết</Typography>
                        <Typography sx={{ fontSize: 12, color: '#050505' }}>Ẩn bớt các bài viết tương tự.</Typography>
                    </Box>
                </MenuItem>
                <MenuItem sx={{ py: 1.5 }}>
                    <ListItemIcon><BlockIcon /></ListItemIcon>
                    <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: 15 }}>Tạm ẩn trong 30 ngày</Typography>
                        <Typography sx={{ fontSize: 12, color: '#050505' }}>Tạm thời không nhìn thấy bài viết nữa.</Typography>
                    </Box>
                </MenuItem>
                <MenuItem sx={{ py: 1.5 }}>
                    <ListItemIcon><CloseIcon /></ListItemIcon>
                    <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: 15 }}>Bỏ theo dõi</Typography>
                        <Typography sx={{ fontSize: 12, color: '#050505' }}>Không nhìn thấy bài viết nữa nhưng vẫn ở trong nhóm.</Typography>
                    </Box>
                </MenuItem>
            </Menu>

            {/* Comment Modal */}
            <Modal open={openCommentModal} onClose={() => setOpenCommentModal(false)}>
                <Box sx={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    width: 700, maxHeight: '90vh', bgcolor: 'white', borderRadius: 2, boxShadow: 24,
                    display: 'flex', flexDirection: 'column', overflow: 'hidden',
                }}>
                    {/* Header */}
                    <Box sx={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        p: 2, borderBottom: '1px solid #e4e6eb', position: 'relative'
                    }}>
                        <Typography sx={{ fontSize: 20, fontWeight: 700, color: "black" }}>
                            Bài viết của {commentingPost?.author}
                        </Typography>
                        <IconButton
                            onClick={() => setOpenCommentModal(false)}
                            sx={{ position: 'absolute', right: 12, bgcolor: '#e4e6eb', '&:hover': { bgcolor: '#d8dadf' } }}
                        >
                            <CloseIcon />
                        </IconButton>
                    </Box>

                    {/* Post Content */}
                    <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                        {commentingPost?.image && (
                            <Box
                                component="img"
                                src={commentingPost.image}
                                alt="Post"
                                sx={{ width: '100%', borderRadius: 1, mb: 2 }}
                            />
                        )}

                        {!commentingPost?.image && (
                            <Typography sx={{ mb: 2, fontSize: 15, color: "black" }}>{commentingPost?.content}</Typography>
                        )}

                        {/* Like Count */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Box sx={{
                                    width: 18, height: 18, borderRadius: '50%', bgcolor: '#1877f2',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <ThumbUpIcon sx={{ fontSize: 12, color: 'white' }} />
                                </Box>
                                <Typography sx={{ fontSize: 15, color: '#050505' }}>{commentingPost?.likes}</Typography>
                            </Box>
                            <Typography sx={{ fontSize: 15, color: '#050505' }}>
                                {commentingPost?.comments} bình luận · {commentingPost?.shares} lượt chia sẻ
                            </Typography>
                        </Box>

                        <Divider sx={{ my: 1 }} />

                        {/* Actions */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-around', mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}>
                                <ThumbUpOutlinedIcon sx={{ color: '#050505' }} />
                                <Typography sx={{ color: '#050505', fontWeight: 600 }}>Thích</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}>
                                <CommentIcon sx={{ color: '#050505' }} />
                                <Typography sx={{ color: '#050505', fontWeight: 600 }}>Bình luận</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}>
                                <ShareIcon sx={{ color: '#050505' }} />
                                <Typography sx={{ color: '#050505', fontWeight: 600 }}>Chia sẻ</Typography>
                            </Box>
                        </Box>

                        <Divider sx={{ mb: 2 }} />

                        {/* Comments Section */}
                        <Typography sx={{ fontSize: 14, fontWeight: 600, mb: 2, color: '#050505' }}>
                            Tất cả bình luận ▼
                        </Typography>

                        {mockComments.map((comment) => (
                            <Box key={comment.id} sx={{ display: 'flex', gap: 1, mb: 2 }}>
                                <Avatar sx={{ width: 32, height: 32 }} src={comment.avatar} />
                                <Box sx={{ flex: 1 }}>
                                    <Box sx={{ bgcolor: '#f0f2f5', borderRadius: 2, px: 1.5, py: 1, display: 'inline-block' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Typography sx={{ fontWeight: 600, color: "black", fontSize: 13 }}>{comment.author}</Typography>
                                            {comment.isVerified && (
                                                <Box sx={{
                                                    width: 14, height: 14, borderRadius: '50%', bgcolor: '#1877f2',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    <Typography sx={{ color: 'white', fontSize: 10 }}>✓</Typography>
                                                </Box>
                                            )}
                                            <Typography sx={{ fontSize: 13, color: '#050505' }}>· Theo dõi</Typography>
                                        </Box>
                                        <Typography sx={{ fontSize: 15, color: "black" }}>{comment.content}</Typography>
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

                    {/* Comment Input */}
                    <Box sx={{ p: 2, borderTop: '1px solid #e4e6eb', display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Avatar sx={{ width: 32, height: 32 }} src={user?.avatar} />
                        <Box sx={{
                            flex: 1, bgcolor: '#f0f2f5', borderRadius: '20px', px: 2, py: 1,
                            display: 'flex', alignItems: 'center', gap: 1
                        }}>
                            <InputBase
                                fullWidth
                                placeholder="Viết bình luận..."
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                sx={{ fontSize: 15 }}
                            />
                            <IconButton size="small"><EmojiIcon sx={{ fontSize: 20, color: '#050505' }} /></IconButton>
                            <IconButton size="small"><GifIcon sx={{ fontSize: 20, color: '#050505' }} /></IconButton>
                        </Box>
                        <IconButton disabled={!commentText.trim()}>
                            <SendIcon sx={{ color: commentText.trim() ? '#1877f2' : '#bcc0c4' }} />
                        </IconButton>
                    </Box>
                </Box>
            </Modal>
        </Box>
    );
}
