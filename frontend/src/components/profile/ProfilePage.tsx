'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Box,
    Container,
    Avatar,
    Typography,
    Button,
    IconButton,
    Tabs,
    Tab,
    Card,
    CardContent,
    Skeleton,
    Divider,
    Grid,
    CircularProgress,
    TextField,
    InputAdornment,
    Modal,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material';
import {
    PhotoCamera as PhotoCameraIcon,
    Edit as EditIcon,
    Add as AddIcon,
    MoreHoriz as MoreIcon,
    PersonAdd as PersonAddIcon,
    Message as MessageIcon,
    Public as PublicIcon,
    Home as HomeIcon,
    Cake as CakeIcon,
    Phone as PhoneIcon,
    Email as EmailIcon,
    Male as MaleIcon,
    Female as FemaleIcon,
    Transgender as TransgenderIcon,
    School as SchoolIcon,
    Search as SearchIcon,
    PlayCircle as PlayIcon,
    Lock as LockIcon,
    People as PeopleIcon,
    PersonRemove as PersonRemoveIcon,
    Block as BlockIcon,
    Check as CheckIcon,
    Cancel as CancelIcon,
    Settings as SettingsIcon,
    PauseCircle as PauseCircleIcon,
    Visibility as VisibilityIcon,
    CloudUpload as CloudUploadIcon,
    Close as CloseIcon,
} from '@mui/icons-material';
import { useAuthStore } from '@/stores/useAuthStore';
import { accountService } from '@/services/account.service';
import { relationshipService } from '@/services/relationship.service';
import { postService } from '@/services/post.service';
import { ProfileType, FriendType } from '@/types/account';
import { PostType, PostPrivacy, MediaItem } from '@/types/post';
import { uploadChatMedia, deleteCloudinaryMedia } from '@/services/cloudinary.service';
import { useRouter } from 'next/navigation';
import EditProfileModal from '@/components/profile/EditProfileModal';
import CreatePostModal from '@/components/posts/CreatePostModal';
import EditPostModal from '@/components/posts/EditPostModal';
import PostItem from '@/components/posts/PostItem';
import ImageViewer from '@/components/posts/ImageViewer';
import CommentContentModal from '@/components/posts/CommentContentModal';
import ShareContentModal from '@/components/posts/ShareContentModal';
import PostOptionContentMenu from '@/components/posts/PostOptionContentMenu';
import Header from '@/components/home/Header';
import { CLIENT_PATH } from '@/constants/paths';
import { toast } from 'sonner';
import { usePostStore } from '@/stores/usePostStore';
import { useDeletePost } from '@/queries/usePostQueries';
import { useSocket } from '@/contexts/SocketContext';

interface ProfilePageProps {
    userName: string;
}

export default function ProfilePage({ userName }: ProfilePageProps) {
    const { user, isLoading: authLoading } = useAuthStore();
    const router = useRouter();
    const deletePostMutation = useDeletePost();
    const { addPost, deletePost: deletePostFromStore } = usePostStore();
    const { socketRelationship } = useSocket();

    // Profile states
    const [profile, setProfile] = useState<ProfileType | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(0);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [createPostModalOpen, setCreatePostModalOpen] = useState(false);
    const [friends, setFriends] = useState<FriendType[]>([]);
    const [friendsLoading, setFriendsLoading] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadingCover, setUploadingCover] = useState(false);
    const [posts, setPosts] = useState<PostType[]>([]);
    const [postsLoading, setPostsLoading] = useState(false);
    const [friendSearchQuery, setFriendSearchQuery] = useState('');

    // Friendship status
    const [isFriend, setIsFriend] = useState(false);
    const [friendshipStatus, setFriendshipStatus] = useState<string | null>(null);
    const [friendshipLoading, setFriendshipLoading] = useState(false);

    // Friend action menu (for other profile's friends)
    const [friendMenuAnchor, setFriendMenuAnchor] = useState<null | HTMLElement>(null);
    const [selectedFriend, setSelectedFriend] = useState<FriendType | null>(null);

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
    const sharePrivacy: PostPrivacy = 'PUBLIC'; // Initial privacy for share modal


    // Profile Settings Menu (3-dot menu)
    const [profileSettingsAnchor, setProfileSettingsAnchor] = useState<null | HTMLElement>(null);

    // Block User Dialog
    const [blockDialogOpen, setBlockDialogOpen] = useState(false);
    const [isBlocking, setIsBlocking] = useState(false);
    const [blockFriendDialogOpen, setBlockFriendDialogOpen] = useState(false);

    // Avatar Menu (view/upload options)
    const [avatarMenuAnchor, setAvatarMenuAnchor] = useState<null | HTMLElement>(null);

    // Cover Menu (view/upload options)
    const [coverMenuAnchor, setCoverMenuAnchor] = useState<null | HTMLElement>(null);

    // Cover Photo Edit Modal
    const [openCoverEditModal, setOpenCoverEditModal] = useState(false);
    const [coverPreviewUrl, setCoverPreviewUrl] = useState<string>('');
    const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null);


    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const avatarInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    const isOwnProfile = user?.username === userName;

    useEffect(() => {
        const fetchProfile = async () => {
            // Wait for auth to be ready before fetching profile
            if (authLoading) return;

            try {
                setLoading(true);
                const data = await accountService.getProfileByUsername(userName);
                setProfile(data);
            } catch (error) {
                console.error('Error fetching profile:', error);
            } finally {
                setLoading(false);
            }
        };

        if (userName) {
            fetchProfile();
        }
    }, [userName, authLoading]);

    // Fetch friends list of the profile user
    useEffect(() => {
        const fetchFriends = async () => {
            if (!profile?._id) return;
            try {
                setFriendsLoading(true);
                const response = await relationshipService.getFriendsByUserId(profile._id);
                setFriends(response.data || []);
            } catch (error) {
                console.error('Error fetching friends:', error);
            } finally {
                setFriendsLoading(false);
            }
        };

        fetchFriends();
    }, [profile?._id]);

    // Check friendship status with profile user (only if not own profile)
    useEffect(() => {
        const checkFriendshipStatus = async () => {
            if (!profile?._id || isOwnProfile) return;
            try {
                setFriendshipLoading(true);
                const response = await relationshipService.checkFriendship(profile._id);
                setIsFriend(response.data?.isFriend || false);
                setFriendshipStatus(response.data?.status || null);
            } catch (error) {
                console.error('Error checking friendship status:', error);
            } finally {
                setFriendshipLoading(false);
            }
        };

        checkFriendshipStatus();
    }, [profile?._id, isOwnProfile]);

    // Fetch user posts with privacy filtering
    useEffect(() => {
        const fetchPosts = async () => {
            if (!profile?._id) return;
            try {
                setPostsLoading(true);
                // Pass friendIds if the current user is a friend of the profile owner
                const friendIds = isFriend ? [user?.id || ''] : [];
                const response = await postService.getPostsByUserId(profile._id, { friendIds });
                setPosts(response.data || []);
            } catch (error) {
                console.error('Error fetching posts:', error);
            } finally {
                setPostsLoading(false);
            }
        };

        if (profile?._id) {
            fetchPosts();
        }
    }, [profile?._id, isFriend, user?.id]);

    const handlePostCreated = useCallback((newPost: PostType) => {
        setPosts(prev => [newPost, ...prev]);
        addPost(newPost);
        setCreatePostModalOpen(false);
    }, [addPost]);

    const handleProfileUpdate = (updatedProfile: ProfileType) => {
        setProfile(updatedProfile);
        // Sync avatar to auth store for Header and other components
        if (isOwnProfile && updatedProfile.avatar) {
            useAuthStore.getState().updateUser({ avatar: updatedProfile.avatar });
        }
    };

    const handleMessage = () => {
        router.push(`/chat?username=${userName}`);
    };

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setUploadingAvatar(true);
            const result = await uploadChatMedia([file]);
            if (result.success && result.results.length > 0) {
                const avatarUrl = result.results[0].url;
                const updatedProfile = await accountService.updateProfile({ avatar: avatarUrl });
                setProfile(updatedProfile);
                // Sync avatar to auth store for Header and other components
                useAuthStore.getState().updateUser({ avatar: avatarUrl });
                toast.success('Cập nhật ảnh đại diện thành công!');
            }
        } catch (error) {
            console.error('Error uploading avatar:', error);
            toast.error('Lỗi khi tải ảnh lên');
        } finally {
            setUploadingAvatar(false);
            if (avatarInputRef.current) avatarInputRef.current.value = '';
        }
    };

    const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setUploadingCover(true);
            const result = await uploadChatMedia([file]);
            if (result.success && result.results.length > 0) {
                const backgroundUrl = result.results[0].url;
                const updatedProfile = await accountService.updateProfile({ background: backgroundUrl });
                setProfile(updatedProfile);
                toast.success('Cập nhật ảnh bìa thành công!');
            }
        } catch (error) {
            console.error('Error uploading cover:', error);
            toast.error('Lỗi khi tải ảnh lên');
        } finally {
            setUploadingCover(false);
            if (coverInputRef.current) coverInputRef.current.value = '';
        }
    };

    const navigateToProfile = (username: string) => {
        router.push(CLIENT_PATH.PROFILE_BY_USERNAME(username));
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('vi-VN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    const getGenderIcon = (gender?: string) => {
        switch (gender) {
            case 'MALE': return <MaleIcon sx={{ fontSize: 20, color: '#1877f2' }} />;
            case 'FEMALE': return <FemaleIcon sx={{ fontSize: 20, color: '#e91e8c' }} />;
            default: return <TransgenderIcon sx={{ fontSize: 20, color: '#65676b' }} />;
        }
    };

    const getGenderText = (gender?: string) => {
        switch (gender) {
            case 'MALE': return 'Nam';
            case 'FEMALE': return 'Nữ';
            default: return 'Khác';
        }
    };

    // Filter friends based on search query
    const filteredFriends = friends.filter(friend => {
        const fullName = `${friend.firstName} ${friend.lastName}`.toLowerCase();
        return fullName.includes(friendSearchQuery.toLowerCase());
    });

    // Post Options Menu handlers
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
            // Delete media from Cloudinary first
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

            // Delete post from backend
            await deletePostMutation.mutateAsync(menuPost._id);
            // Remove from local state
            setPosts(prev => prev.filter(p => p._id !== menuPost._id));
            deletePostFromStore(menuPost._id);
            handleCloseMenu();
            toast.success('Xóa bài viết thành công!');
        } catch (error) {
            console.error('Error deleting post:', error);
            toast.error('Lỗi khi xóa bài viết');
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

    // Comment Modal handlers
    const handleOpenComments = (post: PostType) => {
        setCommentingPost(post);
        setOpenCommentModal(true);
    };

    // Share Modal handlers
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
            // Update local posts state
            setPosts(prev => prev.map(p => p._id === menuPost._id ? { ...p, allowComments: allow } : p));
            setMenuPost({ ...menuPost, allowComments: allow });
        } catch (error) {
            console.error('Error toggling comments:', error);
        }
    };

    const handleToggleShares = async (allow: boolean) => {
        if (!menuPost) return;
        try {
            await postService.updatePost(menuPost._id, { allowShares: allow });
            setPosts(prev => prev.map(p => p._id === menuPost._id ? { ...p, allowShares: allow } : p));
            setMenuPost({ ...menuPost, allowShares: allow });
        } catch (error) {
            console.error('Error toggling shares:', error);
        }
    };

    const handleToggleReactions = async (allow: boolean) => {
        if (!menuPost) return;
        try {
            await postService.updatePost(menuPost._id, { allowReactions: allow });
            setPosts(prev => prev.map(p => p._id === menuPost._id ? { ...p, allowReactions: allow } : p));
            setMenuPost({ ...menuPost, allowReactions: allow });
        } catch (error) {
            console.error('Error toggling reactions:', error);
        }
    };

    // Friend menu handlers (for friend list items)
    const handleOpenFriendMenu = (event: React.MouseEvent<HTMLElement>, friend: FriendType) => {
        event.stopPropagation();
        setFriendMenuAnchor(event.currentTarget);
        setSelectedFriend(friend);
    };

    const handleCloseFriendMenu = () => {
        setFriendMenuAnchor(null);
        setSelectedFriend(null);
    };

    // Add friend handler
    const handleAddFriend = async () => {
        if (!user?.id || !profile?._id) return;
        try {
            await relationshipService.addFriend(user.id, profile._id);
            setFriendshipStatus('PENDING');
            toast.success('Đã gửi lời mời kết bạn!');
        } catch (error) {
            console.error('Error adding friend:', error);
            toast.error('Lỗi khi gửi lời mời kết bạn');
        }
    };

    // Unfriend handler
    const handleUnfriend = async (targetUserId?: string) => {
        const friendId = targetUserId || profile?._id;
        if (!user?.id || !friendId) return;
        try {
            await relationshipService.updateStatusRelationship(user.id, friendId, 'REJECTED');
            if (!targetUserId) {
                setIsFriend(false);
                setFriendshipStatus(null);
            } else {
                setFriends(prev => prev.filter(f => f._id !== friendId));
            }
            handleCloseFriendMenu();
            toast.success('Đã hủy kết bạn!');
        } catch (error) {
            console.error('Error unfriending:', error);
            toast.error('Lỗi khi hủy kết bạn');
        }
    };

    // Cancel friend request handler
    const handleCancelFriendRequest = async () => {
        if (!user?.id || !profile?._id) return;
        try {
            await relationshipService.updateStatusRelationship(user.id, profile._id, 'CANCELED');
            setFriendshipStatus(null);
            toast.success('Đã hủy lời mời kết bạn!');
        } catch (error) {
            console.error('Error canceling friend request:', error);
            toast.error('Lỗi khi hủy lời mời kết bạn');
        }
    };

    // Profile settings menu handlers
    const handleOpenProfileSettings = (event: React.MouseEvent<HTMLElement>) => {
        setProfileSettingsAnchor(event.currentTarget);
    };

    const handleCloseProfileSettings = () => {
        setProfileSettingsAnchor(null);
    };

    const handleGoToSettings = () => {
        setProfileSettingsAnchor(null);
        router.push('/settings');
    };

    // Block user handler
    const handleBlockUser = async () => {
        if (!profile || isBlocking) return;

        setIsBlocking(true);
        try {
            // Use socket for real-time update
            if (socketRelationship) {
                socketRelationship.emit('user:block', { targetUserId: profile._id }, (response: { success: boolean; error?: string }) => {
                    if (response.success) {
                        toast.success(`Đã chặn ${profile.firstName} ${profile.lastName}`);
                        setBlockDialogOpen(false);
                        setProfileSettingsAnchor(null);
                        router.push('/');
                    } else {
                        toast.error(response.error || 'Không thể chặn người dùng');
                    }
                    setIsBlocking(false);
                });
            } else {
                // Fallback to REST API
                await relationshipService.blockUser(profile._id);
                toast.success(`Đã chặn ${profile.firstName} ${profile.lastName}`);
                setBlockDialogOpen(false);
                setProfileSettingsAnchor(null);
                router.push('/');
                setIsBlocking(false);
            }
        } catch (error) {
            console.error('Failed to block user:', error);
            toast.error('Không thể chặn người dùng');
            setIsBlocking(false);
        }
    };

    // Block friend handler (from friend list)
    const handleBlockFriend = async () => {
        if (!selectedFriend || isBlocking) return;

        setIsBlocking(true);
        try {
            // Use socket for real-time update
            if (socketRelationship) {
                socketRelationship.emit('user:block', { targetUserId: selectedFriend._id }, (response: { success: boolean; error?: string }) => {
                    if (response.success) {
                        toast.success(`Đã chặn ${selectedFriend.firstName} ${selectedFriend.lastName}`);
                        setBlockFriendDialogOpen(false);
                        setFriendMenuAnchor(null);
                        setFriends(friends.filter(f => f._id !== selectedFriend._id));
                        setSelectedFriend(null);
                    } else {
                        toast.error(response.error || 'Không thể chặn người dùng');
                    }
                    setIsBlocking(false);
                });
            } else {
                // Fallback to REST API
                await relationshipService.blockUser(selectedFriend._id);
                toast.success(`Đã chặn ${selectedFriend.firstName} ${selectedFriend.lastName}`);
                setBlockFriendDialogOpen(false);
                setFriendMenuAnchor(null);
                setFriends(friends.filter(f => f._id !== selectedFriend._id));
                setSelectedFriend(null);
                setIsBlocking(false);
            }
        } catch (error) {
            console.error('Failed to block friend:', error);
            toast.error('Không thể chặn người dùng');
            setIsBlocking(false);
        }
    };

    // Avatar menu handlers
    const handleOpenAvatarMenu = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        setAvatarMenuAnchor(event.currentTarget);
    };

    const handleCloseAvatarMenu = () => {
        setAvatarMenuAnchor(null);
    };

    const handleViewAvatar = () => {
        if (profile?.avatar) {
            setViewerMedia([{ url: profile.avatar, mediaType: 'IMAGE', publicId: '' }]);
            setViewerInitialIndex(0);
            setOpenImageViewer(true);
        }
        handleCloseAvatarMenu();
    };

    const handleUploadAvatar = () => {
        avatarInputRef.current?.click();
        handleCloseAvatarMenu();
    };

    // Cover menu handlers
    const handleOpenCoverMenu = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        setCoverMenuAnchor(event.currentTarget);
    };

    const handleCloseCoverMenu = () => {
        setCoverMenuAnchor(null);
    };

    const handleViewCover = () => {
        if (profile?.background) {
            setViewerMedia([{ url: profile.background, mediaType: 'IMAGE', publicId: '' }]);
            setViewerInitialIndex(0);
            setOpenImageViewer(true);
        }
        handleCloseCoverMenu();
    };

    const handleUploadCoverFromMenu = () => {
        handleCloseCoverMenu();
        handleOpenCoverEditModal();
    };

    // Cover photo edit modal handlers
    const handleOpenCoverEditModal = () => {
        setCoverPreviewUrl(profile?.background || '');
        setSelectedCoverFile(null);
        setOpenCoverEditModal(true);
    };

    const handleCloseCoverEditModal = () => {
        setOpenCoverEditModal(false);
        setCoverPreviewUrl('');
        setSelectedCoverFile(null);
    };

    const handleCoverFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedCoverFile(file);
            const previewUrl = URL.createObjectURL(file);
            setCoverPreviewUrl(previewUrl);
        }
    };

    const handleSaveCoverPhoto = async () => {
        if (!selectedCoverFile) return;
        try {
            setUploadingCover(true);
            const result = await uploadChatMedia([selectedCoverFile]);
            if (result.success && result.results.length > 0) {
                const backgroundUrl = result.results[0].url;
                const updatedProfile = await accountService.updateProfile({ background: backgroundUrl });
                setProfile(updatedProfile);
                toast.success('Cập nhật ảnh bìa thành công!');
                handleCloseCoverEditModal();
            }
        } catch (error) {
            console.error('Error uploading cover:', error);
            toast.error('Lỗi khi tải ảnh lên');
        } finally {
            setUploadingCover(false);
        }
    };

    // Navigate to friends page
    const navigateToFriends = (tab?: string) => {
        if (tab) {
            router.push(`${CLIENT_PATH.FRIENDS}?tab=${tab}`);
        } else {
            router.push(CLIENT_PATH.FRIENDS);
        }
    };

    // Open photo in gallery
    const handleOpenGalleryPhoto = (photos: MediaItem[], index: number) => {
        setViewerMedia(photos);
        setViewerInitialIndex(index);
        setOpenImageViewer(true);
    };

    // Privacy icon helper
    const getPrivacyIcon = (privacy: PostPrivacy) => {
        switch (privacy) {
            case 'FRIEND':
                return PeopleIcon;
            case 'PRIVATE':
                return LockIcon;
            default:
                return PublicIcon;
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

    if (loading) {
        return (
            <Box sx={{ bgcolor: '#f0f2f5', minHeight: '100vh' }}>
                <Header />
                <Box sx={{ pt: '56px' }}>
                    <Box sx={{ bgcolor: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                        <Container maxWidth="lg">
                            <Skeleton variant="rectangular" height={350} sx={{ borderRadius: '0 0 8px 8px' }} />
                            <Box sx={{ display: 'flex', alignItems: 'flex-end', mt: -8, px: 2, pb: 2 }}>
                                <Skeleton variant="circular" width={168} height={168} />
                                <Box sx={{ ml: 2, flex: 1 }}>
                                    <Skeleton variant="text" width={200} height={40} />
                                    <Skeleton variant="text" width={100} height={24} />
                                </Box>
                            </Box>
                        </Container>
                    </Box>
                </Box>
            </Box>
        );
    }

    if (!profile) {
        return (
            <Box sx={{ bgcolor: '#f0f2f5', minHeight: '100vh' }}>
                <Header />
                <Box sx={{ pt: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 56px)' }}>
                    <Typography color="#050505">Không tìm thấy người dùng</Typography>
                </Box>
            </Box>
        );
    }

    const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();

    return (
        <Box sx={{ bgcolor: '#f0f2f5', minHeight: '100vh' }}>
            {/* Header */}
            <Header />

            {/* Main content with padding for header */}
            <Box sx={{ pt: '56px' }}>
                {/* Hidden file inputs */}
                <input
                    type="file"
                    ref={avatarInputRef}
                    onChange={handleAvatarUpload}
                    accept="image/*"
                    style={{ display: 'none' }}
                />
                <input
                    type="file"
                    ref={coverInputRef}
                    onChange={handleCoverUpload}
                    accept="image/*"
                    style={{ display: 'none' }}
                />

                {/* Cover & Profile Header */}
                <Box sx={{ bgcolor: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                    <Container maxWidth="lg">
                        {/* Cover Photo */}
                        <Box
                            sx={{
                                position: 'relative',
                                height: 350,
                                borderRadius: '0 0 8px 8px',
                                overflow: 'hidden',
                                background: profile.background
                                    ? `url(${profile.background}) center/cover no-repeat`
                                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            }}
                        >
                            {uploadingCover && (
                                <Box sx={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    bgcolor: 'rgba(0,0,0,0.5)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <CircularProgress sx={{ color: 'white' }} />
                                </Box>
                            )}
                            {isOwnProfile && (
                                <Button
                                    variant="contained"
                                    startIcon={<PhotoCameraIcon />}
                                    sx={{
                                        position: 'absolute',
                                        bottom: 16,
                                        right: 16,
                                        bgcolor: 'white',
                                        zIndex: 15,
                                        color: '#050505',
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        '&:hover': { bgcolor: '#f0f2f5' }
                                    }}
                                    onClick={profile.background ? handleOpenCoverMenu : handleOpenCoverEditModal}
                                    disabled={uploadingCover}
                                >
                                    {profile.background ? 'Chỉnh sửa ảnh bìa' : 'Thêm ảnh bìa'}
                                </Button>
                            )}
                        </Box>

                        {/* Profile Info */}
                        <Box sx={{ display: 'flex', alignItems: 'flex-end', mt: -6, px: 4, pb: 2, position: 'relative' }}>
                            {/* Avatar */}
                            <Box sx={{ position: 'relative' }}>
                                <Avatar
                                    src={profile.avatar}
                                    sx={{
                                        width: 168,
                                        height: 168,
                                        border: '4px solid white',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                        bgcolor: '#e4e6eb',
                                        fontSize: 64,
                                        color: '#65676b',
                                    }}
                                >
                                    {!profile.avatar && fullName.charAt(0)}
                                </Avatar>
                                {uploadingAvatar && (
                                    <Box sx={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        borderRadius: '50%',
                                        bgcolor: 'rgba(0,0,0,0.5)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <CircularProgress sx={{ color: 'white' }} size={40} />
                                    </Box>
                                )}
                                {isOwnProfile && (
                                    <IconButton
                                        sx={{
                                            position: 'absolute',
                                            bottom: 8,
                                            right: 8,
                                            bgcolor: '#e4e6eb',
                                            border: '2px solid white',
                                            '&:hover': { bgcolor: '#d8dadf' }
                                        }}
                                        onClick={handleOpenAvatarMenu}
                                        disabled={uploadingAvatar}
                                    >
                                        <PhotoCameraIcon sx={{ fontSize: 20, color: '#050505' }} />
                                    </IconButton>
                                )}
                            </Box>

                            {/* Name & Friends Count */}
                            <Box sx={{ ml: 3, flex: 1, mb: 1 }}>
                                <Typography variant="h4" fontWeight={700} color="#050505">
                                    {fullName}
                                </Typography>
                                <Typography color="#65676b" fontWeight={500} fontSize={15}>
                                    {friends.length} bạn bè
                                </Typography>
                                {/* Friends avatars preview */}
                                {friends.length > 0 && (
                                    <Box sx={{ display: 'flex', mt: 0.5 }}>
                                        {friends.slice(0, 8).map((friend, idx) => (
                                            <Avatar
                                                key={friend._id}
                                                src={friend.avatar}
                                                sx={{
                                                    width: 32,
                                                    height: 32,
                                                    border: '2px solid white',
                                                    ml: idx > 0 ? -1 : 0,
                                                    cursor: 'pointer',
                                                    '&:hover': { zIndex: 1, transform: 'scale(1.1)' },
                                                    transition: 'transform 0.2s'
                                                }}
                                                onClick={() => navigateToProfile(friend.username)}
                                            />
                                        ))}
                                    </Box>
                                )}
                            </Box>

                            {/* Action Buttons */}
                            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                                {isOwnProfile ? (
                                    <>
                                        <Button
                                            variant="contained"
                                            startIcon={<AddIcon />}
                                            sx={{
                                                bgcolor: '#1877f2',
                                                textTransform: 'none',
                                                fontWeight: 600,
                                                '&:hover': { bgcolor: '#166fe5' }
                                            }}
                                        >
                                            Thêm vào tin
                                        </Button>
                                        <Button
                                            variant="contained"
                                            startIcon={<EditIcon />}
                                            sx={{
                                                bgcolor: '#e4e6eb',
                                                color: '#050505',
                                                textTransform: 'none',
                                                fontWeight: 600,
                                                '&:hover': { bgcolor: '#d8dadf' }
                                            }}
                                            onClick={() => setEditModalOpen(true)}
                                        >
                                            Chỉnh sửa trang cá nhân
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        {/* Friend action button based on friendship status */}
                                        {friendshipLoading ? (
                                            <Button
                                                variant="contained"
                                                disabled
                                                sx={{
                                                    bgcolor: '#e4e6eb',
                                                    color: '#050505',
                                                    textTransform: 'none',
                                                    fontWeight: 600,
                                                }}
                                            >
                                                <CircularProgress size={20} sx={{ mr: 1 }} />
                                                Đang tải...
                                            </Button>
                                        ) : isFriend ? (
                                            <Button
                                                variant="contained"
                                                startIcon={<CheckIcon />}
                                                sx={{
                                                    bgcolor: '#e4e6eb',
                                                    color: '#050505',
                                                    textTransform: 'none',
                                                    fontWeight: 600,
                                                    '&:hover': { bgcolor: '#d8dadf' }
                                                }}
                                                onClick={() => handleUnfriend()}
                                            >
                                                Bạn bè
                                            </Button>
                                        ) : friendshipStatus === 'PENDING' ? (
                                            <Button
                                                variant="contained"
                                                startIcon={<CancelIcon />}
                                                sx={{
                                                    bgcolor: '#e4e6eb',
                                                    color: '#050505',
                                                    textTransform: 'none',
                                                    fontWeight: 600,
                                                    '&:hover': { bgcolor: '#d8dadf' }
                                                }}
                                                onClick={handleCancelFriendRequest}
                                            >
                                                Hủy lời mời
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="contained"
                                                startIcon={<PersonAddIcon />}
                                                sx={{
                                                    bgcolor: '#1877f2',
                                                    textTransform: 'none',
                                                    fontWeight: 600,
                                                    '&:hover': { bgcolor: '#166fe5' }
                                                }}
                                                onClick={handleAddFriend}
                                            >
                                                Thêm bạn bè
                                            </Button>
                                        )}
                                        <Button
                                            variant="contained"
                                            startIcon={<MessageIcon />}
                                            sx={{
                                                bgcolor: isFriend ? '#1877f2' : '#e4e6eb',
                                                color: isFriend ? 'white' : '#050505',
                                                textTransform: 'none',
                                                fontWeight: 600,
                                                '&:hover': { bgcolor: isFriend ? '#166fe5' : '#d8dadf' }
                                            }}
                                            onClick={handleMessage}
                                        >
                                            Nhắn tin
                                        </Button>
                                    </>
                                )}
                                <IconButton
                                    sx={{ bgcolor: '#e4e6eb', '&:hover': { bgcolor: '#d8dadf' } }}
                                    onClick={handleOpenProfileSettings}
                                >
                                    <MoreIcon sx={{ color: '#050505' }} />
                                </IconButton>
                            </Box>
                        </Box>

                        <Divider sx={{ mx: 4 }} />

                        {/* Tabs */}
                        <Box sx={{ px: 4 }}>
                            <Tabs
                                value={activeTab}
                                onChange={(_, v) => setActiveTab(v)}
                                sx={{
                                    '& .MuiTab-root': {
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        fontSize: 15,
                                        color: '#65676b',
                                        minWidth: 'auto',
                                        px: 2,
                                        '&.Mui-selected': { color: '#1877f2' }
                                    },
                                    '& .MuiTabs-indicator': { bgcolor: '#1877f2', height: 3 }
                                }}
                            >
                                <Tab label="Bài viết" />
                                <Tab label="Giới thiệu" />
                                <Tab label="Bạn bè" />
                                <Tab label="Ảnh" />
                                <Tab label="Xem thêm" />
                            </Tabs>
                        </Box>
                    </Container>
                </Box>

                {/* Content based on activeTab */}
                <Container maxWidth="lg" sx={{ py: 2 }}>
                    {/* Tab 0: Bài viết (Posts) */}
                    {activeTab === 0 && (
                        <Grid container spacing={2}>
                            {/* Left Column - Intro */}
                            <Grid size={{ xs: 12, md: 5 }}>
                                {/* Intro Card */}
                                <Card sx={{ bgcolor: 'white', borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                                    <CardContent>
                                        <Typography variant="h6" fontWeight={700} color="#050505" gutterBottom>
                                            Giới thiệu
                                        </Typography>

                                        {/* Bio */}
                                        {profile.bio ? (
                                            <Typography color="#050505" fontSize={15} textAlign="center" sx={{ mb: 2 }}>
                                                {profile.bio}
                                            </Typography>
                                        ) : isOwnProfile && (
                                            <Button
                                                fullWidth
                                                sx={{
                                                    bgcolor: '#e4e6eb',
                                                    color: '#050505',
                                                    textTransform: 'none',
                                                    fontWeight: 500,
                                                    mb: 2,
                                                    '&:hover': { bgcolor: '#d8dadf' }
                                                }}
                                                onClick={() => setEditModalOpen(true)}
                                            >
                                                Thêm tiểu sử
                                            </Button>
                                        )}

                                        {/* Info Items */}
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                            {profile.addresses && profile.addresses.length > 0 && (
                                                profile.addresses.map((addr, idx) => (
                                                    <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                        <HomeIcon sx={{ fontSize: 20, color: '#65676b' }} />
                                                        <Typography color="#050505" fontSize={15}>
                                                            Sống tại <strong>{addr.ward?.name}, {addr.district?.name}, {addr.province?.name}</strong>
                                                        </Typography>
                                                    </Box>
                                                ))
                                            )}

                                            {profile.birthday && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                    <CakeIcon sx={{ fontSize: 20, color: '#65676b' }} />
                                                    <Typography color="#050505" fontSize={15}>
                                                        Sinh ngày <strong>{formatDate(profile.birthday)}</strong>
                                                    </Typography>
                                                </Box>
                                            )}

                                            {profile.phone && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                    <PhoneIcon sx={{ fontSize: 20, color: '#65676b' }} />
                                                    <Typography color="#050505" fontSize={15}>
                                                        {profile.phone}
                                                    </Typography>
                                                </Box>
                                            )}

                                            {profile.createdAt && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                    <PublicIcon sx={{ fontSize: 20, color: '#65676b' }} />
                                                    <Typography color="#050505" fontSize={15}>
                                                        Tham gia từ <strong>{formatDate(profile.createdAt)}</strong>
                                                    </Typography>
                                                </Box>
                                            )}
                                        </Box>

                                        {isOwnProfile && (
                                            <Button
                                                fullWidth
                                                sx={{
                                                    bgcolor: '#e4e6eb',
                                                    color: '#050505',
                                                    textTransform: 'none',
                                                    fontWeight: 500,
                                                    mt: 2,
                                                    '&:hover': { bgcolor: '#d8dadf' }
                                                }}
                                                onClick={() => setEditModalOpen(true)}
                                            >
                                                Chỉnh sửa chi tiết
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Photos Card */}
                                <Card sx={{ bgcolor: 'white', borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.1)', mt: 2 }}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                            <Typography variant="h6" fontWeight={700} color="#050505">
                                                Ảnh
                                            </Typography>
                                            <Button sx={{ textTransform: 'none', color: '#1877f2' }} onClick={() => setActiveTab(3)}>
                                                Xem tất cả ảnh
                                            </Button>
                                        </Box>
                                        {posts.filter(p => p.media && p.media.length > 0).length > 0 ? (
                                            <Grid container spacing={0.5}>
                                                {posts
                                                    .filter(p => p.media && p.media.length > 0)
                                                    .flatMap(p => p.media)
                                                    .filter(m => m.mediaType === 'IMAGE')
                                                    .slice(0, 9)
                                                    .map((media, idx) => (
                                                        <Grid size={{ xs: 4 }} key={idx}>
                                                            <Box
                                                                component="img"
                                                                src={media.url}
                                                                sx={{
                                                                    width: '100%',
                                                                    aspectRatio: '1',
                                                                    objectFit: 'cover',
                                                                    borderRadius: 1,
                                                                }}
                                                            />
                                                        </Grid>
                                                    ))}
                                            </Grid>
                                        ) : (
                                            <Typography color="#65676b" fontSize={14}>
                                                Chưa có ảnh nào
                                            </Typography>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Friends Card */}
                                <Card sx={{ bgcolor: 'white', borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.1)', mt: 2 }}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                            <Box>
                                                <Typography variant="h6" fontWeight={700} color="#050505">
                                                    Bạn bè
                                                </Typography>
                                                <Typography color="#65676b" fontSize={14}>
                                                    {friends.length} người bạn
                                                </Typography>
                                            </Box>
                                            <Button sx={{ textTransform: 'none', color: '#1877f2' }} onClick={() => setActiveTab(2)}>
                                                Xem tất cả bạn bè
                                            </Button>
                                        </Box>

                                        {friendsLoading ? (
                                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                                                <CircularProgress size={24} />
                                            </Box>
                                        ) : friends.length === 0 ? (
                                            <Typography color="#65676b" fontSize={14} textAlign="center" py={2}>
                                                Chưa có bạn bè nào
                                            </Typography>
                                        ) : (
                                            <Grid container spacing={1}>
                                                {friends.slice(0, 9).map((friend) => (
                                                    <Grid size={{ xs: 4 }} key={friend._id}>
                                                        <Box
                                                            sx={{
                                                                cursor: 'pointer',
                                                                borderRadius: 2,
                                                                overflow: 'hidden',
                                                                '&:hover': { opacity: 0.9 }
                                                            }}
                                                            onClick={() => navigateToProfile(friend.username)}
                                                        >
                                                            <Box
                                                                component="img"
                                                                src={friend.avatar || `https://ui-avatars.com/api/?name=${friend.firstName}+${friend.lastName}&background=e4e6eb&color=050505`}
                                                                sx={{
                                                                    width: '100%',
                                                                    aspectRatio: '1',
                                                                    objectFit: 'cover',
                                                                    borderRadius: 2,
                                                                }}
                                                            />
                                                            <Typography
                                                                fontSize={13}
                                                                fontWeight={500}
                                                                color="#050505"
                                                                sx={{
                                                                    mt: 0.5,
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap'
                                                                }}
                                                            >
                                                                {friend.firstName} {friend.lastName}
                                                            </Typography>
                                                        </Box>
                                                    </Grid>
                                                ))}
                                            </Grid>
                                        )}
                                    </CardContent>
                                </Card>
                            </Grid>

                            {/* Right Column - Posts */}
                            <Grid size={{ xs: 12, md: 7 }}>
                                {/* Create Post Card */}
                                {isOwnProfile && (
                                    <Card sx={{ bgcolor: 'white', borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.1)', mb: 2 }}>
                                        <CardContent>
                                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                                <Avatar
                                                    src={profile.avatar}
                                                    sx={{
                                                        width: 40,
                                                        height: 40,
                                                        bgcolor: '#e4e6eb',
                                                        color: '#65676b',
                                                    }}
                                                >
                                                    {!profile.avatar && fullName.charAt(0)}
                                                </Avatar>
                                                <Button
                                                    fullWidth
                                                    onClick={() => setCreatePostModalOpen(true)}
                                                    sx={{
                                                        bgcolor: '#f0f2f5',
                                                        color: '#65676b',
                                                        textTransform: 'none',
                                                        justifyContent: 'flex-start',
                                                        px: 2,
                                                        py: 1,
                                                        borderRadius: 20,
                                                        '&:hover': { bgcolor: '#e4e6eb' }
                                                    }}
                                                >
                                                    {fullName} ơi, bạn đang nghĩ gì thế?
                                                </Button>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Posts List */}
                                {postsLoading ? (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                        <CircularProgress />
                                    </Box>
                                ) : posts.length === 0 ? (
                                    <Card sx={{ bgcolor: 'white', borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                                        <CardContent sx={{ textAlign: 'center', py: 4 }}>
                                            <Typography color="#65676b" fontSize={15}>
                                                Chưa có bài viết nào
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    posts.map(post => {
                                        const PrivacyIconComponent = getPrivacyIcon(post.privacy);
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
                                            />
                                        );
                                    })
                                )}
                            </Grid>
                        </Grid>
                    )}

                    {/* Tab 1: Giới thiệu (About) */}
                    {activeTab === 1 && (
                        <Card sx={{ bgcolor: 'white', borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                            <CardContent>
                                <Grid container>
                                    {/* Left sidebar */}
                                    <Grid size={{ xs: 12, md: 4 }} sx={{ borderRight: { md: '1px solid #e4e6eb' }, pr: { md: 2 } }}>
                                        <Typography variant="h5" fontWeight={700} color="#050505" gutterBottom>
                                            Giới thiệu
                                        </Typography>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                            {['Tổng quan', 'Công việc và học vấn', 'Nơi từng sống', 'Thông tin liên hệ và cơ bản', 'Chi tiết về bạn'].map((item, idx) => (
                                                <Button
                                                    key={idx}
                                                    fullWidth
                                                    sx={{
                                                        justifyContent: 'flex-start',
                                                        textTransform: 'none',
                                                        color: idx === 0 ? '#1877f2' : '#050505',
                                                        bgcolor: idx === 0 ? '#e7f3ff' : 'transparent',
                                                        fontWeight: idx === 0 ? 600 : 400,
                                                        borderRadius: 2,
                                                        py: 1,
                                                        '&:hover': { bgcolor: idx === 0 ? '#e7f3ff' : '#f0f2f5' }
                                                    }}
                                                >
                                                    {item}
                                                </Button>
                                            ))}
                                        </Box>
                                    </Grid>

                                    {/* Right content */}
                                    <Grid size={{ xs: 12, md: 8 }} sx={{ pl: { md: 3 }, pt: { xs: 2, md: 0 } }}>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            {/* Add work */}
                                            {isOwnProfile && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}>
                                                    <AddIcon sx={{ color: '#1877f2', bgcolor: '#e7f3ff', borderRadius: '50%', p: 0.5 }} />
                                                    <Typography color="#1877f2" fontSize={15} fontWeight={500}>
                                                        Thêm nơi làm việc
                                                    </Typography>
                                                </Box>
                                            )}

                                            {/* School info */}
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                <SchoolIcon sx={{ color: '#65676b', fontSize: 24 }} />
                                                <Typography color="#050505" fontSize={15}>
                                                    Chưa có thông tin trường học
                                                </Typography>
                                            </Box>

                                            {/* Location info */}
                                            {profile.addresses && profile.addresses.length > 0 ? (
                                                profile.addresses.map((addr, idx) => (
                                                    <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                        <HomeIcon sx={{ color: '#65676b', fontSize: 24 }} />
                                                        <Typography color="#050505" fontSize={15}>
                                                            Sống tại <strong>{addr.ward?.name}, {addr.district?.name}, {addr.province?.name}</strong>
                                                        </Typography>
                                                    </Box>
                                                ))
                                            ) : isOwnProfile && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', '&:hover': { opacity: 0.8 } }} onClick={() => setEditModalOpen(true)}>
                                                    <AddIcon sx={{ color: '#1877f2', bgcolor: '#e7f3ff', borderRadius: '50%', p: 0.5 }} />
                                                    <Typography color="#1877f2" fontSize={15} fontWeight={500}>
                                                        Thêm thành phố hiện tại
                                                    </Typography>
                                                </Box>
                                            )}

                                            {/* Birthday */}
                                            {profile.birthday && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                    <CakeIcon sx={{ color: '#65676b', fontSize: 24 }} />
                                                    <Typography color="#050505" fontSize={15}>
                                                        Sinh ngày <strong>{formatDate(profile.birthday)}</strong>
                                                    </Typography>
                                                </Box>
                                            )}

                                            {/* Gender */}
                                            {profile.gender && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                    {getGenderIcon(profile.gender)}
                                                    <Typography color="#050505" fontSize={15}>
                                                        {getGenderText(profile.gender)}
                                                    </Typography>
                                                </Box>
                                            )}

                                            {/* Phone */}
                                            {profile.phone && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                    <PhoneIcon sx={{ color: '#65676b', fontSize: 24 }} />
                                                    <Typography color="#050505" fontSize={15}>
                                                        {profile.phone}
                                                    </Typography>
                                                </Box>
                                            )}

                                            {/* Email */}
                                            {profile.email && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                    <EmailIcon sx={{ color: '#65676b', fontSize: 24 }} />
                                                    <Typography color="#050505" fontSize={15}>
                                                        {profile.email}
                                                    </Typography>
                                                </Box>
                                            )}

                                            {/* Join date */}
                                            {profile.createdAt && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                    <PublicIcon sx={{ color: '#65676b', fontSize: 24 }} />
                                                    <Typography color="#050505" fontSize={15}>
                                                        Tham gia từ <strong>{formatDate(profile.createdAt)}</strong>
                                                    </Typography>
                                                </Box>
                                            )}
                                        </Box>
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>
                    )}

                    {/* Tab 2: Bạn bè (Friends) */}
                    {activeTab === 2 && (
                        <Card sx={{ bgcolor: 'white', borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="h5" fontWeight={700} color="#050505">
                                        Bạn bè
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <TextField
                                            placeholder="Tìm kiếm"
                                            size="small"
                                            value={friendSearchQuery}
                                            onChange={(e) => setFriendSearchQuery(e.target.value)}
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    bgcolor: '#f0f2f5',
                                                    borderRadius: 20,
                                                    '& fieldset': { border: 'none' }
                                                }
                                            }}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <SearchIcon sx={{ color: '#65676b' }} />
                                                    </InputAdornment>
                                                )
                                            }}
                                        />
                                        <Button
                                            sx={{ textTransform: 'none', color: '#1877f2' }}
                                            onClick={() => navigateToFriends('requests')}
                                        >
                                            Lời mời kết bạn
                                        </Button>
                                        <Button
                                            sx={{ textTransform: 'none', color: '#1877f2' }}
                                            onClick={() => navigateToFriends('suggestions')}
                                        >
                                            Tìm bạn bè
                                        </Button>
                                    </Box>
                                </Box>

                                <Tabs value={0} sx={{ mb: 2, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 } }}>
                                    <Tab label="Tất cả bạn bè" onClick={() => navigateToFriends('list')} />
                                    <Tab label="Thêm gần đây" onClick={() => navigateToFriends('recent')} />
                                </Tabs>

                                {friendsLoading ? (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                        <CircularProgress />
                                    </Box>
                                ) : filteredFriends.length === 0 ? (
                                    <Typography color="#65676b" textAlign="center" py={4}>
                                        {friendSearchQuery ? 'Không tìm thấy bạn bè nào' : 'Chưa có bạn bè nào'}
                                    </Typography>
                                ) : (
                                    <Grid container spacing={2}>
                                        {filteredFriends.map((friend) => (
                                            <Grid size={{ xs: 12, sm: 6 }} key={friend._id}>
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 2,
                                                        p: 2,
                                                        borderRadius: 2,
                                                        border: '1px solid #e4e6eb',
                                                        bgcolor: 'white',
                                                        cursor: 'pointer',
                                                        '&:hover': { bgcolor: '#f0f2f5' }
                                                    }}
                                                    onClick={() => navigateToProfile(friend.username)}
                                                >
                                                    <Avatar
                                                        src={friend.avatar}
                                                        sx={{ width: 80, height: 80, borderRadius: 2 }}
                                                    />
                                                    <Box sx={{ flex: 1 }}>
                                                        <Typography fontWeight={600} color="#050505">
                                                            {friend.firstName} {friend.lastName}
                                                        </Typography>
                                                        <Typography fontSize={13} color="#65676b">
                                                            @{friend.username}
                                                        </Typography>
                                                    </Box>
                                                    {isOwnProfile && (
                                                        <IconButton
                                                            onClick={(e) => handleOpenFriendMenu(e, friend)}
                                                            sx={{ bgcolor: '#f0f2f5', '&:hover': { bgcolor: '#e4e6eb' } }}
                                                        >
                                                            <MoreIcon sx={{ color: '#050505' }} />
                                                        </IconButton>
                                                    )}
                                                </Box>
                                            </Grid>
                                        ))}
                                    </Grid>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Tab 3: Ảnh (Photos) */}
                    {activeTab === 3 && (
                        <Card sx={{ bgcolor: 'white', borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="h5" fontWeight={700} color="#050505">
                                        Ảnh
                                    </Typography>
                                    {isOwnProfile && (
                                        <Button
                                            sx={{ textTransform: 'none', color: '#1877f2' }}
                                            onClick={() => setCreatePostModalOpen(true)}
                                        >
                                            Thêm ảnh/video
                                        </Button>
                                    )}
                                </Box>

                                <Tabs value={0} sx={{ mb: 2, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 } }}>
                                    <Tab label="Ảnh của bạn" />
                                    <Tab label="Album" />
                                </Tabs>

                                {(() => {
                                    const allPhotos = posts
                                        .filter(p => p.media && p.media.length > 0)
                                        .flatMap(p => p.media)
                                        .filter(m => m.mediaType === 'IMAGE');

                                    if (allPhotos.length === 0) {
                                        return (
                                            <Typography color="#65676b" textAlign="center" py={4}>
                                                Chưa có ảnh nào
                                            </Typography>
                                        );
                                    }

                                    return (
                                        <Grid container spacing={1}>
                                            {allPhotos.map((media, idx) => (
                                                <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2.4 }} key={idx}>
                                                    <Box
                                                        sx={{
                                                            position: 'relative',
                                                            aspectRatio: '1',
                                                            borderRadius: 2,
                                                            overflow: 'hidden',
                                                            cursor: 'pointer',
                                                            '&:hover .edit-btn': { opacity: 1 },
                                                            '&:hover': { opacity: 0.9 }
                                                        }}
                                                        onClick={() => handleOpenGalleryPhoto(allPhotos, idx)}
                                                    >
                                                        <Box
                                                            component="img"
                                                            src={media.url}
                                                            sx={{
                                                                width: '100%',
                                                                height: '100%',
                                                                objectFit: 'cover',
                                                            }}
                                                        />
                                                        {isOwnProfile && (
                                                            <IconButton
                                                                className="edit-btn"
                                                                size="small"
                                                                onClick={(e) => e.stopPropagation()}
                                                                sx={{
                                                                    position: 'absolute',
                                                                    top: 8,
                                                                    right: 8,
                                                                    bgcolor: 'rgba(0,0,0,0.6)',
                                                                    opacity: 0,
                                                                    transition: 'opacity 0.2s',
                                                                    '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' }
                                                                }}
                                                            >
                                                                <EditIcon sx={{ color: 'white', fontSize: 16 }} />
                                                            </IconButton>
                                                        )}
                                                    </Box>
                                                </Grid>
                                            ))}
                                        </Grid>
                                    );
                                })()}
                            </CardContent>
                        </Card>
                    )}
                </Container>

                {/* Edit Profile Modal */}
                <EditProfileModal
                    open={editModalOpen}
                    onClose={() => setEditModalOpen(false)}
                    profile={profile}
                    onUpdate={handleProfileUpdate}
                />

                {/* Create Post Modal */}
                <CreatePostModal
                    open={createPostModalOpen}
                    onClose={() => setCreatePostModalOpen(false)}
                    onPostCreated={handlePostCreated}
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
                            // Update local posts state
                            setPosts(prev => prev.map(p => p._id === updatedPost._id ? updatedPost : p));
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
                <Menu
                    anchorEl={menuAnchor}
                    open={Boolean(menuAnchor)}
                    onClose={handleCloseMenu}
                    PaperProps={{
                        sx: {
                            width: 320,
                            borderRadius: 2,
                            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                            mt: 1
                        }
                    }}
                >
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

                {/* Friend Action Menu */}
                <Menu
                    anchorEl={friendMenuAnchor}
                    open={Boolean(friendMenuAnchor)}
                    onClose={handleCloseFriendMenu}
                    PaperProps={{
                        sx: {
                            width: 280,
                            borderRadius: 2,
                            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                            mt: 1,
                            bgcolor: 'white',
                        }
                    }}
                >
                    <MenuItem
                        onClick={() => {
                            if (selectedFriend) handleUnfriend(selectedFriend._id);
                        }}
                        sx={{ py: 1.5, '&:hover': { bgcolor: '#f0f2f5' } }}
                    >
                        <ListItemIcon>
                            <PersonRemoveIcon sx={{ color: '#050505' }} />
                        </ListItemIcon>
                        <ListItemText
                            primary="Hủy kết bạn"
                            primaryTypographyProps={{ color: '#050505', fontWeight: 500 }}
                        />
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            handleCloseFriendMenu();
                            setBlockFriendDialogOpen(true);
                        }}
                        sx={{ py: 1.5, '&:hover': { bgcolor: '#f0f2f5' } }}
                    >
                        <ListItemIcon>
                            <BlockIcon sx={{ color: '#050505' }} />
                        </ListItemIcon>
                        <ListItemText
                            primary="Chặn người dùng"
                            primaryTypographyProps={{ color: '#050505', fontWeight: 500 }}
                        />
                    </MenuItem>
                </Menu>

                {/* Profile Settings Menu */}
                <Menu
                    anchorEl={profileSettingsAnchor}
                    open={Boolean(profileSettingsAnchor)}
                    onClose={handleCloseProfileSettings}
                    PaperProps={{
                        sx: {
                            width: 320,
                            borderRadius: 2,
                            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                            mt: 1,
                            bgcolor: 'white',
                        }
                    }}
                >
                    <MenuItem
                        onClick={handleCloseProfileSettings}
                        sx={{ py: 1.5, '&:hover': { bgcolor: '#f0f2f5' } }}
                    >
                        <ListItemIcon>
                            <SearchIcon sx={{ color: '#050505' }} />
                        </ListItemIcon>
                        <ListItemText
                            primary="Tìm hỗ trợ hoặc báo cáo"
                            primaryTypographyProps={{ color: '#050505', fontWeight: 500 }}
                        />
                    </MenuItem>
                    {isOwnProfile && (
                        <>
                            <MenuItem
                                onClick={handleCloseProfileSettings}
                                sx={{ py: 1.5, '&:hover': { bgcolor: '#f0f2f5' } }}
                            >
                                <ListItemIcon>
                                    <PauseCircleIcon sx={{ color: '#050505' }} />
                                </ListItemIcon>
                                <ListItemText
                                    primary="Tạm khóa trang cá nhân"
                                    secondary="Tạm ẩn trang cá nhân và thông tin của bạn"
                                    primaryTypographyProps={{ color: '#050505', fontWeight: 500 }}
                                    secondaryTypographyProps={{ color: '#65676b', fontSize: 12 }}
                                />
                            </MenuItem>
                            <MenuItem
                                onClick={handleGoToSettings}
                                sx={{ py: 1.5, '&:hover': { bgcolor: '#f0f2f5' } }}
                            >
                                <ListItemIcon>
                                    <SettingsIcon sx={{ color: '#050505' }} />
                                </ListItemIcon>
                                <ListItemText
                                    primary="Cài đặt trang cá nhân"
                                    primaryTypographyProps={{ color: '#050505', fontWeight: 500 }}
                                />
                            </MenuItem>
                        </>
                    )}
                    {!isOwnProfile && (
                        <MenuItem
                            onClick={() => {
                                handleCloseProfileSettings();
                                setBlockDialogOpen(true);
                            }}
                            sx={{ py: 1.5, '&:hover': { bgcolor: '#f0f2f5' } }}
                        >
                            <ListItemIcon>
                                <BlockIcon sx={{ color: '#050505' }} />
                            </ListItemIcon>
                            <ListItemText
                                primary="Chặn"
                                primaryTypographyProps={{ color: '#050505', fontWeight: 500 }}
                            />
                        </MenuItem>
                    )}
                </Menu>

                {/* Avatar Menu */}
                <Menu
                    anchorEl={avatarMenuAnchor}
                    open={Boolean(avatarMenuAnchor)}
                    onClose={handleCloseAvatarMenu}
                    PaperProps={{
                        sx: {
                            width: 280,
                            borderRadius: 2,
                            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                            mt: 1,
                            bgcolor: 'white',
                        }
                    }}
                >
                    <MenuItem
                        onClick={handleViewAvatar}
                        sx={{ py: 1.5, '&:hover': { bgcolor: '#f0f2f5' } }}
                    >
                        <ListItemIcon>
                            <VisibilityIcon sx={{ color: '#050505' }} />
                        </ListItemIcon>
                        <ListItemText
                            primary="Xem ảnh đại diện"
                            primaryTypographyProps={{ color: '#050505', fontWeight: 500 }}
                        />
                    </MenuItem>
                    <MenuItem
                        onClick={handleUploadAvatar}
                        sx={{ py: 1.5, '&:hover': { bgcolor: '#f0f2f5' } }}
                    >
                        <ListItemIcon>
                            <CloudUploadIcon sx={{ color: '#050505' }} />
                        </ListItemIcon>
                        <ListItemText
                            primary="Tải ảnh lên"
                            primaryTypographyProps={{ color: '#050505', fontWeight: 500 }}
                        />
                    </MenuItem>
                </Menu>

                {/* Cover Menu */}
                <Menu
                    anchorEl={coverMenuAnchor}
                    open={Boolean(coverMenuAnchor)}
                    onClose={handleCloseCoverMenu}
                    PaperProps={{
                        sx: {
                            width: 280,
                            borderRadius: 2,
                            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                            mt: 1,
                            bgcolor: 'white',
                        }
                    }}
                >
                    <MenuItem
                        onClick={handleViewCover}
                        sx={{ py: 1.5, '&:hover': { bgcolor: '#f0f2f5' } }}
                    >
                        <ListItemIcon>
                            <VisibilityIcon sx={{ color: '#050505' }} />
                        </ListItemIcon>
                        <ListItemText
                            primary="Xem ảnh bìa"
                            primaryTypographyProps={{ color: '#050505', fontWeight: 500 }}
                        />
                    </MenuItem>
                    <MenuItem
                        onClick={handleUploadCoverFromMenu}
                        sx={{ py: 1.5, '&:hover': { bgcolor: '#f0f2f5' } }}
                    >
                        <ListItemIcon>
                            <CloudUploadIcon sx={{ color: '#050505' }} />
                        </ListItemIcon>
                        <ListItemText
                            primary="Tải ảnh bìa lên"
                            primaryTypographyProps={{ color: '#050505', fontWeight: 500 }}
                        />
                    </MenuItem>
                </Menu>

                {/* Cover Photo Edit Modal */}
                <Dialog
                    open={openCoverEditModal}
                    onClose={handleCloseCoverEditModal}
                    maxWidth="md"
                    fullWidth
                    PaperProps={{
                        sx: {
                            borderRadius: 2,
                            bgcolor: 'white',
                        }
                    }}
                >
                    <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e4e6eb' }}>
                        <Typography variant="h6" fontWeight={700} color="#050505">
                            Cập nhật ảnh bìa
                        </Typography>
                        <IconButton onClick={handleCloseCoverEditModal}>
                            <CloseIcon />
                        </IconButton>
                    </DialogTitle>
                    <DialogContent sx={{ p: 0 }}>
                        {/* Preview Area */}
                        <Box
                            sx={{
                                position: 'relative',
                                height: 300,
                                background: coverPreviewUrl
                                    ? `url(${coverPreviewUrl}) center/cover no-repeat`
                                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            }}
                        >
                            {!coverPreviewUrl && (
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                    <Typography color="white" fontSize={16}>
                                        Chưa có ảnh bìa
                                    </Typography>
                                </Box>
                            )}
                        </Box>

                        {/* Upload Section */}
                        <Box sx={{ p: 3 }}>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleCoverFileSelect}
                                style={{ display: 'none' }}
                                id="cover-upload-input"
                            />
                            <label htmlFor="cover-upload-input">
                                <Button
                                    variant="outlined"
                                    component="span"
                                    startIcon={<CloudUploadIcon />}
                                    fullWidth
                                    sx={{
                                        py: 1.5,
                                        borderColor: '#e4e6eb',
                                        color: '#050505',
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        '&:hover': { borderColor: '#1877f2', bgcolor: '#f0f2f5' }
                                    }}
                                >
                                    Chọn ảnh từ máy tính
                                </Button>
                            </label>
                            {selectedCoverFile && (
                                <Typography color="#65676b" fontSize={14} sx={{ mt: 1, textAlign: 'center' }}>
                                    Đã chọn: {selectedCoverFile.name}
                                </Typography>
                            )}
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ p: 2, borderTop: '1px solid #e4e6eb' }}>
                        <Button
                            onClick={handleCloseCoverEditModal}
                            sx={{ textTransform: 'none', color: '#65676b' }}
                        >
                            Hủy
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleSaveCoverPhoto}
                            disabled={!selectedCoverFile || uploadingCover}
                            sx={{
                                bgcolor: '#1877f2',
                                textTransform: 'none',
                                fontWeight: 600,
                                '&:hover': { bgcolor: '#166fe5' },
                                '&:disabled': { bgcolor: '#e4e6eb' }
                            }}
                        >
                            {uploadingCover ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Lưu thay đổi'}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Block User Dialog */}
                <Dialog
                    open={blockDialogOpen}
                    onClose={() => setBlockDialogOpen(false)}
                    PaperProps={{
                        sx: {
                            borderRadius: 3,
                            width: '400px',
                            maxWidth: '90vw'
                        }
                    }}
                >
                    <DialogTitle
                        sx={{
                            textAlign: 'center',
                            pt: 3,
                            pb: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 1
                        }}
                    >
                        <Box
                            sx={{
                                width: 60,
                                height: 60,
                                borderRadius: '50%',
                                bgcolor: '#fee2e2',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mb: 1
                            }}
                        >
                            <BlockIcon sx={{ fontSize: 32, color: '#dc2626' }} />
                        </Box>
                        <Typography variant="h6" fontWeight={700}>
                            Chặn {profile?.firstName} {profile?.lastName}?
                        </Typography>
                    </DialogTitle>
                    <DialogContent>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            textAlign="center"
                            sx={{ px: 2 }}
                        >
                            Khi bạn chặn người này:
                        </Typography>
                        <Box component="ul" sx={{ pl: 3, mt: 1, mb: 0, color: 'text.secondary' }}>
                            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                                Họ sẽ không thể nhắn tin cho bạn
                            </Typography>
                            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                                Bạn sẽ không thể nhắn tin cho họ
                            </Typography>
                            <Typography component="li" variant="body2">
                                Cuộc trò chuyện sẽ bị ẩn khỏi danh sách của bạn
                            </Typography>
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 3, gap: 1, justifyContent: 'center' }}>
                        <Button
                            onClick={() => setBlockDialogOpen(false)}
                            variant="outlined"
                            sx={{
                                flex: 1,
                                borderRadius: 2,
                                textTransform: 'none',
                                fontWeight: 600,
                                borderColor: '#e4e6eb',
                                color: '#050505',
                                '&:hover': {
                                    borderColor: '#bcc0c4',
                                    bgcolor: '#f0f2f5'
                                }
                            }}
                        >
                            Hủy
                        </Button>
                        <Button
                            onClick={handleBlockUser}
                            variant="contained"
                            disabled={isBlocking}
                            sx={{
                                flex: 1,
                                borderRadius: 2,
                                textTransform: 'none',
                                fontWeight: 600,
                                bgcolor: '#dc2626',
                                '&:hover': { bgcolor: '#b91c1c' },
                                '&:disabled': { bgcolor: '#fca5a5' }
                            }}
                        >
                            {isBlocking ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Chặn'}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Block Friend Dialog */}
                <Dialog
                    open={blockFriendDialogOpen}
                    onClose={() => setBlockFriendDialogOpen(false)}
                    PaperProps={{
                        sx: {
                            borderRadius: 3,
                            width: '400px',
                            maxWidth: '90vw'
                        }
                    }}
                >
                    <DialogTitle
                        sx={{
                            textAlign: 'center',
                            pt: 3,
                            pb: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 1
                        }}
                    >
                        <Box
                            sx={{
                                width: 60,
                                height: 60,
                                borderRadius: '50%',
                                bgcolor: '#fee2e2',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mb: 1
                            }}
                        >
                            <BlockIcon sx={{ fontSize: 32, color: '#dc2626' }} />
                        </Box>
                        <Typography variant="h6" fontWeight={700}>
                            Chặn {selectedFriend?.firstName} {selectedFriend?.lastName}?
                        </Typography>
                    </DialogTitle>
                    <DialogContent>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            textAlign="center"
                            sx={{ px: 2 }}
                        >
                            Khi bạn chặn người này:
                        </Typography>
                        <Box component="ul" sx={{ pl: 3, mt: 1, mb: 0, color: 'text.secondary' }}>
                            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                                Họ sẽ không thể nhắn tin cho bạn
                            </Typography>
                            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                                Bạn sẽ không thể nhắn tin cho họ
                            </Typography>
                            <Typography component="li" variant="body2">
                                Cuộc trò chuyện sẽ bị ẩn khỏi danh sách của bạn
                            </Typography>
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 3, gap: 1, justifyContent: 'center' }}>
                        <Button
                            onClick={() => setBlockFriendDialogOpen(false)}
                            variant="outlined"
                            sx={{
                                flex: 1,
                                borderRadius: 2,
                                textTransform: 'none',
                                fontWeight: 600,
                                borderColor: '#e4e6eb',
                                color: '#050505',
                                '&:hover': {
                                    borderColor: '#bcc0c4',
                                    bgcolor: '#f0f2f5'
                                }
                            }}
                        >
                            Hủy
                        </Button>
                        <Button
                            onClick={handleBlockFriend}
                            variant="contained"
                            disabled={isBlocking}
                            sx={{
                                flex: 1,
                                borderRadius: 2,
                                textTransform: 'none',
                                fontWeight: 600,
                                bgcolor: '#dc2626',
                                '&:hover': { bgcolor: '#b91c1c' },
                                '&:disabled': { bgcolor: '#fca5a5' }
                            }}
                        >
                            {isBlocking ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Chặn'}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </Box>
    );
}
