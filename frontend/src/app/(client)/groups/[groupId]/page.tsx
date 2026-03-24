'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Avatar,
    AvatarGroup,
    Button,
    IconButton,
    Tab,
    Tabs,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress,
    Skeleton,
    Modal,
    useTheme,
} from '@mui/material';
import {
    Lock as LockIcon,
    Public as PublicIcon,
    Visibility as VisibilityIcon,
    MoreHoriz as MoreHorizIcon,
    Add as AddIcon,
    Share as ShareIcon,
    ExitToApp as ExitToAppIcon,
    VisibilityOff as VisibilityOffIcon,
    Info as InfoIcon,
    Search as SearchIcon,
    CameraAlt as CameraAltIcon,
    Groups as GroupsIcon,
    Poll as PollIcon,
    EmojiEmotions as MoodIcon,
    KeyboardArrowDown as ArrowDownIcon,
    PlayCircle as PlayIcon,
} from '@mui/icons-material';
import Header from '@/components/home/Header';
import { groupService } from '@/services/group.service';
import { Group, GroupCreator, GroupRole } from '@/types/group';
import { useAuthStore } from '@/stores/useAuthStore';
import CreatePostModal from '@/components/posts/CreatePostModal';
import { useGetGroupPosts, useDeletePost } from '@/queries/usePostQueries';
import { useGroupPostStore } from '@/stores/useGroupPostStore';
import { PostType, MediaItem, PostPrivacy as PPrivacy } from '@/types/post';
import PostItem from '@/components/posts/PostItem';
import EditPostModal from '@/components/posts/EditPostModal';
import ImageViewer from '@/components/posts/ImageViewer';
import CommentContentModal from '@/components/posts/CommentContentModal';
import ShareContentModal from '@/components/posts/ShareContentModal';
import PostOptionContentMenu from '@/components/posts/PostOptionContentMenu';
import { deleteCloudinaryMedia } from '@/services/cloudinary.service';
import { getPrivacyIcon } from '@/utils/formatPost';
import { toast } from 'sonner';
import InviteFriendsDialog from '@/components/groups/InviteFriendsDialog';
import GroupMembersDialog from '@/components/groups/GroupMembersDialog';
import GroupSettingsDialog from '@/components/groups/GroupSettingsDialog';
import TransferOwnershipDialog from '@/components/groups/TransferOwnershipDialog';
import PhotoMenuButton from '@/components/groups/PhotoMenuButton';
import { postService } from '@/services/post.service';
import { io, Socket } from 'socket.io-client';
import { useTranslation } from 'react-i18next';

export default function GroupDetailPage() {
    const params = useParams();
    const router = useRouter();
    const theme = useTheme();
    const groupId = params.groupId as string;
    const { user, accessToken } = useAuthStore();
    const { t } = useTranslation();

    // Group post store
    const { groupPosts, setGroupPosts, addGroupPost } = useGroupPostStore();

    const [group, setGroup] = useState<Group | null>(null);
    const [topMembers, setTopMembers] = useState<GroupCreator[]>([]);
    const [tabValue, setTabValue] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [openLeaveDialog, setOpenLeaveDialog] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [openCreatePost, setOpenCreatePost] = useState(false);
    const [openSettingsDialog, setOpenSettingsDialog] = useState(false);
    const [openTransferDialog, setOpenTransferDialog] = useState(false);
    const [openCoverViewer, setOpenCoverViewer] = useState(false);
    const [openAvatarViewer, setOpenAvatarViewer] = useState(false);
    const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(null);

    // Post-related states
    const [openEditPost, setOpenEditPost] = useState(false);
    const [editingPost, setEditingPost] = useState<PostType | null>(null);
    const [openImageViewer, setOpenImageViewer] = useState(false);
    const [viewerMedia, setViewerMedia] = useState<MediaItem[]>([]);
    const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [menuPost, setMenuPost] = useState<PostType | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [openCommentModal, setOpenCommentModal] = useState(false);
    const [commentingPost, setCommentingPost] = useState<PostType | null>(null);
    const [openShareModal, setOpenShareModal] = useState(false);
    const [sharingPost, setSharingPost] = useState<PostType | null>(null);
    const [shareCaption, setShareCaption] = useState('');
    const [sharePrivacy, setSharePrivacy] = useState<PPrivacy>('PUBLIC');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Invite and Members dialogs
    const [openInviteDialog, setOpenInviteDialog] = useState(false);
    const [openMembersDialog, setOpenMembersDialog] = useState(false);

    // Fetch group posts
    const { data: postsData, isLoading: isLoadingPosts } = useGetGroupPosts(groupId, { page: 1, limit: 20 });
    const deletePostMutation = useDeletePost();

    // Sync API data with store
    useEffect(() => {
        if (postsData?.data && groupId) {
            setGroupPosts(groupId, postsData.data);
        }
    }, [postsData, groupId, setGroupPosts]);

    // Get posts from store
    const posts = useMemo(() => {
        const storePosts = groupPosts[groupId] || [];
        const apiPosts = postsData?.data || [];
        const apiPostIds = new Set(apiPosts.map(p => p._id));
        const newStorePosts = storePosts.filter(p => !apiPostIds.has(p._id));
        return [
            ...newStorePosts,
            ...apiPosts.map(apiPost => {
                const storePost = storePosts.find(sp => sp._id === apiPost._id);
                return storePost || apiPost;
            })
        ];
    }, [postsData, groupPosts, groupId]);

    const loadGroupData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [groupData, membersData] = await Promise.all([
                groupService.getGroupById(groupId),
                groupService.getTopMembers(groupId, 12),
            ]);
            setGroup(groupData);
            setTopMembers(membersData);
        } catch (error) {
            console.error('Failed to load group:', error);
            router.push('/groups');
        } finally {
            setIsLoading(false);
        }
    }, [groupId, router]);

    useEffect(() => {
        if (groupId) {
            loadGroupData();
        }
    }, [groupId, loadGroupData]);

    // Socket connection for real-time updates
    useEffect(() => {
        if (!groupId || !accessToken) return;

        const socket: Socket = io(`${process.env.NEXT_PUBLIC_API_URL}/groups`, {
            auth: { token: accessToken },
            transports: ['websocket'],
        });

        socket.on('connect', () => {
            socket.emit('joinGroupRoom', groupId);
        });

        // Listen for member count updates
        socket.on('memberCountUpdate', (data: { groupId: string; memberCount: number }) => {
            if (data.groupId === groupId) {
                setGroup(prev => prev ? { ...prev, memberCount: data.memberCount } : null);
            }
        });

        // Listen for role updates
        socket.on('memberRoleUpdate', (data: { groupId: string; userId: string; newRole: string; updatedBy: string }) => {
            if (data.groupId === groupId && data.userId === user?.id) {
                setGroup(prev => prev ? { ...prev, myRole: data.newRole as GroupRole } : null);
                // toast.info(`Vai trò của bạn trong nhóm đã được thay đổi thành ${data.newRole === 'ADMIN' ? 'Quản trị viên' : data.newRole === 'MODERATOR' ? 'Người kiểm duyệt' : 'Thành viên'}`);
                // TODO: Translate role names
                toast.info(t('groups.role_updated', { role: data.newRole }));
            }
        });

        // Listen for ownership transfer
        socket.on('ownershipTransfer', (data: { groupId: string; oldOwnerId: string; newOwnerId: string }) => {
            if (data.groupId === groupId) {
                // Reload group data to get updated creator info
                loadGroupData();
                if (data.oldOwnerId === user?.id) {
                    toast.info(t('groups.ownership_transferred_from_you'));
                } else if (data.newOwnerId === user?.id) {
                    toast.success(t('groups.ownership_transferred_to_you'));
                }
            }
        });

        // Listen for group settings updates
        socket.on('groupSettingsUpdate', (data: { groupId: string; settings: any }) => {
            if (data.groupId === groupId) {
                setGroup(prev => prev ? { ...prev, ...data.settings } : null);
            }
        });

        // Listen for new member
        socket.on('newMember', (data: { groupId: string; member: any }) => {
            if (data.groupId === groupId) {
                setTopMembers(prev => {
                    // Add new member to top if not already there
                    if (!prev.find(m => m._id === data.member._id)) {
                        return [...prev, data.member].slice(0, 12);
                    }
                    return prev;
                });
            }
        });

        // Listen for member left
        socket.on('memberLeft', (data: { groupId: string; userId: string }) => {
            if (data.groupId === groupId) {
                setTopMembers(prev => prev.filter(m => m._id !== data.userId));
            }
        });

        return () => {
            socket.emit('leaveGroupRoom', groupId);
            socket.disconnect();
        };
    }, [groupId, accessToken, user?.id, loadGroupData]);

    // Handle new post created - instant update
    const handlePostCreated = useCallback((newPost: PostType) => {
        addGroupPost(groupId, newPost);
    }, [groupId, addGroupPost]);

    const handleJoinGroup = async () => {
        setIsJoining(true);
        try {
            await groupService.joinGroup(groupId);
            loadGroupData();
        } catch (error) {
            console.error('Failed to join group:', error);
        } finally {
            setIsJoining(false);
        }
    };

    const handleLeaveGroup = async () => {
        setIsLeaving(true);
        try {
            await groupService.leaveGroup(groupId);
            setOpenLeaveDialog(false);
            router.push('/groups');
        } catch (error) {
            console.error('Failed to leave group:', error);
        } finally {
            setIsLeaving(false);
        }
    };

    const handleCancelRequest = async () => {
        try {
            await groupService.cancelJoinRequest(groupId);
            loadGroupData();
        } catch (error) {
            console.error('Failed to cancel request:', error);
        }
    };

    // Post handlers
    const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, post: PostType) => {
        setMenuAnchor(event.currentTarget);
        setMenuPost(post);
    };

    const handleCloseMenu = () => {
        setMenuAnchor(null);
        setMenuPost(null);
    };

    const handleDeletePost = async () => {
        if (!menuPost) return;
        setIsDeleting(true);
        try {
            if (menuPost.media && menuPost.media.length > 0) {
                const mediaItems = menuPost.media
                    .filter(m => m.publicId)
                    .map(m => ({ publicId: m.publicId, mediaType: m.mediaType }));
                if (mediaItems.length > 0) {
                    await deleteCloudinaryMedia(mediaItems);
                }
            }
            await deletePostMutation.mutateAsync(menuPost._id);
            useGroupPostStore.getState().deleteGroupPost(groupId, menuPost._id);
            handleCloseMenu();
        } catch (error) {
            console.error('Error deleting post:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleEditPost = () => {
        if (menuPost) {
            setEditingPost(menuPost);
            setOpenEditPost(true);
            handleCloseMenu();
        }
    };

    const handleOpenImageViewer = (media: MediaItem[], index: number) => {
        setViewerMedia(media);
        setViewerInitialIndex(index);
        setOpenImageViewer(true);
    };

    const handleOpenComments = (post: PostType) => {
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

    // Render post media
    const renderPostMedia = (post: PostType) => {
        if (!post.media || post.media.length === 0) return null;
        const mediaCount = post.media.length;

        // Handler to open video in Reels
        const handleVideoClick = () => {
            router.push(`/reels/${post._id}`);
        };

        if (mediaCount === 1) {
            const media = post.media[0];
            return (
                <Box sx={{ mb: 2, position: 'relative' }}>
                    {media.mediaType === 'VIDEO' ? (
                        <Box sx={{ position: 'relative', cursor: 'pointer' }} onClick={handleVideoClick}>
                            <video src={media.url} style={{ width: '100%', maxHeight: 500, objectFit: 'cover', borderRadius: 4 }} />
                            <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', bgcolor: 'rgba(0,0,0,0.6)', borderRadius: '50%', p: 1.5 }}>
                                <PlayIcon sx={{ color: 'white', fontSize: 48 }} />
                            </Box>
                        </Box>
                    ) : (
                        <Box component="img" src={media.url} alt="Post media" onClick={() => handleOpenImageViewer(post.media, 0)} sx={{ width: '100%', maxHeight: 500, objectFit: 'cover', borderRadius: 1, cursor: 'pointer' }} />
                    )}
                </Box>
            );
        }
        return (
            <Box sx={{ mb: 2, display: 'grid', gridTemplateColumns: mediaCount === 2 ? '1fr 1fr' : 'repeat(2, 1fr)', gap: 0.5, borderRadius: 1, overflow: 'hidden' }}>
                {post.media.slice(0, 4).map((media, index) => (
                    <Box
                        key={index}
                        onClick={() => media.mediaType === 'VIDEO' ? handleVideoClick() : handleOpenImageViewer(post.media, index)}
                        sx={{ position: 'relative', height: mediaCount === 2 ? 300 : 200, gridColumn: mediaCount === 3 && index === 0 ? 'span 2' : 'span 1', cursor: 'pointer' }}
                    >
                        {media.mediaType === 'VIDEO' ? (
                            <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
                                <video src={media.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', bgcolor: 'rgba(0,0,0,0.6)', borderRadius: '50%', p: 1 }}>
                                    <PlayIcon sx={{ color: 'white', fontSize: 32 }} />
                                </Box>
                            </Box>
                        ) : (
                            <Box component="img" src={media.url} alt={'Media ' + (index + 1)} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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

    const isAdmin = group?.myRole === "ADMIN";
    const isModerator = group?.myRole === "MODERATOR";
    const canEdit = isAdmin || isModerator;

    if (isLoading) {
        return (<Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}><Header /><Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><CircularProgress /></Box></Box>);
    }

    if (!group) {
        return (<Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}><Header /><Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><Typography>{t('groups.group_not_found')}</Typography></Box></Box>);
    }

    return (
        <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', pb: { xs: '64px', md: 0 } }}>
            <Header />
            <Box sx={{ maxWidth: 1250, mx: 'auto', pt: 8, px: { xs: 0, md: 2 } }}>
                {/* Cover Image */}
                <Box sx={{ height: { xs: 200, sm: 300, md: 350 }, background: group.coverImage ? 'url(' + group.coverImage + ') center/cover' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: { xs: 0, md: '0 0 12px 12px' }, position: 'relative' }}>
                    {canEdit && (
                        <Box sx={{ position: 'absolute', bottom: 16, right: 16 }}>
                            <PhotoMenuButton
                                type="cover"
                                currentImage={group.coverImage}
                                onImageUpdated={async (url) => {
                                    await groupService.updateGroup(groupId, { coverImage: url });
                                    setGroup(prev => prev ? { ...prev, coverImage: url } : null);
                                }}
                                onViewImage={() => setOpenCoverViewer(true)}
                            >
                                <Button
                                    variant="contained"
                                    startIcon={<CameraAltIcon />}
                                    sx={{
                                        bgcolor: 'background.paper',
                                        color: 'text.primary',
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        '&:hover': { bgcolor: 'action.hover' }
                                    }}
                                >
                                    {t('groups.edit_cover')}
                                </Button>
                            </PhotoMenuButton>
                        </Box>
                    )}
                </Box>

                {/* Group Info Header */}
                <Box sx={{ bgcolor: 'background.paper', borderRadius: { xs: 0, md: '0 0 12px 12px' }, boxShadow: '0 1px 2px rgba(0,0,0,0.1)', px: { xs: 2, md: 4 }, pb: 0 }}>
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'center', md: 'flex-start' }, gap: 2, pt: 3, pb: 2 }}>
                        <Box sx={{ position: 'relative', mt: { xs: 0, md: -10 } }}>
                            <Avatar src={group.avatar || undefined} sx={{ width: { xs: 100, md: 168 }, height: { xs: 100, md: 168 }, border: `4px solid ${theme.palette.background.paper}`, bgcolor: 'action.hover', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}><GroupsIcon sx={{ fontSize: { xs: 50, md: 80 }, color: 'text.secondary' }} /></Avatar>
                            {canEdit && (
                                <Box sx={{ position: 'absolute', bottom: 8, right: 8 }}>
                                    <PhotoMenuButton
                                        type="avatar"
                                        currentImage={group.avatar}
                                        onImageUpdated={async (url) => {
                                            await groupService.updateGroup(groupId, { avatar: url });
                                            setGroup(prev => prev ? { ...prev, avatar: url } : null);
                                        }}
                                        onViewImage={() => setOpenAvatarViewer(true)}
                                    >
                                        <IconButton sx={{ bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' }, width: 36, height: 36 }}>
                                            <CameraAltIcon fontSize="small" />
                                        </IconButton>
                                    </PhotoMenuButton>
                                </Box>
                            )}
                            <Box sx={{ position: 'absolute', top: { xs: -10, md: 8 }, left: { xs: '50%', md: -16 }, transform: { xs: 'translateX(-50%)', md: 'none' }, bgcolor: 'primary.main', color: 'primary.contrastText', px: 1.5, py: 0.5, borderRadius: 1, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', zIndex: 1 }}>{group.privacy === "PRIVATE" ? t('groups.private_group') : t('groups.public_group')}</Box>
                        </Box>
                        <Box sx={{ flex: 1, textAlign: { xs: 'center', md: 'left' }, minWidth: 0 }}>
                            <Typography variant="h4" fontWeight={700} sx={{ fontSize: { xs: 24, md: 28 }, color: 'text.primary' }}>{group.name}</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, justifyContent: { xs: 'center', md: 'flex-start' }, flexWrap: 'wrap' }}>
                                {group.privacy === "PRIVATE" ? <LockIcon sx={{ fontSize: 14, color: 'text.secondary' }} /> : <PublicIcon sx={{ fontSize: 14, color: 'text.secondary' }} />}
                                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 15 }}>{group.privacy === "PRIVATE" ? t('groups.private_group') : t('groups.public_group')}</Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 15 }}>· {group.memberCount.toLocaleString()} {t('groups.members')}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: { xs: 'center', md: 'flex-start' }, mt: 1.5 }}>
                                <AvatarGroup max={12} sx={{ '& .MuiAvatar-root': { width: 32, height: 32, border: `2px solid ${theme.palette.background.paper}`, fontSize: 14 } }}>{topMembers.map((member) => (<Avatar key={member._id} src={member.avatar} alt={member.firstName}>{member.firstName?.[0]}</Avatar>))}</AvatarGroup>
                            </Box>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', justifyContent: { xs: 'center', md: 'flex-end' }, alignSelf: { xs: 'center', md: 'center' } }}>
                            {group.isMember ? (
                                <>
                                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenInviteDialog(true)} sx={{ bgcolor: 'primary.main', textTransform: 'none', fontWeight: 600, borderRadius: 1, '&:hover': { bgcolor: 'primary.dark' } }}>{t('groups.invite')}</Button>
                                    <Button variant="contained" startIcon={<ShareIcon />} sx={{ bgcolor: 'action.hover', color: 'text.primary', textTransform: 'none', fontWeight: 600, borderRadius: 1, '&:hover': { bgcolor: 'action.selected' } }}>{t('groups.share')}</Button>
                                    <Button variant="contained" endIcon={<ArrowDownIcon />} onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ bgcolor: 'action.hover', color: 'text.primary', textTransform: 'none', fontWeight: 600, borderRadius: 1, '&:hover': { bgcolor: 'action.selected' } }}>{t('groups.joined')}</Button>
                                    {isAdmin && (
                                        <IconButton onClick={(e) => setMoreMenuAnchor(e.currentTarget)} sx={{ bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } }}>
                                            <MoreHorizIcon />
                                        </IconButton>
                                    )}
                                </>
                            ) : group.isPending ? (
                                <Button variant="contained" onClick={handleCancelRequest} sx={{ bgcolor: 'action.hover', color: 'text.primary', textTransform: 'none', fontWeight: 600, borderRadius: 1, '&:hover': { bgcolor: 'action.selected' } }}>{t('groups.cancel_request')}</Button>
                            ) : (
                                <Button variant="contained" onClick={handleJoinGroup} disabled={isJoining} sx={{ bgcolor: 'primary.main', textTransform: 'none', fontWeight: 600, px: 3, borderRadius: 1, '&:hover': { bgcolor: 'primary.dark' } }}>{isJoining ? <CircularProgress size={20} color="inherit" /> : `+ ${t('groups.join_group')}`}</Button>
                            )}

                            {/* "Đã tham gia" dropdown menu - only Leave option */}
                            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)} PaperProps={{ sx: { borderRadius: 2, minWidth: 200 } }}>
                                <MenuItem onClick={() => { setAnchorEl(null); setOpenLeaveDialog(true); }}>
                                    <ListItemIcon><ExitToAppIcon /></ListItemIcon>
                                    <ListItemText primary={t('groups.leave_group')} />
                                </MenuItem>
                            </Menu>

                            {/* Three-dot menu - Settings and Transfer ownership (admin only) */}
                            <Menu anchorEl={moreMenuAnchor} open={Boolean(moreMenuAnchor)} onClose={() => setMoreMenuAnchor(null)} PaperProps={{ sx: { borderRadius: 2, minWidth: 200 } }}>
                                {isAdmin && (
                                    <MenuItem onClick={() => { setMoreMenuAnchor(null); setOpenSettingsDialog(true); }}>
                                        <ListItemIcon><InfoIcon /></ListItemIcon>
                                        <ListItemText primary={t('groups.group_settings')} />
                                    </MenuItem>
                                )}
                                {group.createdBy?._id === user?.id && (
                                    <MenuItem onClick={() => { setMoreMenuAnchor(null); setOpenTransferDialog(true); }}>
                                        <ListItemIcon><ShareIcon /></ListItemIcon>
                                        <ListItemText primary={t('groups.transfer_ownership')} />
                                    </MenuItem>
                                )}
                            </Menu>
                        </Box>
                    </Box>
                    <Divider />
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Tabs variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile value={tabValue} onChange={(_, newValue) => { if (newValue === 2) { setOpenMembersDialog(true); } else { setTabValue(newValue); } }} sx={{ '& .MuiTab-root': { textTransform: 'none', fontSize: { xs: 13, md: 15 }, fontWeight: 600, color: 'text.secondary', minHeight: 52, px: { xs: 1.5, md: 2 }, '&.Mui-selected': { color: 'primary.main' } }, '& .MuiTabs-indicator': { bgcolor: 'primary.main', height: 3, borderRadius: '3px 3px 0 0' } }}><Tab label={t('groups.discussion')} /><Tab label={t('groups.featured')} /><Tab label={t('groups.people')} /><Tab label={t('groups.events')} /><Tab label={t('groups.media')} /><Tab label={t('groups.files')} /></Tabs>
                        <Box sx={{ display: 'flex', gap: 1, pr: 1 }}><IconButton sx={{ bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } }}><SearchIcon /></IconButton><IconButton sx={{ bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } }}><MoreHorizIcon /></IconButton></Box>
                    </Box>
                </Box>

                {/* Content Area */}
                <Box sx={{ display: 'flex', gap: 2, mt: 2, flexDirection: { xs: 'column', md: 'row' }, pb: 4 }}>
                    {/* Main Content */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        {/* Create Post Card */}
                        {group.isMember && (
                            <Card sx={{ mb: 2, borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                                        <Avatar sx={{ width: 40, height: 40 }} src={user?.avatar}>{user?.fullName?.[0]}</Avatar>
                                        <Box onClick={() => setOpenCreatePost(true)} sx={{ flex: 1, bgcolor: 'action.hover', borderRadius: '20px', display: 'flex', alignItems: 'center', px: 2, py: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.selected' } }}>
                                            <Typography sx={{ color: 'text.secondary', fontSize: 17 }}>{t('post.whats_on_your_mind')}</Typography>
                                        </Box>
                                    </Box>
                                    <Divider sx={{ mb: 1.5 }} />
                                    <Box sx={{ display: 'flex', justifyContent: 'space-around' }}>
                                        <Box onClick={() => setOpenCreatePost(true)} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 2, cursor: 'pointer', borderRadius: 2, '&:hover': { bgcolor: 'action.hover' } }}>
                                            <VisibilityOffIcon sx={{ color: '#45bd62' }} />
                                            <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.secondary' }}>{t('post.anonymous_post')}</Typography>
                                        </Box>
                                        <Box onClick={() => setOpenCreatePost(true)} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 2, cursor: 'pointer', borderRadius: 2, '&:hover': { bgcolor: 'action.hover' } }}>
                                            <PollIcon sx={{ color: '#f7b928' }} />
                                            <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.secondary' }}>{t('post.poll')}</Typography>
                                        </Box>
                                        <Box onClick={() => setOpenCreatePost(true)} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, px: 2, cursor: 'pointer', borderRadius: 2, '&:hover': { bgcolor: 'action.hover' } }}>
                                            <MoodIcon sx={{ color: '#f7b928' }} />
                                            <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.secondary' }}>{t('post.feeling_activity')}</Typography>
                                        </Box>
                                    </Box>
                                </CardContent>
                            </Card>
                        )}

                        {/* Loading Posts */}
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

                        {/* Empty Posts */}
                        {!isLoadingPosts && posts.length === 0 && (
                            <Card sx={{ borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                                <CardContent sx={{ py: 6 }}>
                                    <Typography variant="body1" sx={{ color: 'text.secondary', textAlign: 'center' }}>{t('groups.no_posts_yet')}</Typography>
                                </CardContent>
                            </Card>
                        )}

                        {/* Posts List */}
                        {posts.map((post) => {
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
                                    isHighlighted={false}
                                    isGroupPost={true}
                                    groupName={group.name}
                                    groupAvatar={group.avatar || undefined}
                                    groupId={group._id}
                                />
                            );
                        })}
                    </Box>

                    {/* Sidebar */}
                    <Box sx={{ width: { xs: '100%', md: 360 }, flexShrink: 0 }}>
                        <Card sx={{ mb: 2, borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                            <CardContent sx={{ p: 2 }}>
                                <Typography variant="h6" fontWeight={700} sx={{ mb: 2, color: 'text.primary' }}>{t('groups.about')}</Typography>
                                {group.description && <Typography variant="body2" sx={{ color: 'text.primary', mb: 2 }}>{group.description}</Typography>}
                                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                                    <PublicIcon sx={{ color: 'text.secondary', mt: 0.5 }} />
                                    <Box>
                                        <Typography variant="body1" fontWeight={600} sx={{ color: 'text.primary' }}>{group.privacy === "PRIVATE" ? t('groups.private_group') : t('groups.public_group')}</Typography>
                                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>{group.privacy === "PRIVATE" ? t('groups.private_group_desc') : t('groups.public_group_desc')}</Typography>
                                    </Box>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                                    <VisibilityIcon sx={{ color: 'text.secondary', mt: 0.5 }} />
                                    <Box>
                                        <Typography variant="body1" fontWeight={600} sx={{ color: 'text.primary' }}>{t('groups.visibility')}</Typography>
                                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('groups.visible_desc')}</Typography>
                                    </Box>
                                </Box>
                                <Button fullWidth variant="contained" sx={{ bgcolor: 'action.hover', color: 'text.primary', textTransform: 'none', fontWeight: 600, mt: 1, borderRadius: 1, '&:hover': { bgcolor: 'action.selected' } }}>{t('groups.learn_more')}</Button>
                            </CardContent>
                        </Card>
                        <Card sx={{ borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                            <CardContent sx={{ p: 2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="h6" fontWeight={700} sx={{ color: 'text.primary' }}>{t('groups.recent_media')}</Typography>
                                    <IconButton size="small" sx={{ bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } }}><SearchIcon fontSize="small" /></IconButton>
                                </Box>
                                <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}>{t('groups.no_media')}</Typography>
                            </CardContent>
                        </Card>
                    </Box>
                </Box>
            </Box>

            {/* Dialogs & Modals */}
            <Dialog open={openLeaveDialog} onClose={() => setOpenLeaveDialog(false)} PaperProps={{ sx: { borderRadius: 2 } }}>
                <DialogTitle sx={{ fontWeight: 700 }}>{t('groups.leave_group_confirm_title')}</DialogTitle>
                <DialogContent><Typography>{t('groups.leave_group_confirm', { name: group.name })}</Typography></DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setOpenLeaveDialog(false)} sx={{ textTransform: 'none' }}>{t('common.cancel')}</Button>
                    <Button onClick={handleLeaveGroup} disabled={isLeaving} variant="contained" color="error" sx={{ textTransform: 'none' }}>{isLeaving ? <CircularProgress size={20} color="inherit" /> : t('groups.leave_group')}</Button>
                </DialogActions>
            </Dialog>

            <CreatePostModal
                open={openCreatePost}
                onClose={() => setOpenCreatePost(false)}
                groupId={groupId}
                groupName={group.name}
                onPostCreated={handlePostCreated}
            />

            {editingPost && (
                <EditPostModal
                    open={openEditPost}
                    onClose={() => { setOpenEditPost(false); setEditingPost(null); }}
                    post={editingPost}
                    onPostUpdated={(updatedPost) => {
                        useGroupPostStore.getState().updateGroupPost(groupId, updatedPost._id, updatedPost);
                    }}
                />
            )}

            <ImageViewer
                open={openImageViewer}
                onClose={() => setOpenImageViewer(false)}
                media={viewerMedia}
                initialIndex={viewerInitialIndex}
            />

            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleCloseMenu} PaperProps={{ sx: { width: 320, borderRadius: 2, boxShadow: '0 2px 12px rgba(0,0,0,0.15)', mt: 1 } }}>
                <PostOptionContentMenu
                    handleDeletePost={handleDeletePost}
                    handleEditPost={handleEditPost}
                    isDeleting={isDeleting}
                    menuPost={menuPost}
                    user={user}
                    onToggleComments={async (allow) => {
                        if (!menuPost) return;
                        try {
                            await postService.updatePost(menuPost._id, { allowComments: allow });
                            useGroupPostStore.getState().updateGroupPost(groupId, menuPost._id, { ...menuPost, allowComments: allow });
                            setMenuPost(prev => prev ? { ...prev, allowComments: allow } : null);
                            toast.success(allow ? t('post.comments_enabled') : t('post.comments_disabled'));
                        } catch {
                            toast.error(t('post.settings_update_failed'));
                        }
                    }}
                    onToggleShares={async (allow) => {
                        if (!menuPost) return;
                        try {
                            await postService.updatePost(menuPost._id, { allowShares: allow });
                            useGroupPostStore.getState().updateGroupPost(groupId, menuPost._id, { ...menuPost, allowShares: allow });
                            setMenuPost(prev => prev ? { ...prev, allowShares: allow } : null);
                            toast.success(allow ? t('post.shares_enabled') : t('post.shares_disabled'));
                        } catch {
                            toast.error(t('post.settings_update_failed'));
                        }
                    }}
                    onToggleReactions={async (allow) => {
                        if (!menuPost) return;
                        try {
                            await postService.updatePost(menuPost._id, { allowReactions: allow });
                            useGroupPostStore.getState().updateGroupPost(groupId, menuPost._id, { ...menuPost, allowReactions: allow });
                            setMenuPost(prev => prev ? { ...prev, allowReactions: allow } : null);
                            toast.success(allow ? t('post.reactions_enabled') : t('post.reactions_disabled'));
                        } catch {
                            toast.error(t('post.settings_update_failed'));
                        }
                    }}
                />
            </Menu>

            <Modal open={openCommentModal} onClose={() => setOpenCommentModal(false)}>
                <CommentContentModal
                    setOpenCommentModal={setOpenCommentModal}
                    commentingPost={commentingPost}
                    renderPostMedia={renderPostMedia}
                    handleOpenShare={handleOpenShare}
                />
            </Modal>

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

            {/* Invite Friends Dialog */}
            <InviteFriendsDialog
                open={openInviteDialog}
                onClose={() => setOpenInviteDialog(false)}
                groupId={groupId}
                groupName={group?.name || ''}
            />

            {/* Group Members Dialog */}
            <GroupMembersDialog
                open={openMembersDialog}
                onClose={() => setOpenMembersDialog(false)}
                groupId={groupId}
                groupName={group?.name || ''}
                currentUserRole={group?.myRole}
                isCreator={group?.createdBy?._id === user?.id}
            />

            {/* Group Settings Dialog */}
            {group && (
                <GroupSettingsDialog
                    open={openSettingsDialog}
                    onClose={() => setOpenSettingsDialog(false)}
                    group={group}
                    onGroupUpdated={(updatedData) => {
                        setGroup(prev => prev ? { ...prev, ...updatedData } : null);
                    }}
                />
            )}

            {/* Transfer Ownership Dialog */}
            <TransferOwnershipDialog
                open={openTransferDialog}
                onClose={() => setOpenTransferDialog(false)}
                groupId={groupId}
                groupName={group?.name || ''}
                onTransferred={() => {
                    loadGroupData();
                }}
            />

            {/* Image Viewers for Avatar and Cover */}
            {openCoverViewer && group?.coverImage && (
                <ImageViewer
                    open={openCoverViewer}
                    onClose={() => setOpenCoverViewer(false)}
                    media={[{ url: group.coverImage, mediaType: 'IMAGE', publicId: '' }]}
                    initialIndex={0}
                />
            )}

            {openAvatarViewer && group?.avatar && (
                <ImageViewer
                    open={openAvatarViewer}
                    onClose={() => setOpenAvatarViewer(false)}
                    media={[{ url: group.avatar, mediaType: 'IMAGE', publicId: '' }]}
                    initialIndex={0}
                />
            )}
        </Box>
    );
}