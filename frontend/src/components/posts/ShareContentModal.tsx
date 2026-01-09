import {
    Box, Avatar, Typography, IconButton, Button, InputBase, Menu, MenuItem, ListItemIcon, ListItemText, CircularProgress
} from '@mui/material';
import {
    MoreHoriz as MoreIcon,
    Public as PublicIcon,
    ArrowBack as ArrowBackIcon,
    Close as CloseIcon,
    Lock as LockIcon,
    KeyboardArrowDown as ArrowDownIcon,
    SentimentSatisfiedAlt as EmojiIcon,
    People as PeopleIcon,
    Link as LinkIcon,
    Groups as GroupsIcon,
    Person as PersonIcon,
    WhatsApp as WhatsAppIcon,
    Message as MessageIcon,
    Check as CheckIcon,
} from '@mui/icons-material';
import { PostPrivacy, PostType } from '@/types/post';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { UserLoginType } from '@/types/account';
import { useState } from 'react';
import SharePostModal from './SharePostModal';
import { useDisplayListFriends } from '@/queries/useRelationshipQueries';
import { postService } from '@/services/post.service';
import { toast } from 'sonner';
import { usePostStore } from '@/stores/usePostStore';

// Privacy options
const privacyOptions = [
    { id: 'PUBLIC' as PostPrivacy, icon: PublicIcon, label: 'Công khai', description: 'Bất kỳ ai ở trên hoặc ngoài Facebook' },
    { id: 'FRIEND' as PostPrivacy, icon: PeopleIcon, label: 'Bạn bè', description: 'Bạn bè của bạn trên Facebook' },
    { id: 'PRIVATE' as PostPrivacy, icon: LockIcon, label: 'Chỉ mình tôi', description: 'Chỉ mình bạn' },
];

// Share options
const shareOptions = [
    { id: 'messenger', icon: MessageIcon, label: 'Messenger', color: '#0084ff' },
    { id: 'whatsapp', icon: WhatsAppIcon, label: 'WhatsApp', color: '#25d366' },
    { id: 'copy', icon: LinkIcon, label: 'Sao chép liên kết', color: '#65676b' },
    { id: 'groups', icon: GroupsIcon, label: 'Nhóm', color: '#65676b' },
    { id: 'profile', icon: PersonIcon, label: 'Trang cá nhân của bạn bè', color: '#65676b' },
];


export default function ShareContentModal({ handleCloseShare, user, sharePrivacy: initialSharePrivacy, shareCaption, setShareCaption, showEmojiPicker, setShowEmojiPicker, handleEmojiSelect, sharingPost }: { handleCloseShare: () => void, user: UserLoginType | null, sharePrivacy: string, shareCaption: string, setShareCaption: React.Dispatch<React.SetStateAction<string>>, showEmojiPicker: boolean, setShowEmojiPicker: React.Dispatch<React.SetStateAction<boolean>>, handleEmojiSelect: (emoji: { native: string }) => void, sharingPost: PostType | null }) {
    // Local state for privacy selection
    const [sharePrivacy, setSharePrivacy] = useState<PostPrivacy>(initialSharePrivacy as PostPrivacy || 'PUBLIC');
    const [privacyAnchor, setPrivacyAnchor] = useState<null | HTMLElement>(null);
    const [isSharing, setIsSharing] = useState(false);

    const { addPost, incrementShareCount } = usePostStore();

    const getSharePrivacyLabel = () => privacyOptions.find(p => p.id === sharePrivacy)?.label || 'Công khai';
    const getSharePrivacyIcon = () => {
        const option = privacyOptions.find(p => p.id === sharePrivacy);
        return option ? option.icon : PublicIcon;
    };
    const PrivacyIcon = getSharePrivacyIcon();

    // State for messenger share modal
    const [openMessengerShare, setOpenMessengerShare] = useState(false);
    const { data: friendsData, isLoading: friendsLoading } = useDisplayListFriends(user?.id || "");

    // Handle privacy menu
    const handleOpenPrivacyMenu = (event: React.MouseEvent<HTMLElement>) => {
        setPrivacyAnchor(event.currentTarget);
    };

    const handleClosePrivacyMenu = () => {
        setPrivacyAnchor(null);
    };

    const handleSelectPrivacy = (privacy: PostPrivacy) => {
        setSharePrivacy(privacy);
        handleClosePrivacyMenu();
    };

    // Handle share post
    const handleSharePost = async () => {
        if (!sharingPost || !user) return;

        setIsSharing(true);
        try {
            const response = await postService.createPost({
                userId: user.id,
                content: shareCaption || '',
                privacy: sharePrivacy,
                sharedPostId: sharingPost._id,
            });

            if (response.data) {
                addPost(response.data);
                // Increment share count on original post
                incrementShareCount(sharingPost._id);
                toast.success('Chia sẻ bài viết thành công!');
                handleCloseShare();
            }
        } catch (error) {
            console.error('Error sharing post:', error);
            toast.error('Lỗi khi chia sẻ bài viết');
        } finally {
            setIsSharing(false);
        }
    };


    return (
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 550, bgcolor: 'white', borderRadius: 2, boxShadow: 24, overflow: 'hidden', zIndex: 100 }}>
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
                                startIcon={<PrivacyIcon sx={{ fontSize: 12 }} />}
                                endIcon={<ArrowDownIcon />}
                                onClick={handleOpenPrivacyMenu}
                                sx={{ bgcolor: '#e4e6eb', color: '#050505', textTransform: 'none', fontSize: 12, fontWeight: 600, px: 1, py: 0.25, borderRadius: 1, '&:hover': { bgcolor: '#d8dadf' } }}
                            >
                                {getSharePrivacyLabel()}
                            </Button>
                            <Menu
                                anchorEl={privacyAnchor}
                                open={Boolean(privacyAnchor)}
                                onClose={handleClosePrivacyMenu}
                                PaperProps={{
                                    sx: { width: 300, borderRadius: 2, mt: 1 }
                                }}
                            >
                                <Typography sx={{ px: 2, py: 1, fontWeight: 700, fontSize: 16, color: '#050505' }}>
                                    Ai có thể xem bài viết này?
                                </Typography>
                                {privacyOptions.map((option) => (
                                    <MenuItem
                                        key={option.id}
                                        onClick={() => handleSelectPrivacy(option.id)}
                                        sx={{
                                            py: 1.5,
                                            '&:hover': { bgcolor: '#f0f2f5' }
                                        }}
                                    >
                                        <ListItemIcon>
                                            <Box sx={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: '50%',
                                                bgcolor: '#e4e6eb',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <option.icon sx={{ color: '#050505' }} />
                                            </Box>
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={option.label}
                                            secondary={option.description}
                                            primaryTypographyProps={{ fontWeight: 600, fontSize: 15, color: '#050505' }}
                                            secondaryTypographyProps={{ fontSize: 13, color: '#65676b' }}
                                        />
                                        {sharePrivacy === option.id && (
                                            <CheckIcon sx={{ color: '#1877f2' }} />
                                        )}
                                    </MenuItem>
                                ))}
                            </Menu>
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
                    onClick={handleSharePost}
                    disabled={isSharing}
                    sx={{
                        bgcolor: '#1877f2',
                        color: 'white',
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: 15,
                        py: 1,
                        borderRadius: 2,
                        '&:hover': { bgcolor: '#166fe5' },
                        '&:disabled': { bgcolor: '#e4e6eb', color: '#bcc0c4' }
                    }}
                >
                    {isSharing ? <CircularProgress size={24} sx={{ color: 'white' }} /> : 'Chia sẻ ngay'}
                </Button>
            </Box>

            {/* Send via Messenger */}
            <Box sx={{ px: 2, pb: 2 }}>
                <Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505', mb: 1.5 }}>Gửi bằng Messenger</Typography>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', position: 'relative' }}>
                    <IconButton sx={{ p: 0 }}>
                        <ArrowBackIcon sx={{ color: '#65676b' }} />
                    </IconButton>
                    {!friendsLoading && friendsData && friendsData?.data.map((friend) => (
                        <Box
                            key={friend._id}
                            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
                            onClick={() => setOpenMessengerShare(true)}
                        >
                            <Box sx={{ position: 'relative' }}>
                                <Avatar sx={{ width: 56, height: 56 }} src={friend.avatar} />
                                {friend.status === "ACTIVE" && (
                                    <Box sx={{
                                        position: 'absolute', bottom: 2, right: 2,
                                        width: 14, height: 14, borderRadius: '50%',
                                        bgcolor: '#31a24c', border: '2px solid white'
                                    }} />
                                )}
                            </Box>
                            <Typography sx={{ fontSize: 12, color: '#050505', textAlign: 'center', maxWidth: 64, mt: 0.5 }} noWrap>{friend.firstName + ' ' + friend.lastName}</Typography>
                        </Box>
                    ))}
                    <Box
                        sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
                        onClick={() => setOpenMessengerShare(true)}
                    >
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
                        <Box
                            key={option.id}
                            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
                            onClick={() => {
                                if (option.id === 'messenger') {
                                    setOpenMessengerShare(true);
                                } else if (option.id === 'copy') {
                                    navigator.clipboard.writeText(`${window.location.origin}/post/${sharingPost?._id}`);
                                    alert('Đã sao chép liên kết!');
                                }
                            }}
                        >
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

            {/* Share Post Modal for Messenger */}
            {sharingPost && (
                <SharePostModal
                    open={openMessengerShare}
                    onClose={() => setOpenMessengerShare(false)}
                    post={sharingPost}
                    currentUserId={user?.id || ''}
                />
            )}
        </Box>
    );
}