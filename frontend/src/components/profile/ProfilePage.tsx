'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Box,
    Chip,
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
    useTheme,
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
import { conversationService } from '@/services/conversation.service';
import { useRouter } from 'next/navigation';
import EditProfileModal from '@/components/profile/EditProfileModal';
import CreatePostModal from '@/components/posts/CreatePostModal';
import EditPostModal from '@/components/posts/EditPostModal';
import PostItem from '@/components/posts/PostItem';
import ImageViewer from '@/components/posts/ImageViewer';
import CommentContentModal from '@/components/posts/CommentContentModal';
import ShareContentModal from '@/components/posts/ShareContentModal';
import PostOptionContentMenu from '@/components/posts/PostOptionContentMenu';
import LiveStreamViewerModal from '@/components/posts/LiveStreamViewerModal';
import MutualFriendsPreview from '@/components/friends/MutualFriendsPreview';
import Header from '@/components/home/Header';
import { CLIENT_PATH } from '@/constants/paths';
import { toast } from 'sonner';
import { usePostStore } from '@/stores/usePostStore';
import { useDeletePost } from '@/queries/usePostQueries';
import { useSocket } from '@/contexts/SocketContext';
import { useGetUserPostsInfinite } from '@/queries/usePostQueries';
import { useInView } from 'react-intersection-observer';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/query-keys';
import { useTranslation } from 'react-i18next';

interface ProfilePageProps {
    userName: string;
}

export default function ProfilePage({ userName }: ProfilePageProps) {
    const { user, isLoading: authLoading } = useAuthStore();
    const router = useRouter();
    const deletePostMutation = useDeletePost();
    const { addPost, deletePost: deletePostFromStore } = usePostStore();
    const { socketRelationship } = useSocket();
    const queryClient = useQueryClient();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const mainBg = theme.palette.mode === 'dark' ? theme.palette.background.default : '#f0f2f5';
    const paperBg = theme.palette.background.paper;
    const textPrimary = theme.palette.text.primary;
    const textSecondary = theme.palette.text.secondary;
    const { t } = useTranslation();

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
    const [friendSearchQuery, setFriendSearchQuery] = useState('');

    // Friendship status
    const [isFriend, setIsFriend] = useState(false);

    // Infinite Scroll Posts
    const { ref: loadMoreRef, inView } = useInView();
    const {
        data: postsData,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading: postsLoading
    } = useGetUserPostsInfinite(
        profile?._id || '',
        5 // limit
    );
    // Flatten pages
    const posts = React.useMemo(() => {
        return postsData?.pages.flatMap(page => page.data || []) || [];
    }, [postsData]);

    useEffect(() => {
        if (inView && hasNextPage) {
            fetchNextPage();
        }
    }, [inView, hasNextPage, fetchNextPage]);
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

    // Livestream Viewer Modal
    const [viewingLivePost, setViewingLivePost] = useState<PostType | null>(null);


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
    const coverPreviewUrlRef = useRef<string>('');
    const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null);

    // Revoke local blob object URLs used as cover previews on close/replace/unmount
    // (remote profile.background URLs must never be revoked)
    const revokeCoverPreviewIfBlob = useCallback((url: string) => {
        if (url && url.startsWith('blob:')) {
            try { URL.revokeObjectURL(url); } catch (_) { /* already revoked */ }
        }
    }, []);

    useEffect(() => {
        coverPreviewUrlRef.current = coverPreviewUrl;
    }, [coverPreviewUrl]);

    useEffect(() => () => {
        revokeCoverPreviewIfBlob(coverPreviewUrlRef.current);
    }, [revokeCoverPreviewIfBlob]);


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

    // Fetched by hook now
    // useEffect(() => {
    //     const fetchPosts = async () => { ... }
    // }, ...);

    const handlePostCreated = useCallback((newPost: PostType) => {
        setCreatePostModalOpen(false);
        // Invalidating query is handled by the hook usually, or we do it here if needed
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.USER_POSTS] });
    }, [queryClient]);

    const handleProfileUpdate = (updatedProfile: ProfileType) => {
        setProfile(updatedProfile);
        // Sync avatar to auth store for Header and other components
        if (isOwnProfile && updatedProfile.avatar) {
            useAuthStore.getState().updateUser({ avatar: updatedProfile.avatar });
        }
    };

    const handleMessage = async () => {
        if (!profile?._id) return;
        try {
            const conversation = await conversationService.getOrCreateDirectConversation(profile._id);
            router.push(`/chat/${conversation._id}`);
        } catch (error) {
            console.error('Error creating conversation:', error);
            toast.error(t('common.error'));
        }
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
                toast.success(t('profile.avatar_updated'));
            }
        } catch (error) {
            console.error('Error uploading avatar:', error);
            toast.error(t('profile.upload_error'));
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
                toast.success(t('profile.cover_updated'));
            }
        } catch (error) {
            console.error('Error uploading cover:', error);
            toast.error(t('profile.upload_error'));
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
            case 'MALE': return t('profile.male');
            case 'FEMALE': return t('profile.female');
            default: return t('profile.other');
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
            // Invalidate triggers refetch
            handleCloseMenu();
            toast.success(t('profile.post_deleted'));
        } catch (error) {
            console.error('Error deleting post:', error);
            toast.error(t('profile.post_delete_error'));
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
        // If it's a live stream, open the viewer instead of comments
        if (post.type === 'LIVESTREAM' && post.livestreamStatus === 'LIVE') {
            setViewingLivePost(post);
            return;
        }
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
            // Update local posts state via invalidation
            queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.USER_POSTS] });
            setMenuPost({ ...menuPost, allowComments: allow });
        } catch (error) {
            console.error('Error toggling comments:', error);
        }
    };

    const handleToggleShares = async (allow: boolean) => {
        if (!menuPost) return;
        try {
            await postService.updatePost(menuPost._id, { allowShares: allow });
            queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.USER_POSTS] });
            setMenuPost({ ...menuPost, allowShares: allow });
        } catch (error) {
            console.error('Error toggling shares:', error);
        }
    };

    const handleToggleReactions = async (allow: boolean) => {
        if (!menuPost) return;
        try {
            await postService.updatePost(menuPost._id, { allowReactions: allow });
            queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.USER_POSTS] });
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
            toast.success(t('profile.friend_request_sent'));
        } catch (error) {
            console.error('Error adding friend:', error);
            toast.error(t('profile.friend_request_error'));
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
            toast.success(t('profile.unfriended'));
        } catch (error) {
            console.error('Error unfriending:', error);
            toast.error(t('profile.unfriend_error'));
        }
    };

    // Cancel friend request handler
    const handleCancelFriendRequest = async () => {
        if (!user?.id || !profile?._id) return;
        try {
            await relationshipService.updateStatusRelationship(user.id, profile._id, 'CANCELED');
            setFriendshipStatus(null);
            toast.success(t('profile.request_canceled'));
        } catch (error) {
            console.error('Error canceling friend request:', error);
            toast.error(t('profile.request_cancel_error'));
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
                        toast.success(t('profile.user_blocked'));
                        setBlockDialogOpen(false);
                        setProfileSettingsAnchor(null);
                        router.push('/');
                    } else {
                        toast.error(response.error || t('profile.block_error'));
                    }
                    setIsBlocking(false);
                });
            } else {
                // Fallback to REST API
                await relationshipService.blockUser(profile._id);
                toast.success(t('profile.user_blocked'));
                setBlockDialogOpen(false);
                setProfileSettingsAnchor(null);
                router.push('/');
                setIsBlocking(false);
            }
        } catch (error) {
            console.error('Failed to block user:', error);
            toast.error(t('profile.block_error'));
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
                        toast.success(t('profile.user_blocked'));
                        setBlockFriendDialogOpen(false);
                        setFriendMenuAnchor(null);
                        setFriends(friends.filter(f => f._id !== selectedFriend._id));
                        setSelectedFriend(null);
                    } else {
                        toast.error(response.error || t('profile.block_error'));
                    }
                    setIsBlocking(false);
                });
            } else {
                // Fallback to REST API
                await relationshipService.blockUser(selectedFriend._id);
                toast.success(t('profile.user_blocked'));
                setBlockFriendDialogOpen(false);
                setFriendMenuAnchor(null);
                setFriends(friends.filter(f => f._id !== selectedFriend._id));
                setSelectedFriend(null);
                setIsBlocking(false);
            }
        } catch (error) {
            console.error('Failed to block friend:', error);
            toast.error(t('profile.block_error'));
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
        revokeCoverPreviewIfBlob(coverPreviewUrlRef.current);
        setCoverPreviewUrl(profile?.background || '');
        setSelectedCoverFile(null);
        setOpenCoverEditModal(true);
    };

    const handleCloseCoverEditModal = () => {
        setOpenCoverEditModal(false);
        revokeCoverPreviewIfBlob(coverPreviewUrlRef.current);
        setCoverPreviewUrl('');
        setSelectedCoverFile(null);
    };

    const handleCoverFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedCoverFile(file);
            revokeCoverPreviewIfBlob(coverPreviewUrlRef.current);
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
                toast.success(t('profile.cover_updated'));
                handleCloseCoverEditModal();
            }
        } catch (error) {
            console.error('Error uploading cover:', error);
            toast.error(t('profile.upload_error'));
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
        // Handle Livestream Post
        if (post.type === 'LIVESTREAM') {
            const isLive = post.livestreamStatus === 'LIVE';
            const isEnded = post.livestreamStatus === 'ENDED';
            const hasVideo = post.media && post.media.length > 0 && post.media[0].url;
            const userAvatar = typeof post.userId !== 'string' ? post.userId?.avatar : '';

            // If currently LIVE - show clickable card to watch
            if (isLive) {
                return (
                    <Box
                        onClick={(e) => {
                            e.stopPropagation();
                            setViewingLivePost(post);
                        }}
                        sx={{
                            mb: 2,
                            position: 'relative',
                            height: 260,
                            bgcolor: isDark ? '#1c1e21' : '#e4e6eb',
                            borderRadius: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            transition: 'transform 0.2s',
                            '&:hover': { transform: 'scale(1.01)' }
                        }}
                    >
                        {/* Background */}
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
                            {post.livestreamStatus === 'LIVE' ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <Box sx={{
                                        position: 'relative',
                                        mb: 2,
                                        animation: 'pulse 1.5s infinite ease-in-out',
                                        '@keyframes pulse': {
                                            '0%': { transform: 'scale(1)' },
                                            '50%': { transform: 'scale(1.05)' },
                                            '100%': { transform: 'scale(1)' },
                                        }
                                    }}>
                                        <Chip
                                            icon={<Box sx={{ width: 8, height: 8, bgcolor: 'white', borderRadius: '50%', ml: 0.5 }} />}
                                            label={t('profile.live_label')}
                                            sx={{
                                                bgcolor: '#e41e3f',
                                                color: 'white',
                                                fontWeight: 800,
                                                fontSize: 14,
                                                px: 1,
                                                boxShadow: '0 0 15px rgba(228, 30, 63, 0.6)',
                                                '& .MuiChip-label': { px: 1 }
                                            }}
                                        />
                                    </Box>
                                    <Typography variant="h5" sx={{ color: 'white', fontWeight: 700, mb: 1, textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                                        {t('profile.user_is_live', { name: post.userId?.firstName + " " + post.userId?.lastName })}
                                    </Typography>
                                    <Box sx={{
                                        mt: 1,
                                        bgcolor: 'rgba(255,255,255,0.2)',
                                        px: 2, py: 0.8,
                                        borderRadius: 50,
                                        backdropFilter: 'blur(10px)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        transition: 'all 0.2s',
                                        '&:hover': { bgcolor: 'rgba(255,255,255,0.3)', transform: 'scale(1.05)' }
                                    }}>
                                        <Typography sx={{ color: 'white', fontWeight: 600, fontSize: 13 }}>
                                            {t('profile.join_now')}
                                        </Typography>
                                    </Box>
                                </Box>
                            ) : (
                                <>
                                    <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                                        {t('profile.live_ended')}
                                    </Typography>
                                </>
                            )}
                        </Box>
                    </Box>
                );
            }

            // Ended with video
            if (hasVideo) {
                return (
                    <Box sx={{ mb: 2, width: '100%', position: 'relative' }}>
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
                        <Box sx={{
                            position: 'absolute',
                            top: 12,
                            left: 12,
                            bgcolor: 'rgba(0,0,0,0.7)',
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 1
                        }}>
                            <Typography sx={{ color: 'white', fontSize: 12, fontWeight: 600 }}>
                                {t('profile.replay')}
                            </Typography>
                        </Box>
                    </Box>
                );
            }

            // Ended without video
            return (
                <Box
                    sx={{
                        mb: 2,
                        position: 'relative',
                        height: 220,
                        bgcolor: isDark ? '#1c1e21' : '#e4e6eb',
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden'
                    }}
                >
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="body1" sx={{ color: textSecondary, fontWeight: 500 }}>
                            {t('profile.live_ended')}
                        </Typography>
                        <Typography variant="body2" sx={{ color: textSecondary, mt: 0.5 }}>
                            {t('profile.video_not_saved')}
                        </Typography>
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
            <Box sx={{ bgcolor: mainBg, minHeight: '100vh' }}>
                <Header />
                <Box sx={{ pt: '56px' }}>
                    <Box sx={{ bgcolor: paperBg, boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.1)' }}>
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
            <Box sx={{ bgcolor: mainBg, minHeight: '100vh' }}>
                <Header />
                <Box sx={{ pt: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 56px)' }}>
                    <Typography color="text.primary">{t('profile.not_found')}</Typography>
                </Box>
            </Box>
        );
    }

    const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();

    return (
        <Box sx={{ bgcolor: mainBg, minHeight: '100vh', pb: { xs: '64px', md: 0 } }}>
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
                <Box sx={{ bgcolor: paperBg, boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.1)' }}>
                    <Container maxWidth="lg">
                        {/* Cover Photo */}
                        <Box
                            sx={{
                                position: 'relative',
                                height: { xs: 200, sm: 250, md: 350 },
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
                                        bgcolor: paperBg,
                                        zIndex: 15,
                                        color: textPrimary,
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        '&:hover': { bgcolor: isDark ? theme.palette.action.hover : '#f0f2f5' }
                                    }}
                                    onClick={profile.background ? handleOpenCoverMenu : handleOpenCoverEditModal}
                                    disabled={uploadingCover}
                                >
                                    {profile.background ? t('profile.edit_cover_desc') : t('profile.edit_cover_desc')}
                                </Button>
                            )}
                        </Box>

                        {/* Profile Info */}
                        <Box sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', md: 'row' },
                            alignItems: { xs: 'center', md: 'flex-end' },
                            mt: { xs: -8, md: -6 },
                            px: { xs: 2, md: 4 },
                            pb: 2,
                            position: 'relative'
                        }}>
                            {/* Avatar */}
                            <Box sx={{ position: 'relative' }}>
                                <Avatar
                                    src={profile.avatar}
                                    sx={{
                                        width: { xs: 140, md: 168 },
                                        height: { xs: 140, md: 168 },
                                        border: `4px solid ${paperBg}`,
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                        bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb',
                                        fontSize: 64,
                                        color: isDark ? theme.palette.text.secondary : '#65676b',
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
                                            bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb',
                                            border: `2px solid ${paperBg}`,
                                            '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.2)' : '#d8dadf' }
                                        }}
                                        onClick={handleOpenAvatarMenu}
                                        disabled={uploadingAvatar}
                                    >
                                        <PhotoCameraIcon sx={{ fontSize: 20, color: textPrimary }} />
                                    </IconButton>
                                )}
                            </Box>

                            {/* Name & Friends Count */}
                            <Box sx={{
                                ml: { xs: 0, md: 3 },
                                mt: { xs: 2, md: 0 },
                                mb: 1,
                                flex: 1,
                                textAlign: { xs: 'center', md: 'left' },
                                width: { xs: '100%', md: 'auto' }
                            }}>
                                <Typography variant="h4" fontWeight={700} color={textPrimary} sx={{ fontSize: { xs: '1.75rem', md: '2.125rem' } }}>
                                    {fullName}
                                </Typography>
                                <Typography color={textSecondary} fontWeight={500} fontSize={15}>
                                    {t('profile.friends_count', { count: friends.length })}
                                </Typography>
                                {/* Friends avatars preview */}
                                {friends.length > 0 && (
                                    <Box sx={{ display: 'flex', mt: 0.5, justifyContent: { xs: 'center', md: 'flex-start' } }}>
                                        {friends.slice(0, 8).map((friend, idx) => (
                                            <Avatar
                                                key={friend._id}
                                                src={friend.avatar}
                                                sx={{
                                                    width: 32,
                                                    height: 32,
                                                    border: `2px solid ${paperBg}`,
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
                            <Box sx={{
                                display: 'flex',
                                flexDirection: { xs: 'column', sm: 'row' },
                                gap: 1,
                                mb: 1,
                                width: { xs: '100%', md: 'auto' }
                            }}>
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
                                            {t('profile.add_to_story')}
                                        </Button>
                                        <Button
                                            variant="contained"
                                            startIcon={<EditIcon />}
                                            sx={{
                                                bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb',
                                                color: textPrimary,
                                                textTransform: 'none',
                                                fontWeight: 600,
                                                '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.2)' : '#d8dadf' }
                                            }}
                                            onClick={() => setEditModalOpen(true)}
                                        >
                                            {t('profile.edit_profile')}
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
                                                    bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb',
                                                    color: textPrimary,
                                                    textTransform: 'none',
                                                    fontWeight: 600,
                                                }}
                                            >
                                                <CircularProgress size={20} sx={{ mr: 1 }} />
                                                {t('common.loading')}
                                            </Button>
                                        ) : isFriend ? (
                                            <Button
                                                variant="contained"
                                                startIcon={<CheckIcon />}
                                                sx={{
                                                    bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb',
                                                    color: textPrimary,
                                                    textTransform: 'none',
                                                    fontWeight: 600,
                                                    '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.2)' : '#d8dadf' }
                                                }}
                                                onClick={() => handleUnfriend()}
                                            >
                                                {t('profile.friend_status')}
                                            </Button>
                                        ) : friendshipStatus === 'PENDING' ? (
                                            <Button
                                                variant="contained"
                                                startIcon={<CancelIcon />}
                                                sx={{
                                                    bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb',
                                                    color: textPrimary,
                                                    textTransform: 'none',
                                                    fontWeight: 600,
                                                    '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.2)' : '#d8dadf' }
                                                }}
                                                onClick={handleCancelFriendRequest}
                                            >
                                                {t('profile.cancel_request')}
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
                                                {t('profile.add_friend')}
                                            </Button>
                                        )}
                                        <Button
                                            variant="contained"
                                            startIcon={<MessageIcon />}
                                            sx={{
                                                bgcolor: isFriend ? 'primary.main' : (isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb'),
                                                color: isFriend ? 'white' : textPrimary,
                                                textTransform: 'none',
                                                fontWeight: 600,
                                                '&:hover': { bgcolor: isFriend ? 'primary.dark' : (isDark ? 'rgba(255,255,255,0.2)' : '#d8dadf') }
                                            }}
                                            onClick={handleMessage}
                                        >
                                            {t('profile.message')}
                                        </Button>
                                    </>
                                )}
                                <Button
                                    variant="contained"
                                    sx={{
                                        bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb',
                                        color: textPrimary,
                                        minWidth: 48,
                                        px: 0,
                                        '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.2)' : '#d8dadf' }
                                    }}
                                    onClick={handleOpenProfileSettings}
                                >
                                    <MoreIcon />
                                </Button>
                            </Box>
                        </Box>

                        <Divider sx={{ mx: { xs: 1, sm: 2, md: 4 } }} />

                        {/* Tabs */}
                        <Box sx={{ px: { xs: 1, sm: 2, md: 4 } }}>
                            <Tabs
                                variant="scrollable"
                                scrollButtons="auto"
                                allowScrollButtonsMobile
                                value={activeTab}
                                onChange={(_, v) => setActiveTab(v)}
                                sx={{
                                    '& .MuiTab-root': {
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        fontSize: 15,
                                        color: textSecondary,
                                        minWidth: 'auto',
                                        px: 2,
                                        '&.Mui-selected': { color: 'primary.main' }
                                    },
                                    '& .MuiTabs-indicator': { bgcolor: 'primary.main', height: 3 }
                                }}
                            >
                                <Tab label={t('profile.posts')} />
                                <Tab label={t('profile.about')} />
                                <Tab label={t('profile.friends')} />
                                <Tab label={t('profile.photos')} />
                                <Tab label={t('profile.more')} />
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
                                <Card sx={{ bgcolor: paperBg, borderRadius: 2, boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.1)' }}>
                                    <CardContent>
                                        <Typography variant="h6" fontWeight={700} color={textPrimary} gutterBottom>
                                            {t('profile.about')}
                                        </Typography>

                                        {/* Bio */}
                                        {profile.bio ? (
                                            <Typography color={textPrimary} fontSize={15} textAlign="center" sx={{ mb: 2 }}>
                                                {profile.bio}
                                            </Typography>
                                        ) : isOwnProfile && (
                                            <Button
                                                fullWidth
                                                sx={{
                                                    bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb',
                                                    color: textPrimary,
                                                    textTransform: 'none',
                                                    fontWeight: 500,
                                                    mb: 2,
                                                    '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.2)' : '#d8dadf' }
                                                }}
                                                onClick={() => setEditModalOpen(true)}
                                            >
                                                {t('profile.add_bio')}
                                            </Button>
                                        )}

                                        {/* Info Items */}
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                            {profile.addresses && profile.addresses.length > 0 && (
                                                profile.addresses.map((addr, idx) => (
                                                    <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                        <HomeIcon sx={{ fontSize: 20, color: textSecondary }} />
                                                        <Typography color={textPrimary} fontSize={15}>
                                                            {t('profile.lives_in')} <strong>{addr.ward?.name}, {addr.district?.name}, {addr.province?.name}</strong>
                                                        </Typography>
                                                    </Box>
                                                ))
                                            )}

                                            {profile.birthday && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                    <CakeIcon sx={{ fontSize: 20, color: textSecondary }} />
                                                    <Typography color={textPrimary} fontSize={15}>
                                                        {t('profile.born_on')} <strong>{formatDate(profile.birthday)}</strong>
                                                    </Typography>
                                                </Box>
                                            )}

                                            {profile.phone && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                    <PhoneIcon sx={{ fontSize: 20, color: textSecondary }} />
                                                    <Typography color={textPrimary} fontSize={15}>
                                                        {profile.phone}
                                                    </Typography>
                                                </Box>
                                            )}

                                            {profile.createdAt && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                    <PublicIcon sx={{ fontSize: 20, color: textSecondary }} />
                                                    <Typography color={textPrimary} fontSize={15}>
                                                        {t('profile.joined_from')} <strong>{formatDate(profile.createdAt)}</strong>
                                                    </Typography>
                                                </Box>
                                            )}
                                        </Box>

                                        {isOwnProfile && (
                                            <Button
                                                fullWidth
                                                sx={{
                                                    bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb',
                                                    color: textPrimary,
                                                    textTransform: 'none',
                                                    fontWeight: 500,
                                                    mt: 2,
                                                    '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.2)' : '#d8dadf' }
                                                }}
                                                onClick={() => setEditModalOpen(true)}
                                            >
                                                {t('profile.edit_details')}
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Photos Card */}
                                <Card sx={{ bgcolor: paperBg, borderRadius: 2, boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.1)', mt: 2 }}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                            <Typography variant="h6" fontWeight={700} color={textPrimary}>
                                                {t('profile.photos')}
                                            </Typography>
                                            <Button sx={{ textTransform: 'none', color: 'primary.main' }} onClick={() => setActiveTab(3)}>
                                                {t('profile.photos_all')}
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
                                            <Typography color={textSecondary} fontSize={14}>
                                                {t('profile.no_photos')}
                                            </Typography>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Friends Card */}
                                <Card sx={{ bgcolor: paperBg, borderRadius: 2, boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.1)', mt: 2 }}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                            <Box>
                                                <Typography variant="h6" fontWeight={700} color={textPrimary}>
                                                    {t('profile.friends_section')}
                                                </Typography>
                                                <Typography color={textSecondary} fontSize={14}>
                                                    {t('profile.friends_count', { count: friends.length })}
                                                </Typography>
                                            </Box>
                                            <Button sx={{ textTransform: 'none', color: 'primary.main' }} onClick={() => setActiveTab(2)}>
                                                {t('profile.view_all_friends')}
                                            </Button>
                                        </Box>

                                        {friendsLoading ? (
                                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                                                <CircularProgress size={24} />
                                            </Box>
                                        ) : friends.length === 0 ? (
                                            <Typography color={textSecondary} fontSize={14} textAlign="center" py={2}>
                                                {t('profile.no_friends')}
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
                                                                color={textPrimary}
                                                                sx={{
                                                                    mt: 0.5,
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap'
                                                                }}
                                                            >
                                                                {friend.firstName} {friend.lastName}
                                                            </Typography>
                                                            {!isOwnProfile && (
                                                                <MutualFriendsPreview
                                                                    count={friend.mutualFriends || 0}
                                                                    preview={friend.mutualFriendPreview || []}
                                                                    compact
                                                                />
                                                            )}
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
                                    <Card sx={{ bgcolor: paperBg, borderRadius: 2, boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.1)', mb: 2 }}>
                                        <CardContent>
                                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                                <Avatar
                                                    src={profile.avatar}
                                                    sx={{
                                                        width: 40,
                                                        height: 40,
                                                        bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb',
                                                        color: isDark ? theme.palette.text.secondary : '#65676b',
                                                    }}
                                                >
                                                    {!profile.avatar && fullName.charAt(0)}
                                                </Avatar>
                                                <Button
                                                    fullWidth
                                                    onClick={() => setCreatePostModalOpen(true)}
                                                    sx={{
                                                        bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2f5',
                                                        color: textSecondary,
                                                        textTransform: 'none',
                                                        justifyContent: 'flex-start',
                                                        px: 2,
                                                        py: 1,
                                                        borderRadius: 20,
                                                        '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb' }
                                                    }}
                                                >
                                                    {t('profile.whats_on_mind', { name: fullName })}
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
                                    <Card sx={{ bgcolor: paperBg, borderRadius: 2, boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.1)' }}>
                                        <CardContent sx={{ textAlign: 'center', py: 4 }}>
                                            <Typography color={textSecondary} fontSize={15}>
                                                {t('profile.no_posts')}
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

                                {/* Load More Trigger & Indicator */}
                                <Box ref={loadMoreRef} sx={{ py: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 1 }}>
                                    {isFetchingNextPage && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                            <CircularProgress size={24} sx={{ color: 'primary.main' }} />
                                            <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>{t('profile.loading_more')}</Typography>
                                        </Box>
                                    )}
                                    {!hasNextPage && posts.length > 0 && !isFetchingNextPage && (
                                        <Typography sx={{ color: 'text.secondary', fontSize: 14, textAlign: 'center' }}>
                                            {t('profile.all_posts_loaded')}
                                        </Typography>
                                    )}
                                </Box>
                            </Grid>
                        </Grid>
                    )}

                    {/* Tab 1: Giới thiệu (About) */}
                    {activeTab === 1 && (
                        <Card sx={{ bgcolor: paperBg, borderRadius: 2, boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.1)' }}>
                            <CardContent>
                                <Grid container>
                                    {/* Left sidebar */}
                                    <Grid size={{ xs: 12, md: 4 }} sx={{ borderRight: { md: `1px solid ${theme.palette.divider}` }, pr: { md: 2 } }}>
                                        <Typography variant="h5" fontWeight={700} color={textPrimary} gutterBottom>
                                            {t('profile.about_section')}
                                        </Typography>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                            {[t('profile.about_tabs_overview'), t('profile.about_tabs_work'), t('profile.about_tabs_places'), t('profile.about_tabs_contact'), t('profile.about_tabs_details')].map((item, idx) => (
                                                <Button
                                                    key={idx}
                                                    fullWidth
                                                    sx={{
                                                        justifyContent: 'flex-start',
                                                        textTransform: 'none',
                                                        color: idx === 0 ? 'primary.main' : textPrimary,
                                                        bgcolor: idx === 0 ? (isDark ? 'rgba(45, 136, 255, 0.2)' : '#e7f3ff') : 'transparent',
                                                        fontWeight: idx === 0 ? 600 : 400,
                                                        borderRadius: 2,
                                                        py: 1,
                                                        '&:hover': { bgcolor: idx === 0 ? (isDark ? 'rgba(45, 136, 255, 0.3)' : '#e7f3ff') : (isDark ? 'rgba(255,255,255,0.05)' : '#f0f2f5') }
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
                                                    <AddIcon sx={{ color: 'primary.main', bgcolor: isDark ? 'rgba(45, 136, 255, 0.2)' : '#e7f3ff', borderRadius: '50%', p: 0.5 }} />
                                                    <Typography color="primary.main" fontSize={15} fontWeight={500}>
                                                        {t('profile.add_workplace')}
                                                    </Typography>
                                                </Box>
                                            )}

                                            {/* School info */}
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                <SchoolIcon sx={{ color: textSecondary, fontSize: 24 }} />
                                                <Typography color={textPrimary} fontSize={15}>
                                                    {t('profile.no_school_info')}
                                                </Typography>
                                            </Box>

                                            {/* Location info */}
                                            {profile.addresses && profile.addresses.length > 0 ? (
                                                profile.addresses.map((addr, idx) => (
                                                    <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                        <HomeIcon sx={{ color: textSecondary, fontSize: 24 }} />
                                                        <Typography color={textPrimary} fontSize={15}>
                                                            {t('profile.lives_in')} <strong>{addr.ward?.name}, {addr.district?.name}, {addr.province?.name}</strong>
                                                        </Typography>
                                                    </Box>
                                                ))
                                            ) : isOwnProfile && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', '&:hover': { opacity: 0.8 } }} onClick={() => setEditModalOpen(true)}>
                                                    <AddIcon sx={{ color: 'primary.main', bgcolor: isDark ? 'rgba(45, 136, 255, 0.2)' : '#e7f3ff', borderRadius: '50%', p: 0.5 }} />
                                                    <Typography color="primary.main" fontSize={15} fontWeight={500}>
                                                        {t('profile.add_current_city')}
                                                    </Typography>
                                                </Box>
                                            )}

                                            {/* Birthday */}
                                            {profile.birthday && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                    <CakeIcon sx={{ color: textSecondary, fontSize: 24 }} />
                                                    <Typography color={textPrimary} fontSize={15}>
                                                        {t('profile.birthday_label')} <strong>{formatDate(profile.birthday)}</strong>
                                                    </Typography>
                                                </Box>
                                            )}

                                            {/* Gender */}
                                            {profile.gender && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                    {getGenderIcon(profile.gender)}
                                                    <Typography color={textPrimary} fontSize={15}>
                                                        {getGenderText(profile.gender)}
                                                    </Typography>
                                                </Box>
                                            )}

                                            {/* Phone */}
                                            {profile.phone && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                    <PhoneIcon sx={{ color: textSecondary, fontSize: 24 }} />
                                                    <Typography color={textPrimary} fontSize={15}>
                                                        {profile.phone}
                                                    </Typography>
                                                </Box>
                                            )}

                                            {/* Email */}
                                            {profile.email && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                    <EmailIcon sx={{ color: textSecondary, fontSize: 24 }} />
                                                    <Typography color={textPrimary} fontSize={15}>
                                                        {profile.email}
                                                    </Typography>
                                                </Box>
                                            )}

                                            {/* Join date */}
                                            {profile.createdAt && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                    <PublicIcon sx={{ color: textSecondary, fontSize: 24 }} />
                                                    <Typography color={textPrimary} fontSize={15}>
                                                        {t('profile.joined_label')} <strong>{formatDate(profile.createdAt)}</strong>
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
                        <Card sx={{ bgcolor: paperBg, borderRadius: 2, boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.1)' }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="h5" fontWeight={700} color={textPrimary}>
                                        {t('profile.friends_title')}
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <TextField
                                            placeholder={t('profile.search_placeholder')}
                                            size="small"
                                            value={friendSearchQuery}
                                            onChange={(e) => setFriendSearchQuery(e.target.value)}
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2f5',
                                                    borderRadius: 20,
                                                    '& fieldset': { border: 'none' }
                                                }
                                            }}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <SearchIcon sx={{ color: textSecondary }} />
                                                    </InputAdornment>
                                                )
                                            }}
                                        />
                                        <Button
                                            sx={{ textTransform: 'none', color: 'primary.main' }}
                                            onClick={() => navigateToFriends('requests')}
                                        >
                                            {t('profile.friend_requests')}
                                        </Button>
                                        <Button
                                            sx={{ textTransform: 'none', color: 'primary.main' }}
                                            onClick={() => navigateToFriends('suggestions')}
                                        >
                                            {t('profile.find_friends')}
                                        </Button>
                                    </Box>
                                </Box>

                                <Tabs value={0} sx={{ mb: 2, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 } }}>
                                    <Tab label={t('profile.all_friends_tab')} onClick={() => navigateToFriends('list')} />
                                    <Tab label={t('profile.recently_added_tab')} onClick={() => navigateToFriends('recent')} />
                                </Tabs>

                                {friendsLoading ? (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                        <CircularProgress />
                                    </Box>
                                ) : filteredFriends.length === 0 ? (
                                    <Typography color={textSecondary} textAlign="center" py={4}>
                                        {friendSearchQuery ? t('profile.no_friends_found') : t('profile.no_friends_yet')}
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
                                                        border: `1px solid ${theme.palette.divider}`,
                                                        bgcolor: paperBg,
                                                        cursor: 'pointer',
                                                        '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2f5' }
                                                    }}
                                                    onClick={() => navigateToProfile(friend.username)}
                                                >
                                                    <Avatar
                                                        src={friend.avatar}
                                                        sx={{ width: 80, height: 80, borderRadius: 2 }}
                                                    />
                                                    <Box sx={{ flex: 1 }}>
                                                        <Typography fontWeight={600} color={textPrimary}>
                                                            {friend.firstName} {friend.lastName}
                                                        </Typography>
                                                        <Typography fontSize={13} color={textSecondary}>
                                                            @{friend.username}
                                                        </Typography>
                                                        {!isOwnProfile && (
                                                            <MutualFriendsPreview
                                                                count={friend.mutualFriends || 0}
                                                                preview={friend.mutualFriendPreview || []}
                                                                compact
                                                            />
                                                        )}
                                                    </Box>
                                                    {isOwnProfile && (
                                                        <IconButton
                                                            onClick={(e) => handleOpenFriendMenu(e, friend)}
                                                            sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2f5', '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb' } }}
                                                        >
                                                            <MoreIcon sx={{ color: textSecondary }} />
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
                        <Card sx={{ bgcolor: paperBg, borderRadius: 2, boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.1)' }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="h5" fontWeight={700} color={textPrimary}>
                                        {t('profile.photos_section')}
                                    </Typography>
                                    {isOwnProfile && (
                                        <Button
                                            sx={{ textTransform: 'none', color: 'primary.main' }}
                                            onClick={() => setCreatePostModalOpen(true)}
                                        >
                                            {t('profile.add_photo_video')}
                                        </Button>
                                    )}
                                </Box>

                                <Tabs value={0} sx={{ mb: 2, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 } }}>
                                    <Tab label={t('profile.your_photos_tab')} />
                                    <Tab label={t('profile.albums_tab')} />
                                </Tabs>

                                {(() => {
                                    const allPhotos = posts
                                        .filter(p => p.media && p.media.length > 0)
                                        .flatMap(p => p.media)
                                        .filter(m => m.mediaType === 'IMAGE');

                                    if (allPhotos.length === 0) {
                                        return (
                                            <Typography color={textSecondary} textAlign="center" py={4}>
                                                {t('profile.no_photos')}
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
                            // Update local posts state via invalidation
                            queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.USER_POSTS] });
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
                            mt: 1,
                            bgcolor: paperBg
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
                            bgcolor: paperBg,
                        }
                    }}
                >
                    <MenuItem
                        onClick={() => {
                            if (selectedFriend) handleUnfriend(selectedFriend._id);
                        }}
                        sx={{ py: 1.5, '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2f5' } }}
                    >
                        <ListItemIcon>
                            <PersonRemoveIcon sx={{ color: textPrimary }} />
                        </ListItemIcon>
                        <ListItemText
                            primary={t('profile.unfriend')}
                            primaryTypographyProps={{ color: textPrimary, fontWeight: 500 }}
                        />
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            handleCloseFriendMenu();
                            setBlockFriendDialogOpen(true);
                        }}
                        sx={{ py: 1.5, '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2f5' } }}
                    >
                        <ListItemIcon>
                            <BlockIcon sx={{ color: textPrimary }} />
                        </ListItemIcon>
                        <ListItemText
                            primary={t('profile.block_user_label')}
                            primaryTypographyProps={{ color: textPrimary, fontWeight: 500 }}
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
                            bgcolor: paperBg,
                        }
                    }}
                >
                    <MenuItem
                        onClick={handleCloseProfileSettings}
                        sx={{ py: 1.5, '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2f5' } }}
                    >
                        <ListItemIcon>
                            <SearchIcon sx={{ color: textPrimary }} />
                        </ListItemIcon>
                        <ListItemText
                            primary={t('profile.find_support')}
                            primaryTypographyProps={{ color: textPrimary, fontWeight: 500 }}
                        />
                    </MenuItem>
                    {isOwnProfile && (
                        <>
                            <MenuItem
                                onClick={handleCloseProfileSettings}
                                sx={{ py: 1.5, '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2f5' } }}
                            >
                                <ListItemIcon>
                                    <PauseCircleIcon sx={{ color: textPrimary }} />
                                </ListItemIcon>
                                <ListItemText
                                    primary={t('profile.deactivate_profile')}
                                    secondary={t('profile.deactivate_description')}
                                    primaryTypographyProps={{ color: textPrimary, fontWeight: 500 }}
                                    secondaryTypographyProps={{ color: textSecondary, fontSize: 12 }}
                                />
                            </MenuItem>
                            <MenuItem
                                onClick={handleGoToSettings}
                                sx={{ py: 1.5, '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2f5' } }}
                            >
                                <ListItemIcon>
                                    <SettingsIcon sx={{ color: textPrimary }} />
                                </ListItemIcon>
                                <ListItemText
                                    primary={t('profile.profile_settings')}
                                    primaryTypographyProps={{ color: textPrimary, fontWeight: 500 }}
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
                            sx={{ py: 1.5, '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2f5' } }}
                        >
                            <ListItemIcon>
                                <BlockIcon sx={{ color: textPrimary }} />
                            </ListItemIcon>
                            <ListItemText
                                primary={t('profile.block_label')}
                                primaryTypographyProps={{ color: textPrimary, fontWeight: 500 }}
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
                            bgcolor: paperBg,
                        }
                    }}
                >
                    <MenuItem
                        onClick={handleViewAvatar}
                        sx={{ py: 1.5, '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2f5' } }}
                    >
                        <ListItemIcon>
                            <VisibilityIcon sx={{ color: textPrimary }} />
                        </ListItemIcon>
                        <ListItemText
                            primary={t('profile.view_avatar')}
                            primaryTypographyProps={{ color: textPrimary, fontWeight: 500 }}
                        />
                    </MenuItem>
                    <MenuItem
                        onClick={handleUploadAvatar}
                        sx={{ py: 1.5, '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2f5' } }}
                    >
                        <ListItemIcon>
                            <CloudUploadIcon sx={{ color: textPrimary }} />
                        </ListItemIcon>
                        <ListItemText
                            primary={t('profile.upload_avatar')}
                            primaryTypographyProps={{ color: textPrimary, fontWeight: 500 }}
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
                            bgcolor: paperBg,
                        }
                    }}
                >
                    <MenuItem
                        onClick={handleViewCover}
                        sx={{ py: 1.5, '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2f5' } }}
                    >
                        <ListItemIcon>
                            <VisibilityIcon sx={{ color: textPrimary }} />
                        </ListItemIcon>
                        <ListItemText
                            primary={t('profile.view_cover')}
                            primaryTypographyProps={{ color: textPrimary, fontWeight: 500 }}
                        />
                    </MenuItem>
                    <MenuItem
                        onClick={handleUploadCoverFromMenu}
                        sx={{ py: 1.5, '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2f5' } }}
                    >
                        <ListItemIcon>
                            <CloudUploadIcon sx={{ color: textPrimary }} />
                        </ListItemIcon>
                        <ListItemText
                            primary={t('profile.upload_cover')}
                            primaryTypographyProps={{ color: textPrimary, fontWeight: 500 }}
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
                            bgcolor: paperBg,
                        }
                    }}
                >
                    <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${theme.palette.divider}` }}>
                        <Typography variant="h6" fontWeight={700} color={textPrimary}>
                            {t('profile.update_cover')}
                        </Typography>
                        <IconButton onClick={handleCloseCoverEditModal}>
                            <CloseIcon sx={{ color: textSecondary }} />
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
                                        {t('profile.no_cover_photo')}
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
                                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb',
                                        color: textPrimary,
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        '&:hover': { borderColor: 'primary.main', bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2f5' }
                                    }}
                                >
                                    {t('profile.select_from_computer')}
                                </Button>
                            </label>
                            {selectedCoverFile && (
                                <Typography color={textSecondary} fontSize={14} sx={{ mt: 1, textAlign: 'center' }}>
                                    {t('profile.file_selected', { name: selectedCoverFile.name })}
                                </Typography>
                            )}
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                        <Button
                            onClick={handleCloseCoverEditModal}
                            sx={{ textTransform: 'none', color: textSecondary }}
                        >
                            {t('profile.cancel')}
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleSaveCoverPhoto}
                            disabled={!selectedCoverFile || uploadingCover}
                            sx={{
                                bgcolor: 'primary.main',
                                textTransform: 'none',
                                fontWeight: 600,
                                '&:hover': { bgcolor: 'primary.dark' },
                                '&:disabled': { bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb' }
                            }}
                        >
                            {uploadingCover ? <CircularProgress size={20} sx={{ color: 'white' }} /> : t('profile.save_changes')}
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
                            maxWidth: '90vw',
                            bgcolor: paperBg
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
                            {t('profile.block_confirm_title', { name: `${profile?.firstName} ${profile?.lastName}` })}
                        </Typography>
                    </DialogTitle>
                    <DialogContent>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            textAlign="center"
                            sx={{ px: 2 }}
                        >
                            {t('profile.block_when_you_block')}
                        </Typography>
                        <Box component="ul" sx={{ pl: 3, mt: 1, mb: 0, color: 'text.secondary' }}>
                            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                                {t('profile.block_cant_message_them')}
                            </Typography>
                            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                                {t('profile.block_cant_message_you')}
                            </Typography>
                            <Typography component="li" variant="body2">
                                {t('profile.block_conversation_hidden')}
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
                                borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb',
                                color: textPrimary,
                                '&:hover': {
                                    borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#bcc0c4',
                                    bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2f5'
                                }
                            }}
                        >
                            {t('profile.cancel')}
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
                            {isBlocking ? <CircularProgress size={20} sx={{ color: 'white' }} /> : t('profile.block_button')}
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
                            maxWidth: '90vw',
                            bgcolor: paperBg
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
                            {t('profile.block_confirm_title', { name: `${selectedFriend?.firstName} ${selectedFriend?.lastName}` })}
                        </Typography>
                    </DialogTitle>
                    <DialogContent>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            textAlign="center"
                            sx={{ px: 2 }}
                        >
                            {t('profile.block_when_you_block')}
                        </Typography>
                        <Box component="ul" sx={{ pl: 3, mt: 1, mb: 0, color: 'text.secondary' }}>
                            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                                {t('profile.block_cant_message_them')}
                            </Typography>
                            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                                {t('profile.block_cant_message_you')}
                            </Typography>
                            <Typography component="li" variant="body2">
                                {t('profile.block_conversation_hidden')}
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
                                borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb',
                                color: textPrimary,
                                '&:hover': {
                                    borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#bcc0c4',
                                    bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f0f2f5'
                                }
                            }}
                        >
                            {t('profile.cancel')}
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
                            {isBlocking ? <CircularProgress size={20} sx={{ color: 'white' }} /> : t('profile.block_button')}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Livestream Viewer Modal */}
                {viewingLivePost && (
                    <LiveStreamViewerModal
                        open={Boolean(viewingLivePost)}
                        onClose={() => setViewingLivePost(null)}
                        post={viewingLivePost}
                    />
                )}
            </Box>
        </Box>
    );
}
