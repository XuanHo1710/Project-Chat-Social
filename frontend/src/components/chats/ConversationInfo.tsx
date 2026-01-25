'use client';

import React, { useState, useCallback, useRef } from 'react';
import {
    Box,
    Avatar,
    Typography,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemAvatar,
    ListItemText,
    ListItemSecondaryAction,
    Divider,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Menu,
    MenuItem,
    CircularProgress,
    Collapse,
    Tabs,
    Tab,
    Checkbox,
    Chip,
    Switch,
    Badge,
    useTheme,
    alpha,
} from '@mui/material';
import {
    Close as CloseIcon,
    Edit as EditIcon,
    PersonAdd as PersonAddIcon,
    MoreVert as MoreVertIcon,
    Security as SecurityIcon,
    ExitToApp as ExitToAppIcon,
    PhotoCamera as PhotoCameraIcon,
    Person as PersonIcon,
    Notifications as NotificationsIcon,
    NotificationsOff as NotificationsOffIcon,
    Search as SearchIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    Photo as PhotoIcon,
    InsertDriveFile as FileIcon,
    Lock as LockIcon,
    ArrowBack as ArrowBackIcon,
    PlayCircle as PlayCircleIcon,
    InsertDriveFile as InsertDriveFileIcon,
    PictureAsPdf as PictureAsPdfIcon,
    Settings as SettingsIcon,
    Warning as WarningIcon,
    Chat as ChatIcon,
    Description as DescriptionIcon,
    GroupAdd as GroupAddIcon,
    Visibility as VisibilityIcon,
    Block as BlockIcon,
    PersonOff as PersonOffIcon,
    IntegrationInstructions as IntegrationInstructionsIcon
} from '@mui/icons-material';
import { useConversationDetail } from '@/queries/useConversationQueries';
import { useSocket } from '@/contexts/SocketContext';
import { useDisplayListFriends } from '@/queries/useRelationshipQueries';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/query-keys';
import { chatService } from '@/services/chat.service';
import { relationshipService } from '@/services/relationship.service';
import { MessageResponse } from '@/types/chat';
import { ConversationParticipant } from '@/types/conversation';
import { FriendType } from '@/types/account';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { useRouter } from 'next/navigation';
import { CLIENT_PATH } from '@/constants/paths';
import { UploadImage } from '@/utils/uploadImage';
import { toast } from 'sonner';
import { useOnlineStatusStore } from '@/stores/useOnlineStatusStore';
import { timeAgo } from '@/utils/formatDate';
import { useTranslation } from 'react-i18next';

// Theme colors for chat background - now with gradients
const THEME_COLORS = [
    { color: '#0084ff', gradient: 'linear-gradient(180deg, #0084ff 0%, #0066cc 100%)' },
    { color: '#44bec7', gradient: 'linear-gradient(180deg, #44bec7 0%, #2da8b0 100%)' },
    { color: '#ffc300', gradient: 'linear-gradient(180deg, #ffc300 0%, #e6a800 100%)' },
    { color: '#fa3c4c', gradient: 'linear-gradient(180deg, #fa3c4c 0%, #d6323f 100%)' },
    { color: '#d696bb', gradient: 'linear-gradient(180deg, #d696bb 0%, #c07aa3 100%)' },
    { color: '#6699cc', gradient: 'linear-gradient(180deg, #6699cc 0%, #4d80b3 100%)' },
    { color: '#13cf13', gradient: 'linear-gradient(180deg, #13cf13 0%, #0fb30f 100%)' },
    { color: '#ff7e29', gradient: 'linear-gradient(180deg, #ff7e29 0%, #e66a1a 100%)' },
    { color: '#e68585', gradient: 'linear-gradient(180deg, #e68585 0%, #d96c6c 100%)' },
    { color: '#7646ff', gradient: 'linear-gradient(180deg, #7646ff 0%, #5c33cc 100%)' }
];

interface ConversationInfoProps {
    conversationId: string;
    userId: string;
    onClose: () => void;
}

export default function ConversationInfo({ conversationId, userId, onClose }: ConversationInfoProps) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { data: conversationData, isLoading } = useConversationDetail(conversationId);
    const { socketChat, socketRelationship } = useSocket();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const { t } = useTranslation();

    // Online status store
    const onlineUsers = useOnlineStatusStore(state => state.onlineUsers);

    // Mute notification state
    const [isMuted, setIsMuted] = useState(false);
    const [isMuting, setIsMuting] = useState(false);

    // Collapsible sections
    const [customizeOpen, setCustomizeOpen] = useState(true);
    const [mediaOpen, setMediaOpen] = useState(false);
    const [membersOpen, setMembersOpen] = useState(true);

    const [editNameDialogOpen, setEditNameDialogOpen] = useState(false);
    const [newName, setNewName] = useState('');

    const [editNicknameDialogOpen, setEditNicknameDialogOpen] = useState(false);
    const [newNickname, setNewNickname] = useState('');

    const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [memberMenuAnchor, setMemberMenuAnchor] = useState<null | HTMLElement>(null);
    const [selectedMember, setSelectedMember] = useState<ConversationParticipant | null>(null);

    const [themeDialogOpen, setThemeDialogOpen] = useState(false);
    const [reactionDialogOpen, setReactionDialogOpen] = useState(false);
    const [nicknameListDialogOpen, setNicknameListDialogOpen] = useState(false);

    // Create Group Dialog State
    const [createGroupDialogOpen, setCreateGroupDialogOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]); // IDs of selected friends
    const [createGroupSearchQuery, setCreateGroupSearchQuery] = useState('');

    // Avatar menu state
    const [avatarMenuAnchor, setAvatarMenuAnchor] = useState<null | HTMLElement>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    // Media Gallery State
    const [mediaGalleryOpen, setMediaGalleryOpen] = useState(false);
    const [mediaTab, setMediaTab] = useState(0);
    const [mediaMessages, setMediaMessages] = useState<MessageResponse[]>([]);
    const [mediaPage, setMediaPage] = useState(1);
    const [mediaHasMore, setMediaHasMore] = useState(true);
    const [mediaLoading, setMediaLoading] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    // File Messages State
    const [fileMessages, setFileMessages] = useState<MessageResponse[]>([]);
    const [filePage, setFilePage] = useState(1);
    const [fileHasMore, setFileHasMore] = useState(true);
    const [fileLoading, setFileLoading] = useState(false);

    // Leave Group Dialog State
    const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);

    // Settings Dialog State
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Block/Restrict Dialog State
    const [blockDialogOpen, setBlockDialogOpen] = useState(false);
    const [isBlocking, setIsBlocking] = useState(false);
    const [privacyOpen, setPrivacyOpen] = useState(false);
    const [isRestricting, setIsRestricting] = useState(false);

    const conversation = conversationData?.data;
    const themeColor = conversation?.theme || '#0084ff';

    // Initialize muted state from conversation data
    React.useEffect(() => {
        if (conversation?.mutedBy) {
            setIsMuted(conversation.mutedBy.includes(userId));
        }
    }, [conversation?.mutedBy, userId]);

    // Handle toggle mute notification
    const handleToggleMute = useCallback(() => {
        if (!socketChat || isMuting) return;

        setIsMuting(true);
        socketChat.emit('conversation:toggle-mute', { conversationId }, (response: { success: boolean; isMuted?: boolean; error?: string }) => {
            setIsMuting(false);
            if (response.success) {
                setIsMuted(response.isMuted ?? false);
                // Update conversation cache
                queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATION_BY_USER, 'detail', conversationId] });
            } else {
                toast.error(response.error || t('chat.notification_change_failed'));
            }
        });
    }, [socketChat, conversationId, isMuting, queryClient]);

    // Listen for mute update events
    React.useEffect(() => {
        if (!socketChat) return;

        const handleMuteUpdated = (data: { conversationId: string; userId: string; isMuted: boolean }) => {
            if (data.conversationId === conversationId && data.userId === userId) {
                setIsMuted(data.isMuted);
            }
        };

        socketChat.on('conversation:mute:updated', handleMuteUpdated);
        return () => {
            socketChat.off('conversation:mute:updated', handleMuteUpdated);
        };
    }, [socketChat, conversationId, userId]);

    // Get friends list for adding members
    const { data: friendsData, isLoading: isFriendsLoading } = useDisplayListFriends(userId);
    const friends = friendsData?.data || [];

    // Filter friends by search query and exclude existing ACTIVE members (for add member dialog)
    // Users who were kicked or left should be available to re-add
    const filteredFriends = friends.filter(friend => {
        const participant = conversation?.participants.find(p => p.user._id === friend._id);
        // Allow if not a participant, or if kicked/left
        const isActiveMember = participant && !participant.kickedAt && !participant.leftAt;
        if (isActiveMember) return false;
        if (!searchQuery.trim()) return true;
        const fullName = `${friend.firstName} ${friend.lastName}`.toLowerCase();
        return fullName.includes(searchQuery.toLowerCase());
    });

    // Filter friends for create group dialog
    const filteredFriendsForGroup = friends.filter(friend => {
        if (!createGroupSearchQuery.trim()) return true;
        const fullName = `${friend.firstName} ${friend.lastName}`.toLowerCase();
        return fullName.includes(createGroupSearchQuery.toLowerCase());
    });

    // Toggle member selection for create group
    const toggleMemberSelection = (friendId: string) => {
        setSelectedMembers(prev =>
            prev.includes(friendId)
                ? prev.filter(id => id !== friendId)
                : [...prev, friendId]
        );
    };

    // Load media messages
    const loadMediaMessages = useCallback(async (page: number, reset: boolean = false) => {
        if (mediaLoading) return;

        setMediaLoading(true);
        try {
            const result = await chatService.getMediaMessages(conversationId, page, 20);
            if (reset) {
                setMediaMessages(result.data);
            } else {
                setMediaMessages(prev => [...prev, ...result.data]);
            }
            setMediaHasMore(result.pagination.hasMore);
            setMediaPage(page);
        } catch (error) {
            console.error('Failed to load media:', error);
        } finally {
            setMediaLoading(false);
        }
    }, [conversationId, mediaLoading]);

    // Load file messages
    const loadFileMessages = useCallback(async (page: number, reset: boolean = false) => {
        if (fileLoading) return;

        setFileLoading(true);
        try {
            const result = await chatService.getFileMessages(conversationId, page, 20);
            if (reset) {
                setFileMessages(result.data);
            } else {
                setFileMessages(prev => [...prev, ...result.data]);
            }
            setFileHasMore(result.pagination.hasMore);
            setFilePage(page);
        } catch (error) {
            console.error('Failed to load files:', error);
        } finally {
            setFileLoading(false);
        }
    }, [conversationId, fileLoading]);

    // Open media gallery
    const handleOpenMediaGallery = () => {
        setMediaGalleryOpen(true);
        setMediaTab(0);
        setMediaMessages([]);
        setMediaPage(1);
        setMediaHasMore(true);
        setFileMessages([]);
        setFilePage(1);
        setFileHasMore(true);
        loadMediaMessages(1, true);
    };

    // Handle tab change in media gallery
    const handleMediaTabChange = (_: React.SyntheticEvent, newValue: number) => {
        setMediaTab(newValue);
        if (newValue === 0 && mediaMessages.length === 0) {
            loadMediaMessages(1, true);
        } else if (newValue === 1 && fileMessages.length === 0) {
            loadFileMessages(1, true);
        }
    };

    // Handle scroll to load more
    const handleMediaScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.target as HTMLDivElement;
        if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
            if (mediaTab === 0 && mediaHasMore && !mediaLoading) {
                loadMediaMessages(mediaPage + 1);
            } else if (mediaTab === 1 && fileHasMore && !fileLoading) {
                loadFileMessages(filePage + 1);
            }
        }
    };

    // Get all media URLs from messages - fix to use mediaType properly
    const allMediaUrls = mediaMessages.flatMap(msg => {
        const urls: { url: string; type: 'image' | 'video'; date: string }[] = [];
        if (msg.attachments && msg.attachments.length > 0) {
            msg.attachments.forEach(attachment => {
                if (attachment?.url && (attachment.mediaType === 'IMAGE' || attachment.mediaType === 'VIDEO')) {
                    urls.push({
                        url: attachment.url,
                        type: attachment.mediaType === 'VIDEO' ? 'video' : 'image',
                        date: msg.createdAt
                    });
                }
            });
        }
        return urls;
    });

    // Get all files from file messages
    const allFiles = fileMessages.flatMap(msg => {
        const files: { url: string; fileName: string; fileSize: number; date: string }[] = [];
        if (msg.attachments && msg.attachments.length > 0) {
            msg.attachments.forEach(attachment => {
                if (attachment?.url && attachment.mediaType === 'RAW') {
                    files.push({
                        url: attachment.url,
                        fileName: attachment.fileName || 'File',
                        fileSize: attachment.fileSize || 0,
                        date: msg.createdAt
                    });
                }
            });
        }
        return files;
    });

    // Group media by month
    const groupedMedia = allMediaUrls.reduce((acc, media) => {
        const date = new Date(media.date);
        const monthYear = `Tháng ${date.getMonth() + 1} năm ${date.getFullYear()}`;
        if (!acc[monthYear]) acc[monthYear] = [];
        acc[monthYear].push(media);
        return acc;
    }, {} as Record<string, typeof allMediaUrls>);

    // Group files by month
    const groupedFiles = allFiles.reduce((acc, file) => {
        const date = new Date(file.date);
        const monthYear = `Tháng ${date.getMonth() + 1} năm ${date.getFullYear()}`;
        if (!acc[monthYear]) acc[monthYear] = [];
        acc[monthYear].push(file);
        return acc;
    }, {} as Record<string, typeof allFiles>);

    if (isLoading || !conversation) return null;

    const isGroup = conversation.type === 'GROUP';
    const isChatbot = conversation.type === 'CHATBOT';
    const isAdmin = conversation.participants.find(p => p.user._id === userId)?.isAdmin;
    const isCreator = conversation.creator === userId;
    const otherUser = conversation.participants.find(p => p.user._id !== userId)?.user;

    // Group settings
    const allowMembersToAdd = conversation.settings?.allowMembersToAdd ?? true;
    const onlyAdminCanChat = conversation.settings?.onlyAdminCanChat ?? false;

    // Check if current user can add members
    const canAddMember = isAdmin || allowMembersToAdd;

    // Helper to check if a member is the group creator
    const isMemberCreator = (memberId: string) => conversation.creator === memberId;

    // Check if current user can kick the selected member
    const canKickMember = (memberId: string) => {
        if (!isAdmin) return false; // Only admins can kick
        if (memberId === userId) return false; // Can't kick yourself
        if (isMemberCreator(memberId)) return false; // Can't kick creator
        return true; // Admins can kick other admins and regular members
    };

    const handleUpdateName = () => {
        if (socketChat && newName.trim()) {
            socketChat.emit('conversation:name', { conversationId, name: newName.trim() });
            setEditNameDialogOpen(false);
        }
    };

    const handleUpdateNickname = () => {
        if (socketChat && selectedMember && newNickname !== undefined) {
            socketChat.emit('conversation:nickname', {
                conversationId,
                targetUserId: selectedMember.user._id,
                nickname: newNickname.trim()
            });
            setEditNicknameDialogOpen(false);
            handleMemberMenuClose();
        }
    };

    const handleAddMember = (newUserId: string) => {
        if (socketChat) {
            socketChat.emit('conversation:member:add', { conversationId, newUserId }, (response: { success: boolean; error?: string }) => {
                if (response.success) {
                    toast.success(t('chat.member_added'));
                    setAddMemberDialogOpen(false);
                } else {
                    toast.error(response.error || t('chat.add_member_failed'));
                }
            });
        }
    };

    const handleQuickReaction = (emoji: { native: string }) => {
        if (socketChat) {
            socketChat.emit('conversation:quick-reaction', { conversationId, emoji: emoji.native });
            setReactionDialogOpen(false);
        }
    };

    const handleThemeChange = (color: string) => {
        if (socketChat) {
            socketChat.emit('conversation:theme', { conversationId, theme: color });
            setThemeDialogOpen(false);
        }
    };

    const handleMemberMenuOpen = (event: React.MouseEvent<HTMLElement>, member: ConversationParticipant) => {
        setMemberMenuAnchor(event.currentTarget);
        setSelectedMember(member);
    };

    const handleMemberMenuClose = () => {
        setMemberMenuAnchor(null);
        setSelectedMember(null);
    };

    const handleKickMember = () => {
        if (socketChat && selectedMember) {
            socketChat.emit('conversation:member:remove', { conversationId, targetUserId: selectedMember.user._id });
        }
        handleMemberMenuClose();
    };

    const handlePromoteAdmin = () => {
        if (!socketChat || !selectedMember) return;

        // Check if trying to promote and already at max admins
        const currentAdminCount = conversation.participants.filter(p => p.isAdmin).length;
        if (!selectedMember.isAdmin && currentAdminCount >= 3) {
            alert(t('chat.max_admins_alert', { count: 3 }));
            handleMemberMenuClose();
            return;
        }

        socketChat.emit('conversation:admin', {
            conversationId,
            targetUserId: selectedMember.user._id,
            isAdmin: !selectedMember.isAdmin
        });
        handleMemberMenuClose();
    };

    const handleLeaveGroup = () => {
        if (!socketChat || isLeaving) return;

        setIsLeaving(true);
        socketChat.emit('conversation:leave', { conversationId }, (response: { success: boolean; error?: string }) => {
            setIsLeaving(false);
            if (response.success) {
                setLeaveDialogOpen(false);
                toast.success(t('chat.left_group_success'));
                onClose();
                router.push(CLIENT_PATH.CHAT);
            } else {
                toast.error(response.error || t('chat.leave_group_failed'));
            }
        });
    };

    // Update group settings
    const handleUpdateSettings = (key: 'allowMembersToAdd' | 'onlyAdminCanChat', value: boolean) => {
        if (!socketChat) return;

        socketChat.emit('conversation:settings', {
            conversationId,
            settings: { [key]: value }
        }, (response: { success: boolean; error?: string }) => {
            if (response.success) {
                toast.success(t('chat.settings_updated'));
            } else {
                toast.error(response.error || t('chat.settings_update_failed'));
            }
        });
    };

    // Create group with selected members (minimum 2 others = total 3)
    const handleCreateGroup = () => {
        if (!socketChat || isCreatingGroup) return;

        // Validate minimum 2 members selected
        if (selectedMembers.length < 2) {
            toast.error(t('chat.min_members_group_error'));
            return;
        }

        setIsCreatingGroup(true);
        const groupName = newGroupName.trim() || t('chat.new_group');

        socketChat.emit('conversation:create-group', {
            memberIds: selectedMembers,
            groupName,
        }, (response: { success: boolean; conversation?: { _id: string }; error?: string }) => {
            setIsCreatingGroup(false);
            if (response.success && response.conversation) {
                setCreateGroupDialogOpen(false);
                setNewGroupName('');
                setSelectedMembers([]);
                setCreateGroupSearchQuery('');
                // Navigate to the new group conversation
                router.push(CLIENT_PATH.CHAT_BY_ID(response.conversation._id));
            } else {
                toast.error(response.error || t('chat.create_group_failed'));
            }
        });
    };

    // Open create group dialog and pre-select otherUser if in DIRECT chat
    const openCreateGroupDialog = () => {
        if (!isGroup && otherUser) {
            setSelectedMembers([otherUser._id]);
        } else {
            setSelectedMembers([]);
        }
        setNewGroupName('');
        setCreateGroupSearchQuery('');
        setCreateGroupDialogOpen(true);
    };


    const handleAvatarClick = (event: React.MouseEvent<HTMLElement>) => {
        if (isGroup) {
            event.stopPropagation();
            setAvatarMenuAnchor(event.currentTarget);
        }
    };

    const handleCloseAvatarMenu = () => {
        setAvatarMenuAnchor(null);
    };

    const handleViewAvatar = () => {
        if (conversation?.avatar) {
            setImagePreview(conversation.avatar);
        }
        handleCloseAvatarMenu();
    };

    const handleUploadAvatar = () => {
        avatarInputRef.current?.click();
        handleCloseAvatarMenu();
    };

    const handleAvatarFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !socketChat) return;

        try {
            const uploadedUrl = await UploadImage(file);
            socketChat.emit('conversation:avatar', { conversationId, avatar: uploadedUrl });
        } catch (error) {
            console.error('Failed to upload avatar:', error);
            alert(t('chat.upload_error'));
        }
    };


    // Block user handler
    const handleBlockUser = async () => {
        if (!otherUser || isBlocking) return;

        setIsBlocking(true);
        try {
            // Use socket for real-time update
            if (socketRelationship) {
                socketRelationship.emit('user:block', { targetUserId: otherUser._id }, (response: { success: boolean; error?: string }) => {
                    if (response.success) {
                        toast.success(t('chat.blocked_user', { name: `${otherUser.firstName} ${otherUser.lastName}` }));
                        setBlockDialogOpen(false);
                        // Invalidate queries to refresh data
                        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATION_BY_USER, 'detail', conversationId] });
                        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATIONS] });
                    } else {
                        toast.error(response.error || t('chat.block_failed'));
                    }
                    setIsBlocking(false);
                });
            } else {
                // Fallback to REST API
                await relationshipService.blockUser(otherUser._id);
                setBlockDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATION_BY_USER, 'detail', conversationId] });
                queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATIONS] });
                setIsBlocking(false);
            }
        } catch (error) {
            console.error('Failed to block user:', error);
            toast.error(t('chat.block_failed'));
            setIsBlocking(false);
        }
    };

    // Restrict user handler - using socket for real-time updates

    const handleRestrictUser = async () => {
        if (!otherUser || isRestricting) return;

        setIsRestricting(true);
        try {
            if (socketRelationship) {
                socketRelationship.emit('user:restrict', {
                    targetUserId: otherUser._id,
                    conversationId: conversationId
                }, (response: { success: boolean; error?: string }) => {
                    if (response.success) {
                        toast.success(t('chat.restricted_user', { name: `${otherUser.firstName} ${otherUser.lastName}` }));

                        // IMPORTANT: Hide conversation in global store BEFORE navigating
                        // Navigate first, then invalidate queries
                        router.push(CLIENT_PATH.CHAT);

                        // Invalidate queries to refresh data
                        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATION_BY_USER, 'detail', conversationId] });
                        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATIONS] });
                        onClose();
                    } else {
                        toast.error(response.error || t('chat.restrict_failed'));
                    }
                    setIsRestricting(false);
                });
            } else {
                // Fallback to REST API
                await relationshipService.restrictUser(otherUser._id);
                toast.success(t('chat.restricted_user', { name: `${otherUser.firstName} ${otherUser.lastName}` }));

                router.push(CLIENT_PATH.CHAT);
                queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATION_BY_USER, 'detail', conversationId] });
                queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATIONS] });
                onClose();
                setIsRestricting(false);
            }
        } catch (error) {
            console.error('Failed to restrict user:', error);
            toast.error(t('chat.restrict_failed'));
            setIsRestricting(false);
        }
    };

    const getFileIcon = (attachment: { url: string; fileName: string }) => {
        const url = attachment.url;
        const fileName = attachment.fileName;

        if (fileName.match(/\.pdf$/i) || url.includes('.pdf'))
            return <PictureAsPdfIcon sx={{ color: '#e74c3c', fontSize: 40 }} />;
        if (fileName.match(/\.(doc|docx)$/i) || url.includes('.doc'))
            return <DescriptionIcon sx={{ color: '#2b5797', fontSize: 40 }} />;
        if (fileName.match(/\.(xls|xlsx)$/i) || url.includes('.xls'))
            return (
                <InsertDriveFileIcon sx={{ color: '#1D6F42', fontSize: 40 }} />
            );
        if (fileName.match(/\.(ppt|pptx)$/i))
            return <DescriptionIcon sx={{ color: '#d24726', fontSize: 40 }} />;
        if (fileName.match(/\.rar$/i))
            return <IntegrationInstructionsIcon sx={{ color: '#d24726', fontSize: 40 }} />;
        return <InsertDriveFileIcon sx={{ color: '#65676b', fontSize: 40 }} />;
    };

    const displayName = isChatbot
        ? "BOT AI"
        : (isGroup
            ? conversation.nickname
            : `${otherUser?.firstName || ''} ${otherUser?.lastName || ''}`);

    return (
        <Box
            className="chat-info-panel"
            sx={{
                width: { xs: '100vw', md: 360 },
                minWidth: { xs: '100vw', md: 360 },
                maxWidth: { xs: '100vw', md: 360 },
                flexShrink: 0,
                height: '100%',
                borderLeft: { xs: 'none', md: `1px solid ${theme.palette.divider}` },
                position: { xs: 'fixed', md: 'relative' },
                top: 0,
                right: 0,
                zIndex: { xs: 1100, md: 'auto' },
                display: 'flex',
                flexDirection: 'column',
                bgcolor: 'background.paper',
            }}>
            {/* Header */}
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${theme.palette.divider}` }}>
                <Typography variant="h6" fontWeight={700} color="text.primary">Chi tiết</Typography>
                <IconButton onClick={onClose} size="small" sx={{ bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } }}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Box>

            <Box sx={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
                {/* Profile Section */}
                {/* Hidden file input for avatar upload */}
                <input
                    type="file"
                    ref={avatarInputRef}
                    onChange={handleAvatarFileSelect}
                    accept="image/*"
                    style={{ display: 'none' }}
                />

                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3, px: 2 }}>
                    <Box sx={{ position: 'relative', mb: 1 }}>
                        <Avatar
                            src={isChatbot ? (otherUser?.avatar || "https://cdn-icons-png.flaticon.com/512/4712/4712027.png") : (isGroup ? conversation.avatar : otherUser?.avatar)}
                            sx={{ width: 80, height: 80 }}
                        />
                        {isGroup && (
                            <IconButton
                                size="small"
                                onClick={handleAvatarClick}
                                sx={{ position: 'absolute', bottom: 0, right: -5, bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } }}
                            >
                                <PhotoCameraIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="h6" fontWeight={700} color="text.primary" textAlign="center">
                            {displayName}
                        </Typography>
                        {isGroup && (
                            <IconButton size="small" onClick={() => { setNewName(conversation.nickname || ''); setEditNameDialogOpen(true); }}>
                                <EditIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        )}
                    </Box>



                    {/* Encryption Badge */}
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        bgcolor: 'action.hover',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 3,
                        mt: 1
                    }}>
                        <LockIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography fontSize={12} color="text.secondary">Được mã hóa đầu cuối</Typography>
                    </Box>

                    {/* Quick Actions */}
                    <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
                        {/* Profile Action */}
                        {!isGroup && otherUser?.username && (
                            <Box
                                sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
                                onClick={() => router.push(CLIENT_PATH.PROFILE_BY_USERNAME(otherUser.username!))}
                            >
                                <IconButton sx={{ bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } }}>
                                    <PersonIcon sx={{ color: 'text.primary' }} />
                                </IconButton>
                                <Typography fontSize={12} color="text.primary" sx={{ mt: 0.5, maxWidth: 60, textAlign: 'center' }}>
                                    {t('common.profile')}
                                </Typography>
                            </Box>
                        )}
                        {/* Create Group Action - Only for 1-1 conversations */}
                        {!isGroup && otherUser && (
                            <Box
                                sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
                                onClick={openCreateGroupDialog}
                            >
                                <IconButton sx={{ bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } }}>
                                    <GroupAddIcon sx={{ color: 'text.primary' }} />
                                </IconButton>
                                <Typography fontSize={12} color="text.primary" sx={{ mt: 0.5, maxWidth: 60, textAlign: 'center' }}>
                                    {t('chat.create_group_chat')}
                                </Typography>
                            </Box>
                        )}
                        {/* Notification Action */}
                        <Box
                            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: isMuting ? 'not-allowed' : 'pointer', opacity: isMuting ? 0.5 : 1 }}
                            onClick={handleToggleMute}
                        >
                            <IconButton
                                disabled={isMuting}
                                sx={{
                                    bgcolor: isMuted ? themeColor : 'action.hover',
                                    '&:hover': { bgcolor: isMuted ? themeColor : 'action.selected' }
                                }}
                            >
                                {isMuted ? (
                                    <NotificationsOffIcon sx={{ color: 'white' }} />
                                ) : (
                                    <NotificationsIcon sx={{ color: 'text.primary' }} />
                                )}
                            </IconButton>
                            <Typography fontSize={12} color="text.primary" sx={{ mt: 0.5, maxWidth: 60, textAlign: 'center' }}>
                                {isMuted ? t('chat.unmute_notifications') : t('chat.mute_notifications')}
                            </Typography>
                        </Box>
                        {/* Search Action */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                            <IconButton sx={{ bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } }}>
                                <SearchIcon sx={{ color: 'text.primary' }} />
                            </IconButton>
                            <Typography fontSize={12} color="text.primary" sx={{ mt: 0.5, maxWidth: 60, textAlign: 'center' }}>
                                {t('common.search')}
                            </Typography>
                        </Box>
                    </Box>
                </Box>

                {/* Customize Section */}
                <Box sx={{ px: 1 }}>
                    <ListItemButton onClick={() => setCustomizeOpen(!customizeOpen)} sx={{ borderRadius: 2 }}>
                        <ListItemText
                            primary={<Typography fontWeight={600} color="text.primary">{t('chat.customize_chat')}</Typography>}
                        />
                        {customizeOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </ListItemButton>
                    <Collapse in={customizeOpen}>
                        <List disablePadding sx={{ pl: 1 }}>
                            <ListItemButton sx={{ borderRadius: 2, py: 1 }} onClick={() => setThemeDialogOpen(true)}>
                                <Box sx={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    background: THEME_COLORS.find(t => t.color === conversation.theme)?.gradient || THEME_COLORS[0].gradient,
                                    mr: 2
                                }} />
                                <ListItemText primary={<Typography fontSize={14} color="text.primary">{t('chat.change_theme')}</Typography>} />
                            </ListItemButton>
                            <ListItemButton sx={{ borderRadius: 2, py: 1 }} onClick={() => setReactionDialogOpen(true)}>
                                <Typography fontSize={24} sx={{ mr: 2 }}>{conversation.quickReaction || '👍'}</Typography>
                                <ListItemText primary={<Typography fontSize={14} color="text.primary">{t('chat.change_emoji')}</Typography>} />
                            </ListItemButton>
                            <ListItemButton sx={{ borderRadius: 2, py: 1 }} onClick={() => setNicknameListDialogOpen(true)}>
                                <Box sx={{ width: 32, display: 'flex', justifyContent: 'center', mr: 2 }}>
                                    <Typography fontSize={16} fontWeight={700} color="text.primary">Aa</Typography>
                                </Box>
                                <ListItemText primary={<Typography fontSize={14} color="text.primary">{t('chat.nicknames')}</Typography>} />
                            </ListItemButton>
                        </List>
                    </Collapse>
                </Box>

                <Divider sx={{ my: 1 }} />

                {/* Media Section */}
                <Box sx={{ px: 1 }}>
                    <ListItemButton onClick={() => setMediaOpen(!mediaOpen)} sx={{ borderRadius: 2 }}>
                        <ListItemText
                            primary={<Typography fontWeight={600} color="text.primary">{t('chat.media_and_files')}</Typography>}
                        />
                        {mediaOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </ListItemButton>
                    <Collapse in={mediaOpen}>
                        <List disablePadding sx={{ pl: 1 }}>
                            <ListItemButton sx={{ borderRadius: 2, py: 1 }} onClick={handleOpenMediaGallery}>
                                <PhotoIcon sx={{ mr: 2, color: 'text.secondary' }} />
                                <ListItemText primary={<Typography fontSize={14} color="text.primary">{t('chat.shared_media')}</Typography>} />
                            </ListItemButton>
                            <ListItemButton sx={{ borderRadius: 2, py: 1 }} onClick={handleOpenMediaGallery}>
                                <FileIcon sx={{ mr: 2, color: 'text.secondary' }} />
                                <ListItemText primary={<Typography fontSize={14} color="text.primary">{t('chat.shared_files')}</Typography>} />
                            </ListItemButton>
                        </List>
                    </Collapse>
                </Box>

                <Divider sx={{ my: 1 }} />

                {/* Group Settings Section */}
                {isGroup && isAdmin && (
                    <>
                        <Box sx={{ px: 1 }}>
                            <ListItemButton onClick={() => setSettingsOpen(!settingsOpen)} sx={{ borderRadius: 2 }}>
                                <SettingsIcon sx={{ mr: 2, color: 'text.secondary' }} />
                                <ListItemText
                                    primary={<Typography fontWeight={600} color="text.primary">{t('chat.group_settings')}</Typography>}
                                />
                                {settingsOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </ListItemButton>
                            <Collapse in={settingsOpen}>
                                <Box sx={{ px: 2, py: 1 }}>
                                    <Box sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        py: 1.5,
                                        borderBottom: `1px solid ${theme.palette.divider}`
                                    }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                            <PersonAddIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                                            <Box>
                                                <Typography fontSize={14} color="text.primary" fontWeight={500}>
                                                    {t('chat.allow_members_add')}
                                                </Typography>
                                                <Typography fontSize={12} color="text.secondary">
                                                    {t('chat.allow_members_add_desc')}
                                                </Typography>
                                            </Box>
                                        </Box>
                                        <Switch
                                            checked={allowMembersToAdd}
                                            onChange={(e) => handleUpdateSettings('allowMembersToAdd', e.target.checked)}
                                            sx={{
                                                '& .MuiSwitch-switchBase.Mui-checked': {
                                                    color: themeColor,
                                                },
                                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                                    backgroundColor: themeColor,
                                                },
                                            }}
                                        />
                                    </Box>
                                    <Box sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        py: 1.5,
                                    }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                            <ChatIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                                            <Box>
                                                <Typography fontSize={14} color="text.primary" fontWeight={500}>
                                                    {t('chat.only_admins_chat')}
                                                </Typography>
                                                <Typography fontSize={12} color="text.secondary">
                                                    {t('chat.only_admins_chat_desc')}
                                                </Typography>
                                            </Box>
                                        </Box>
                                        <Switch
                                            checked={onlyAdminCanChat}
                                            onChange={(e) => handleUpdateSettings('onlyAdminCanChat', e.target.checked)}
                                            sx={{
                                                '& .MuiSwitch-switchBase.Mui-checked': {
                                                    color: themeColor,
                                                },
                                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                                    backgroundColor: themeColor,
                                                },
                                            }}
                                        />
                                    </Box>
                                </Box>
                            </Collapse>
                        </Box>
                        <Divider sx={{ my: 1 }} />
                    </>
                )}

                {/* Members Section */}
                {isGroup && (
                    <Box sx={{ px: 1 }}>
                        <ListItemButton onClick={() => setMembersOpen(!membersOpen)} sx={{ borderRadius: 2 }}>
                            <ListItemText
                                primary={<Typography fontWeight={600} color="text.primary">{t('chat.members')} ({conversation.participants.filter(p => !p.kickedAt && !p.leftAt).length})</Typography>}
                            />
                            {canAddMember && (
                                <IconButton size="small" onClick={(e) => { e.stopPropagation(); setAddMemberDialogOpen(true); }}>
                                    <PersonAddIcon fontSize="small" />
                                </IconButton>
                            )}
                            {membersOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </ListItemButton>
                        <Collapse in={membersOpen}>
                            <List disablePadding>
                                {conversation.participants.filter(p => !p.kickedAt && !p.leftAt).map((member) => {
                                    const memberIsCreator = isMemberCreator(member.user._id);
                                    const memberRole = memberIsCreator
                                        ? t('chat.creator')
                                        : member.isAdmin
                                            ? t('chat.admin')
                                            : '';

                                    // Get online status for member
                                    const memberOnlineStatus = onlineUsers[member.user._id];
                                    const isOnline = memberOnlineStatus?.isOnline || member.user.status === 'ACTIVE';
                                    const lastActive = memberOnlineStatus?.lastActive || member.user.lastActive;

                                    // Get display status text
                                    const getStatusText = () => {
                                        if (memberRole) return memberRole;
                                        if (isOnline) return t('chat.chat_online');
                                        if (lastActive) return `${t('common.active')} ${timeAgo(lastActive)}`;
                                        return t('chat.chat_offline');
                                    };

                                    return (
                                        <ListItem key={member.user._id} sx={{ px: 2 }}>
                                            <ListItemAvatar>
                                                <Badge
                                                    overlap="circular"
                                                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                                    variant="dot"
                                                    sx={{
                                                        '& .MuiBadge-badge': {
                                                            backgroundColor: isOnline ? theme.palette.success.main : theme.palette.text.secondary,
                                                            border: '2px solid white',
                                                            width: 10,
                                                            height: 10,
                                                            borderRadius: '50%',
                                                        },
                                                    }}
                                                >
                                                    <Avatar src={member.user.avatar} sx={{ width: 36, height: 36 }} />
                                                </Badge>
                                            </ListItemAvatar>
                                            <ListItemText
                                                primary={member.nickname || `${member.user.firstName} ${member.user.lastName}`}
                                                secondary={getStatusText()}
                                                primaryTypographyProps={{ fontSize: 14, fontWeight: 500, color: 'text.primary' }}
                                                secondaryTypographyProps={{
                                                    fontSize: 12,
                                                    color: memberIsCreator ? themeColor : isOnline ? 'success.main' : 'text.secondary',
                                                    fontWeight: memberIsCreator ? 600 : 400
                                                }}
                                            />
                                            {(isAdmin || member.user._id === userId) && (
                                                <ListItemSecondaryAction>
                                                    <IconButton size="small" onClick={(e) => handleMemberMenuOpen(e, member)}>
                                                        <MoreVertIcon fontSize="small" />
                                                    </IconButton>
                                                </ListItemSecondaryAction>
                                            )}
                                        </ListItem>
                                    );
                                })}
                            </List>
                        </Collapse>

                        {/* Leave Group Button */}
                        <Box sx={{ px: 1, mt: 2 }}>
                            <Button
                                fullWidth
                                startIcon={<ExitToAppIcon />}
                                onClick={() => setLeaveDialogOpen(true)}
                                sx={{
                                    justifyContent: 'flex-start',
                                    textTransform: 'none',
                                    color: 'error.main',
                                    py: 1.5,
                                    borderRadius: 2,
                                    '&:hover': {
                                        bgcolor: (theme) => alpha(theme.palette.error.main, 0.08),
                                    },
                                }}
                            >
                                Rời khỏi nhóm
                            </Button>
                        </Box>
                    </Box>
                )}

                {/* Privacy & Support Section - Only for DIRECT chat */}
                {!isGroup && otherUser && (
                    <>
                        <Divider sx={{ my: 1 }} />
                        <Box sx={{ px: 1 }}>
                            <ListItemButton onClick={() => setPrivacyOpen(!privacyOpen)} sx={{ borderRadius: 2 }}>
                                <ListItemText
                                    primary={<Typography fontWeight={600} color="text.primary">{t('chat.privacy_support')}</Typography>}
                                />
                                {privacyOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </ListItemButton>
                            <Collapse in={privacyOpen}>
                                <List disablePadding sx={{ pl: 1 }}>
                                    <ListItemButton
                                        sx={{ borderRadius: 2, py: 1 }}
                                        onClick={() => setBlockDialogOpen(true)}
                                    >
                                        <BlockIcon sx={{ mr: 2, color: 'error.main' }} />
                                        <ListItemText
                                            primary={<Typography fontSize={14} color="text.primary">{t('chat.block_user', { name: `${otherUser.firstName} ${otherUser.lastName}` })}</Typography>}
                                            secondary={<Typography fontSize={12} color="text.secondary">{t('chat.block_user_desc')}</Typography>}
                                        />
                                    </ListItemButton>
                                    <ListItemButton
                                        sx={{ borderRadius: 2, py: 1 }}
                                        onClick={() => handleRestrictUser()}
                                    >
                                        <PersonOffIcon sx={{ mr: 2, color: 'warning.main' }} />
                                        <ListItemText
                                            primary={<Typography fontSize={14} color="text.primary">{t('chat.restrict_user', { name: `${otherUser.firstName} ${otherUser.lastName}` })}</Typography>}
                                            secondary={<Typography fontSize={12} color="text.secondary">{t('chat.restrict_user_desc')}</Typography>}
                                        />
                                    </ListItemButton>
                                </List>
                            </Collapse>
                        </Box>
                    </>
                )}
            </Box>

            {/* Block User Confirmation Dialog */}
            <Dialog
                open={blockDialogOpen}
                onClose={() => !isBlocking && setBlockDialogOpen(false)}
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        maxWidth: 400,
                        overflow: 'hidden',
                    }
                }}
            >
                <Box sx={{
                    background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
                    p: 3,
                    textAlign: 'center',
                }}>
                    <Box sx={{
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        bgcolor: 'rgba(255,255,255,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                    }}>
                        <BlockIcon sx={{ fontSize: 32, color: 'white' }} />
                    </Box>
                    <Typography variant="h6" fontWeight={700} color="white">
                        {t('chat.block_confirm_title', { name: `${otherUser?.firstName} ${otherUser?.lastName}` })}
                    </Typography>
                </Box>
                <DialogContent sx={{ p: 3, textAlign: 'center' }}>
                    <Typography color="text.secondary" sx={{ mb: 2 }}>
                        {t('chat.block_confirm_warning')}
                    </Typography>
                    <Box sx={{ textAlign: 'left', bgcolor: 'action.hover', p: 2, borderRadius: 2 }}>
                        <Typography variant="body2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                            • {t('chat.block_warning_1')}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                            • {t('chat.block_warning_2')}
                        </Typography>
                        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            • {t('chat.block_warning_3')}
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 0, gap: 1 }}>
                    <Button
                        fullWidth
                        variant="outlined"
                        onClick={() => setBlockDialogOpen(false)}
                        disabled={isBlocking}
                        sx={{
                            borderRadius: 2,
                            py: 1.2,
                            textTransform: 'none',
                            fontWeight: 600,
                        }}
                    >
                        {t('common.cancel')}
                    </Button>
                    <Button
                        fullWidth
                        variant="contained"
                        color="error"
                        onClick={handleBlockUser}
                        disabled={isBlocking}
                        sx={{
                            borderRadius: 2,
                            py: 1.2,
                            textTransform: 'none',
                            fontWeight: 600,
                        }}
                    >
                        {isBlocking ? <CircularProgress size={20} color="inherit" /> : t('common.block')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Leave Group Confirmation Dialog */}
            <Dialog
                open={leaveDialogOpen}
                onClose={() => !isLeaving && setLeaveDialogOpen(false)}
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        maxWidth: 400,
                        overflow: 'hidden',
                    }
                }}
            >
                <Box sx={{
                    background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%)',
                    p: 3,
                    textAlign: 'center',
                }}>
                    <Box sx={{
                        width: 70,
                        height: 70,
                        borderRadius: '50%',
                        bgcolor: 'rgba(255,255,255,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                    }}>
                        <WarningIcon sx={{ fontSize: 40, color: 'white' }} />
                    </Box>
                    <Typography variant="h6" fontWeight={700} color="white">
                        {t('chat.leave_group_confirm_title')}
                    </Typography>
                </Box>
                <DialogContent sx={{ p: 3, textAlign: 'center' }}>
                    <Typography color="text.secondary" fontSize={14} sx={{ mb: 2 }}>
                        {t('chat.leave_group_confirm_desc')}
                    </Typography>
                    <Typography color="text.secondary" fontSize={13} sx={{ fontStyle: 'italic' }}>
                        {isCreator
                            ? t('chat.leave_group_creator_note')
                            : t('chat.leave_group_member_note')}
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 0, gap: 1 }}>
                    <Button
                        onClick={() => setLeaveDialogOpen(false)}
                        disabled={isLeaving}
                        sx={{
                            flex: 1,
                            borderRadius: 2,
                            py: 1.2,
                            textTransform: 'none',
                            fontWeight: 600,
                            color: 'text.secondary',
                            border: `1px solid ${theme.palette.divider}`,
                            '&:hover': {
                                bgcolor: 'action.hover',
                                border: `1px solid ${theme.palette.divider}`,
                            },
                        }}
                    >
                        {t('common.cancel')}
                    </Button>
                    <Button
                        onClick={handleLeaveGroup}
                        disabled={isLeaving}
                        sx={{
                            flex: 1,
                            borderRadius: 2,
                            py: 1.2,
                            textTransform: 'none',
                            fontWeight: 600,
                            bgcolor: '#dc3545',
                            color: 'white',
                            '&:hover': {
                                bgcolor: '#c82333',
                            },
                        }}
                    >
                        {isLeaving ? <CircularProgress size={20} sx={{ color: 'white' }} /> : t('chat.leave_group')}
                    </Button>
                </DialogActions>
            </Dialog>



            {/* Theme Dialog */}
            <Dialog open={themeDialogOpen} onClose={() => setThemeDialogOpen(false)} PaperProps={{ sx: { bgcolor: 'background.paper', borderRadius: 3 } }}>
                <DialogTitle sx={{ color: 'text.primary' }}>{t('chat.change_theme')}</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, py: 1 }}>
                        {THEME_COLORS.map(item => (
                            <Box
                                key={item.color}
                                onClick={() => handleThemeChange(item.color)}
                                sx={{
                                    width: 40, height: 40, borderRadius: '50%',
                                    background: item.gradient, cursor: 'pointer',
                                    border: conversation.theme === item.color ? `3px solid ${theme.palette.text.primary}` : 'none',
                                    '&:hover': { transform: 'scale(1.1)' },
                                    transition: 'transform 0.15s'
                                }}
                            />
                        ))}
                    </Box>
                </DialogContent>
            </Dialog>

            {/* Reaction Dialog with Full Emoji Picker */}
            <Dialog
                open={reactionDialogOpen}
                onClose={() => setReactionDialogOpen(false)}
                PaperProps={{ sx: { bgcolor: 'transparent', boxShadow: 'none', overflow: 'visible' } }}
            >
                <Box sx={{ borderRadius: 3, overflow: 'hidden' }}>
                    <Picker
                        data={data}
                        onEmojiSelect={handleQuickReaction}
                        theme={isDark ? 'dark' : 'light'}
                        locale="vi"
                        previewPosition="none"
                        skinTonePosition="none"
                        perLine={8}
                        maxFrequentRows={2}
                    />
                </Box>
            </Dialog>

            {/* Edit Name Dialog */}
            <Dialog open={editNameDialogOpen} onClose={() => setEditNameDialogOpen(false)} PaperProps={{ sx: { bgcolor: 'background.paper', borderRadius: 1, padding: 1 } }}>
                <DialogTitle sx={{ color: 'text.primary' }}>{t('chat.group_name')}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus margin="dense" label={t('chat.group_name')} fullWidth variant="outlined"
                        value={newName} onChange={(e) => setNewName(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditNameDialogOpen(false)}>{t('common.cancel')}</Button>
                    <Button onClick={handleUpdateName} variant="contained" disabled={!newName.trim()}>{t('common.save')}</Button>
                </DialogActions>
            </Dialog>

            {/* Nickname List Dialog */}
            <Dialog
                open={nicknameListDialogOpen}
                onClose={() => setNicknameListDialogOpen(false)}
                fullWidth
                maxWidth="xs"
                PaperProps={{ sx: { bgcolor: 'background.paper', borderRadius: 3 } }}
            >
                <DialogTitle sx={{ color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
                    <IconButton onClick={() => setNicknameListDialogOpen(false)} size="small">
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h6" fontWeight={600}>{t('chat.nicknames')}</Typography>
                </DialogTitle>
                <DialogContent sx={{ px: 0 }}>
                    <List>
                        {conversation?.participants.map((participant) => {
                            const fullName = `${participant.user.firstName || ''} ${participant.user.lastName || ''}`.trim();
                            const isCurrentUser = participant.user._id === userId;

                            return (
                                <ListItem
                                    key={participant.user._id}
                                    sx={{
                                        cursor: 'pointer',
                                        '&:hover': { bgcolor: 'action.hover' },
                                        borderRadius: 2,
                                        mx: 1,
                                        width: 'auto'
                                    }}
                                    onClick={() => {
                                        setSelectedMember(participant);
                                        setNewNickname(participant.nickname || '');
                                        setEditNicknameDialogOpen(true);
                                    }}
                                >
                                    <ListItemAvatar>
                                        <Avatar src={participant.user.avatar} sx={{ width: 40, height: 40 }} />
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={
                                            <Typography fontWeight={500} color="text.primary">
                                                {participant.nickname || fullName}
                                                {isCurrentUser && ` (${t('common.you')})`}
                                            </Typography>
                                        }
                                        secondary={
                                            participant.nickname ? (
                                                <Typography fontSize={13} color="text.secondary">
                                                    {fullName}
                                                </Typography>
                                            ) : (
                                                <Typography fontSize={13} color="text.secondary">
                                                    {t('chat.set_nickname_title')}
                                                </Typography>
                                            )
                                        }
                                    />
                                    <EditIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                                </ListItem>
                            );
                        })}
                    </List>
                </DialogContent>
            </Dialog>

            {/* Edit Nickname Dialog */}
            <Dialog open={editNicknameDialogOpen} onClose={() => setEditNicknameDialogOpen(false)} PaperProps={{ sx: { bgcolor: 'background.paper', borderRadius: 3 } }}>
                <DialogTitle sx={{ color: 'text.primary' }}>{t('chat.set_nickname_title')}</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                        {t('chat.set_nickname_desc', { name: `${selectedMember?.user.firstName} ${selectedMember?.user.lastName}` })}
                    </Typography>
                    <TextField
                        autoFocus margin="dense" label={t('chat.nicknames')} fullWidth variant="outlined"
                        value={newNickname} onChange={(e) => setNewNickname(e.target.value)} placeholder={t('chat.set_nickname_placeholder')}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditNicknameDialogOpen(false)}>{t('common.cancel')}</Button>
                    <Button onClick={handleUpdateNickname} variant="contained">{t('common.save')}</Button>
                </DialogActions>
            </Dialog>

            {/* Add Member Dialog */}
            <Dialog open={addMemberDialogOpen} onClose={() => { setAddMemberDialogOpen(false); setSearchQuery(''); }} fullWidth maxWidth="xs" PaperProps={{ sx: { bgcolor: 'background.paper', borderRadius: 3 } }}>
                <DialogTitle sx={{ color: 'text.primary' }}>{t('chat.add_members')}</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {t('chat.add_member_note')}
                    </Typography>
                    <TextField
                        autoFocus margin="dense" label={t('friends.search_friends')} fullWidth variant="outlined"
                        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('chat.search_friend_placeholder')}
                    />
                    <List sx={{ mt: 2, maxHeight: 300, overflowY: 'auto' }}>
                        {isFriendsLoading ? (
                            <CircularProgress size={24} sx={{ display: 'block', m: 'auto' }} />
                        ) : filteredFriends.length === 0 ? (
                            <Typography color="text.secondary" textAlign="center" py={2}>
                                {searchQuery ? t('chat.no_friend_found') : t('chat.all_friends_in_group')}
                            </Typography>
                        ) : (
                            filteredFriends.map((friend: FriendType) => (
                                <ListItem key={friend._id}>
                                    <ListItemAvatar><Avatar src={friend.avatar} /></ListItemAvatar>
                                    <ListItemText
                                        primary={`${friend.firstName} ${friend.lastName}`}
                                        secondary={friend.username}
                                    />
                                    <ListItemSecondaryAction>
                                        <Button
                                            size="small"
                                            variant="contained"
                                            onClick={() => handleAddMember(friend._id)}
                                        >
                                            {t('common.add')}
                                        </Button>
                                    </ListItemSecondaryAction>
                                </ListItem>
                            ))
                        )}
                    </List>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setAddMemberDialogOpen(false); setSearchQuery(''); }}>{t('common.close')}</Button>
                </DialogActions>
            </Dialog>

            {/* Member Action Menu */}
            <Menu
                anchorEl={memberMenuAnchor}
                open={Boolean(memberMenuAnchor)}
                onClose={handleMemberMenuClose}
                slotProps={{ paper: { sx: { bgcolor: 'background.paper', borderRadius: 2, boxShadow: '0 2px 12px rgba(0,0,0,0.15)' } } }}
            >
                <MenuItem onClick={() => { setEditNicknameDialogOpen(true); setNewNickname(selectedMember?.nickname || ''); }}>
                    <EditIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography color="text.primary">{t('chat.set_nickname_title')}</Typography>
                </MenuItem>
                {/* Admin can promote/demote other members (but can't demote creator) */}
                {isAdmin && selectedMember && selectedMember.user._id !== userId && !isMemberCreator(selectedMember.user._id) && (
                    <MenuItem onClick={handlePromoteAdmin}>
                        <SecurityIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography color="text.primary">{selectedMember.isAdmin ? t('chat.remove_admin') : t('chat.make_admin')}</Typography>
                    </MenuItem>
                )}
                {/* Admin can kick other members and other admins (but not creator) */}
                {selectedMember && canKickMember(selectedMember.user._id) && (
                    <MenuItem onClick={handleKickMember}>
                        <ExitToAppIcon fontSize="small" sx={{ mr: 1, color: '#e74c3c' }} />
                        <Typography color="#e74c3c">{t('chat.remove_from_group')}</Typography>
                    </MenuItem>
                )}
            </Menu>

            {/* Media Gallery Dialog */}
            <Dialog
                open={mediaGalleryOpen}
                onClose={() => setMediaGalleryOpen(false)}
                fullWidth
                maxWidth="sm"
                PaperProps={{
                    sx: {
                        bgcolor: 'background.paper',
                        borderRadius: 3,
                        height: '80vh',
                        maxHeight: '600px'
                    }
                }}
            >
                <DialogTitle sx={{
                    color: 'text.primary',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    pb: 1
                }}>
                    <IconButton onClick={() => setMediaGalleryOpen(false)} size="small">
                        <ArrowBackIcon />
                    </IconButton>
                    <Box component="span" sx={{ fontSize: '1.25rem', fontWeight: 600 }}>{t('chat.media_gallery_title')}</Box>
                </DialogTitle>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs
                        value={mediaTab}
                        onChange={handleMediaTabChange}
                        sx={{
                            '& .MuiTab-root': {
                                textTransform: 'none',
                                fontWeight: 600,
                                color: 'text.secondary',
                                '&.Mui-selected': { color: themeColor }
                            },
                            '& .MuiTabs-indicator': { backgroundColor: themeColor }
                        }}
                    >
                        <Tab label={t('chat.shared_media')} />
                        <Tab label={t('chat.shared_files')} />
                    </Tabs>
                </Box>
                <DialogContent
                    sx={{ p: 0, overflowY: 'auto' }}
                    onScroll={handleMediaScroll}
                >
                    {mediaTab === 0 && (
                        <Box sx={{ p: 2 }}>
                            {allMediaUrls.length === 0 && !mediaLoading ? (
                                <Typography color="text.secondary" textAlign="center" py={4}>
                                    {t('chat.no_media')}
                                </Typography>
                            ) : (
                                Object.entries(groupedMedia).map(([monthYear, items]) => (
                                    <Box key={monthYear} sx={{ mb: 3 }}>
                                        <Typography
                                            variant="subtitle2"
                                            color="text.secondary"
                                            sx={{ mb: 1, fontWeight: 600 }}
                                        >
                                            {monthYear}
                                        </Typography>
                                        <Box sx={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(3, 1fr)',
                                            gap: 0.5
                                        }}>
                                            {items.map((media, idx) => (
                                                <Box
                                                    key={idx}
                                                    sx={{
                                                        position: 'relative',
                                                        paddingTop: '100%',
                                                        cursor: 'pointer',
                                                        borderRadius: 1,
                                                        overflow: 'hidden',
                                                        '&:hover': { opacity: 0.9 }
                                                    }}
                                                    onClick={() => setImagePreview(media.url)}
                                                >
                                                    {media.type === 'video' ? (
                                                        <>
                                                            <video
                                                                src={media.url}
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: 0,
                                                                    left: 0,
                                                                    width: '100%',
                                                                    height: '100%',
                                                                    objectFit: 'cover'
                                                                }}
                                                            />
                                                            <Box sx={{
                                                                position: 'absolute',
                                                                top: '50%',
                                                                left: '50%',
                                                                transform: 'translate(-50%, -50%)',
                                                                color: 'white',
                                                                bgcolor: 'rgba(0,0,0,0.5)',
                                                                borderRadius: '50%'
                                                            }}>
                                                                <PlayCircleIcon sx={{ fontSize: 40 }} />
                                                            </Box>
                                                        </>
                                                    ) : (
                                                        <Box
                                                            component="img"
                                                            src={media.url}
                                                            alt=""
                                                            sx={{
                                                                position: 'absolute',
                                                                top: 0,
                                                                left: 0,
                                                                width: '100%',
                                                                height: '100%',
                                                                objectFit: 'cover'
                                                            }}
                                                        />
                                                    )}
                                                </Box>
                                            ))}
                                        </Box>
                                    </Box>
                                ))
                            )}
                            {mediaLoading && (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                                    <CircularProgress size={24} />
                                </Box>
                            )}
                        </Box>
                    )}
                    {mediaTab === 1 && (
                        <Box sx={{ p: 2 }}>
                            {allFiles.length === 0 && !fileLoading ? (
                                <Typography color="text.secondary" textAlign="center" py={4}>
                                    {t('chat.no_files')}
                                </Typography>
                            ) : (
                                Object.entries(groupedFiles).map(([monthYear, files]) => (
                                    <Box key={monthYear} sx={{ mb: 2 }}>
                                        <Typography
                                            variant="subtitle2"
                                            color="text.secondary"
                                            sx={{ mb: 1, fontWeight: 600, px: 1 }}
                                        >
                                            {monthYear}
                                        </Typography>
                                        <List disablePadding>
                                            {files.map((file, idx) => (
                                                <ListItem
                                                    key={idx}
                                                    component="a"
                                                    href={file.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    sx={{
                                                        px: 1,
                                                        py: 1,
                                                        borderRadius: 1,
                                                        mb: 0.5,
                                                        cursor: 'pointer',
                                                        textDecoration: 'none',
                                                        color: 'inherit',
                                                        '&:hover': { bgcolor: 'action.hover' }
                                                    }}
                                                >
                                                    <ListItemAvatar>
                                                        {getFileIcon(file as { url: string; fileName: string })}
                                                    </ListItemAvatar>
                                                    <ListItemText
                                                        primary={
                                                            <Typography
                                                                fontSize={14}
                                                                color="text.primary"
                                                                sx={{
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap',
                                                                    maxWidth: 200
                                                                }}
                                                            >
                                                                {file.fileName}
                                                            </Typography>
                                                        }
                                                        secondary={
                                                            <Typography fontSize={12} color="text.secondary">
                                                                {file.fileSize > 0
                                                                    ? file.fileSize > 1024 * 1024
                                                                        ? `${(file.fileSize / (1024 * 1024)).toFixed(1)} MB`
                                                                        : `${(file.fileSize / 1024).toFixed(1)} KB`
                                                                    : t('chat.unknown_size')
                                                                } • {new Date(file.date).toLocaleDateString('vi-VN')}
                                                            </Typography>
                                                        }
                                                    />
                                                </ListItem>
                                            ))}
                                        </List>
                                    </Box>
                                ))
                            )}
                            {fileLoading && (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                                    <CircularProgress size={24} />
                                </Box>
                            )}
                        </Box>
                    )}
                </DialogContent>
            </Dialog>

            {/* Create Group Dialog */}
            <Dialog
                open={createGroupDialogOpen}
                onClose={() => !isCreatingGroup && setCreateGroupDialogOpen(false)}
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: { bgcolor: 'background.paper', borderRadius: 3, maxHeight: '80vh' } }}
            >
                <DialogTitle sx={{ color: 'text.primary', pb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <GroupAddIcon sx={{ color: 'primary.main', fontSize: 24 }} />
                        </Box>
                        <Box>
                            <Typography fontWeight={700} fontSize={18}>{t('chat.create_group_title')}</Typography>
                            <Typography fontSize={13} color="text.secondary">
                                {t('chat.create_group_desc')}
                            </Typography>
                        </Box>
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    <Box sx={{ mt: 1 }}>
                        <Typography fontSize={14} fontWeight={500} color="text.primary" sx={{ mb: 1 }}>
                            {t('chat.group_name')}
                        </Typography>
                        <TextField
                            fullWidth
                            variant="outlined"
                            placeholder={t('groups.group_name_placeholder')}
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            disabled={isCreatingGroup}
                            size="small"
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: 2,
                                }
                            }}
                        />
                    </Box>

                    {/* Selected members chips */}
                    {selectedMembers.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                            <Typography fontSize={14} fontWeight={500} color="text.primary" sx={{ mb: 1 }}>
                                {t('chat.selected_count', { count: selectedMembers.length + 1 })}
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {selectedMembers.map(memberId => {
                                    const friend = friends.find(f => f._id === memberId);
                                    if (!friend) return null;
                                    return (
                                        <Chip
                                            key={memberId}
                                            avatar={<Avatar src={friend.avatar} sx={{ width: 24, height: 24 }} />}
                                            label={`${friend.firstName} ${friend.lastName}`}
                                            onDelete={() => toggleMemberSelection(memberId)}
                                            size="small"
                                            sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}
                                        />
                                    );
                                })}
                            </Box>
                        </Box>
                    )}

                    {/* Friends list with checkboxes */}
                    <Box sx={{ mt: 2 }}>
                        <Typography fontSize={14} fontWeight={500} color="text.primary" sx={{ mb: 1 }}>
                            {t('chat.choose_friends')}
                        </Typography>
                        <TextField
                            fullWidth
                            variant="outlined"
                            placeholder={t('friends.search_friends')}
                            value={createGroupSearchQuery}
                            onChange={(e) => setCreateGroupSearchQuery(e.target.value)}
                            size="small"
                            sx={{ mb: 1, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                        <List sx={{ maxHeight: 250, overflowY: 'auto', bgcolor: 'background.default', borderRadius: 2 }}>
                            {isFriendsLoading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                                    <CircularProgress size={24} />
                                </Box>
                            ) : filteredFriendsForGroup.length === 0 ? (
                                <Typography color="text.secondary" textAlign="center" py={2}>
                                    {createGroupSearchQuery ? t('chat.no_friend_found') : t('friends.no_friends')}
                                </Typography>
                            ) : (
                                filteredFriendsForGroup.map((friend) => {
                                    const isSelected = selectedMembers.includes(friend._id);
                                    return (
                                        <ListItem
                                            key={friend._id}
                                            dense
                                            sx={{
                                                py: 0.5,
                                                cursor: 'pointer',
                                                '&:hover': { bgcolor: 'action.hover' },
                                                bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.1) : 'transparent'
                                            }}
                                            onClick={() => toggleMemberSelection(friend._id)}
                                        >
                                            <Checkbox
                                                checked={isSelected}
                                                sx={{
                                                    mr: 1,
                                                    color: 'text.secondary',
                                                    '&.Mui-checked': { color: 'primary.main' }
                                                }}
                                            />
                                            <ListItemAvatar>
                                                <Avatar src={friend.avatar} sx={{ width: 40, height: 40 }} />
                                            </ListItemAvatar>
                                            <ListItemText
                                                primary={`${friend.firstName} ${friend.lastName}`}
                                                secondary={friend.username}
                                                primaryTypographyProps={{ fontWeight: 500, color: 'text.primary' }}
                                                secondaryTypographyProps={{ fontSize: 12 }}
                                            />
                                        </ListItem>
                                    );
                                })
                            )}
                        </List>
                    </Box>

                    {/* Info note */}
                    <Box sx={{
                        mt: 2,
                        p: 1.5,
                        bgcolor: selectedMembers.length < 2 ? alpha(theme.palette.warning.main, 0.1) : alpha(theme.palette.success.main, 0.1),
                        borderRadius: 2,
                        display: 'flex',
                        gap: 1
                    }}>
                        <PersonAddIcon sx={{ color: selectedMembers.length < 2 ? 'warning.main' : 'success.main', fontSize: 20, mt: 0.2 }} />
                        <Typography fontSize={13} color={selectedMembers.length < 2 ? 'warning.main' : 'success.main'}>
                            {selectedMembers.length < 2
                                ? t('chat.need_more_members', { count: 2 - selectedMembers.length })
                                : t('chat.qualified_create_group', { count: selectedMembers.length + 1 })
                            }
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button
                        onClick={() => {
                            setCreateGroupDialogOpen(false);
                            setSelectedMembers([]);
                            setCreateGroupSearchQuery('');
                        }}
                        disabled={isCreatingGroup}
                        sx={{ borderRadius: 2, textTransform: 'none', color: 'text.secondary' }}
                    >
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleCreateGroup}
                        disabled={isCreatingGroup || selectedMembers.length < 2}
                        startIcon={isCreatingGroup ? <CircularProgress size={16} color="inherit" /> : <GroupAddIcon />}
                        sx={{
                            borderRadius: 2,
                            textTransform: 'none',
                            bgcolor: 'primary.main',
                            '&:hover': { bgcolor: 'primary.dark' },
                            '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' }
                        }}
                    >
                        {isCreatingGroup ? t('common.loading') : t('groups.create_group')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Avatar Menu */}
            <Menu
                anchorEl={avatarMenuAnchor}
                open={Boolean(avatarMenuAnchor)}
                onClose={handleCloseAvatarMenu}
                PaperProps={{
                    sx: {
                        mt: 1,
                        borderRadius: 2,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                        minWidth: 200
                    }
                }}
            >
                <MenuItem onClick={handleViewAvatar} sx={{ gap: 1.5, py: 1 }}>
                    <VisibilityIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    <Typography fontSize={14}>{t('chat.view_avatar')}</Typography>
                </MenuItem>
                <MenuItem onClick={handleUploadAvatar} sx={{ gap: 1.5, py: 1 }}>
                    <PhotoCameraIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    <Typography fontSize={14}>{t('chat.upload_avatar')}</Typography>
                </MenuItem>
            </Menu>

            {/* Image Preview Dialog */}
            <Dialog
                open={!!imagePreview}
                onClose={() => setImagePreview(null)}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: {
                        bgcolor: 'rgba(0, 0, 0, 0.9)',
                        boxShadow: 'none',
                        borderRadius: 0
                    }
                }}
            >
                <DialogContent sx={{ p: 0, position: 'relative' }}>
                    <IconButton
                        onClick={() => setImagePreview(null)}
                        sx={{
                            position: 'absolute',
                            top: 16,
                            right: 16,
                            color: 'white',
                            bgcolor: 'rgba(0, 0, 0, 0.5)',
                            '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.7)' }
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                    <Box
                        component="img"
                        src={imagePreview || ''}
                        sx={{
                            width: '100%',
                            height: 'auto',
                            maxHeight: '80vh',
                            objectFit: 'contain'
                        }}
                    />
                </DialogContent>
            </Dialog>
        </Box>
    );
}
