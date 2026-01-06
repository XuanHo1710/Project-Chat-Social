'use client';

import React, { useState, useCallback } from 'react';
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
    Search as SearchIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    Photo as PhotoIcon,
    InsertDriveFile as FileIcon,
    Lock as LockIcon,
    ArrowBack as ArrowBackIcon,
    PlayCircle as PlayCircleIcon,
} from '@mui/icons-material';
import { useConversationDetail } from '@/queries/useConversationQueries';
import { useSocket } from '@/contexts/SocketContext';
import { useAccountsByPage } from '@/queries/useAccountQueries';
import { chatService } from '@/services/chat.service';
import { MessageResponse } from '@/types/chat';
import { ConversationParticipant } from '@/types/conversation';
import { AccountCardFriendType } from '@/types/account';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

// Quick action buttons data
const QUICK_ACTIONS = [
    { icon: PersonIcon, label: 'Trang cá nhân' },
    { icon: NotificationsIcon, label: 'Tắt thông báo' },
    { icon: SearchIcon, label: 'Tìm kiếm' },
];

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
    const { data: conversationData, isLoading } = useConversationDetail(conversationId);
    const { socketChat } = useSocket();

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

    // Media Gallery State
    const [mediaGalleryOpen, setMediaGalleryOpen] = useState(false);
    const [mediaTab, setMediaTab] = useState(0);
    const [mediaMessages, setMediaMessages] = useState<MessageResponse[]>([]);
    const [mediaPage, setMediaPage] = useState(1);
    const [mediaHasMore, setMediaHasMore] = useState(true);
    const [mediaLoading, setMediaLoading] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const conversation = conversationData?.data;
    const themeColor = conversation?.theme || '#0084ff';

    const { data: searchResults, isLoading: isSearching } = useAccountsByPage(userId, { search: searchQuery });

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

    // Open media gallery
    const handleOpenMediaGallery = () => {
        setMediaGalleryOpen(true);
        setMediaMessages([]);
        setMediaPage(1);
        setMediaHasMore(true);
        loadMediaMessages(1, true);
    };

    // Handle scroll to load more
    const handleMediaScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.target as HTMLDivElement;
        if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
            if (mediaHasMore && !mediaLoading) {
                loadMediaMessages(mediaPage + 1);
            }
        }
    };

    // Get all media URLs from messages
    const allMediaUrls = mediaMessages.flatMap(msg => {
        const urls: { url: string; type: 'image' | 'video'; date: string }[] = [];
        if (msg.attachments) {
            msg.attachments.forEach(url => {
                const isVideo = url.url.match(/\.(mp4|webm|ogg)$/i) || url.url.includes('video');
                urls.push({ url: url.url, type: isVideo ? 'video' : 'image', date: msg.createdAt });
            });
        }
        return urls;
    });

    // Group media by month
    const groupedMedia = allMediaUrls.reduce((acc, media) => {
        const date = new Date(media.date);
        const monthYear = `Tháng ${date.getMonth() + 1} năm ${date.getFullYear()}`;
        if (!acc[monthYear]) acc[monthYear] = [];
        acc[monthYear].push(media);
        return acc;
    }, {} as Record<string, typeof allMediaUrls>);

    if (isLoading || !conversation) return null;

    const isGroup = conversation.type === 'GROUP';
    const isAdmin = conversation.participants.find(p => p.user._id === userId)?.isAdmin;
    const otherUser = conversation.participants.find(p => p.user._id !== userId)?.user;

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

    const handleAddMember = (targetUserId: string) => {
        if (socketChat) {
            socketChat.emit('conversation:member:add', { conversationId, targetUserId });
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
        if (socketChat && selectedMember) {
            socketChat.emit('conversation:admin', {
                conversationId,
                targetUserId: selectedMember.user._id,
                isAdmin: !selectedMember.isAdmin
            });
        }
        handleMemberMenuClose();
    };

    const handleLeaveGroup = () => {
        if (socketChat && window.confirm('Bạn có chắc muốn rời nhóm?')) {
            socketChat.emit('conversation:leave', { conversationId });
            onClose();
        }
    };

    const handleAvatarClick = () => {
        if (isGroup && isAdmin) {
            const url = window.prompt('Nhập link avatar mới cho nhóm:');
            if (url && socketChat) {
                socketChat.emit('conversation:avatar', { conversationId, avatar: url });
            }
        }
    };

    const displayName = isGroup
        ? conversation.name
        : `${otherUser?.firstName || ''} ${otherUser?.lastName || ''}`;

    return (
        <Box sx={{
            width: 360,
            height: '100%',
            borderLeft: '1px solid #e4e6eb',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'white',
        }}>
            {/* Header */}
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}>
                <Typography variant="h6" fontWeight={700} color="#050505">Chi tiết</Typography>
                <IconButton onClick={onClose} size="small" sx={{ bgcolor: '#f0f2f5', '&:hover': { bgcolor: '#e4e6eb' } }}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Box>

            <Box sx={{ flex: 1, overflowY: 'auto' }}>
                {/* Profile Section */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3, px: 2 }}>
                    <Box sx={{ position: 'relative', cursor: (isGroup && isAdmin) ? 'pointer' : 'default', mb: 1 }} onClick={handleAvatarClick}>
                        <Avatar
                            src={isGroup ? conversation.avatar : otherUser?.avatar}
                            sx={{ width: 80, height: 80 }}
                        />
                        {isGroup && isAdmin && (
                            <IconButton
                                size="small"
                                sx={{ position: 'absolute', bottom: 0, right: -5, bgcolor: '#f0f2f5', '&:hover': { bgcolor: '#e4e6eb' } }}
                            >
                                <PhotoCameraIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="h6" fontWeight={700} color="#050505" textAlign="center">
                            {displayName}
                        </Typography>
                        {isGroup && isAdmin && (
                            <IconButton size="small" onClick={() => { setNewName(conversation.name || ''); setEditNameDialogOpen(true); }}>
                                <EditIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        )}
                    </Box>

                    {/* Encryption Badge */}
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        bgcolor: '#f0f2f5',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 3,
                        mt: 1
                    }}>
                        <LockIcon sx={{ fontSize: 14, color: '#65676b' }} />
                        <Typography fontSize={12} color="#65676b">Được mã hóa đầu cuối</Typography>
                    </Box>

                    {/* Quick Actions */}
                    <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
                        {QUICK_ACTIONS.map((action, index) => (
                            <Box key={index} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                                <IconButton sx={{ bgcolor: '#f0f2f5', '&:hover': { bgcolor: '#e4e6eb' } }}>
                                    <action.icon sx={{ color: '#050505' }} />
                                </IconButton>
                                <Typography fontSize={12} color="#050505" sx={{ mt: 0.5, maxWidth: 60, textAlign: 'center' }}>
                                    {action.label}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                </Box>

                {/* Customize Section */}
                <Box sx={{ px: 1 }}>
                    <ListItemButton onClick={() => setCustomizeOpen(!customizeOpen)} sx={{ borderRadius: 2 }}>
                        <ListItemText
                            primary={<Typography fontWeight={600} color="#050505">Tùy chỉnh đoạn chat</Typography>}
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
                                <ListItemText primary={<Typography fontSize={14} color="#050505">Đổi chủ đề</Typography>} />
                            </ListItemButton>
                            <ListItemButton sx={{ borderRadius: 2, py: 1 }} onClick={() => setReactionDialogOpen(true)}>
                                <Typography fontSize={24} sx={{ mr: 2 }}>{conversation.quickReaction || '👍'}</Typography>
                                <ListItemText primary={<Typography fontSize={14} color="#050505">Thay đổi biểu tượng cảm xúc</Typography>} />
                            </ListItemButton>
                            <ListItemButton sx={{ borderRadius: 2, py: 1 }} onClick={() => setNicknameListDialogOpen(true)}>
                                <Box sx={{ width: 32, display: 'flex', justifyContent: 'center', mr: 2 }}>
                                    <Typography fontSize={16} fontWeight={700} color="#050505">Aa</Typography>
                                </Box>
                                <ListItemText primary={<Typography fontSize={14} color="#050505">Chỉnh sửa biệt danh</Typography>} />
                            </ListItemButton>
                        </List>
                    </Collapse>
                </Box>

                <Divider sx={{ my: 1 }} />

                {/* Media Section */}
                <Box sx={{ px: 1 }}>
                    <ListItemButton onClick={() => setMediaOpen(!mediaOpen)} sx={{ borderRadius: 2 }}>
                        <ListItemText
                            primary={<Typography fontWeight={600} color="#050505">File phương tiện & file</Typography>}
                        />
                        {mediaOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </ListItemButton>
                    <Collapse in={mediaOpen}>
                        <List disablePadding sx={{ pl: 1 }}>
                            <ListItemButton sx={{ borderRadius: 2, py: 1 }} onClick={handleOpenMediaGallery}>
                                <PhotoIcon sx={{ mr: 2, color: '#65676b' }} />
                                <ListItemText primary={<Typography fontSize={14} color="#050505">File phương tiện</Typography>} />
                            </ListItemButton>
                            <ListItemButton sx={{ borderRadius: 2, py: 1 }}>
                                <FileIcon sx={{ mr: 2, color: '#65676b' }} />
                                <ListItemText primary={<Typography fontSize={14} color="#050505">File</Typography>} />
                            </ListItemButton>
                        </List>
                    </Collapse>
                </Box>

                <Divider sx={{ my: 1 }} />

                {/* Members Section */}
                {isGroup && (
                    <Box sx={{ px: 1 }}>
                        <ListItemButton onClick={() => setMembersOpen(!membersOpen)} sx={{ borderRadius: 2 }}>
                            <ListItemText
                                primary={<Typography fontWeight={600} color="#050505">Thành viên ({conversation.participants.length})</Typography>}
                            />
                            {isAdmin && (
                                <IconButton size="small" onClick={(e) => { e.stopPropagation(); setAddMemberDialogOpen(true); }}>
                                    <PersonAddIcon fontSize="small" />
                                </IconButton>
                            )}
                            {membersOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </ListItemButton>
                        <Collapse in={membersOpen}>
                            <List disablePadding>
                                {conversation.participants.map((member) => (
                                    <ListItem key={member.user._id} sx={{ px: 2 }}>
                                        <ListItemAvatar>
                                            <Avatar src={member.user.avatar} sx={{ width: 36, height: 36 }} />
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={member.nickname || `${member.user.firstName} ${member.user.lastName}`}
                                            secondary={member.isAdmin ? 'Quản trị viên' : ''}
                                            primaryTypographyProps={{ fontSize: 14, fontWeight: 500, color: '#050505' }}
                                            secondaryTypographyProps={{ fontSize: 12, color: '#65676b' }}
                                        />
                                        {(isAdmin || member.user._id === userId) && (
                                            <ListItemSecondaryAction>
                                                <IconButton size="small" onClick={(e) => handleMemberMenuOpen(e, member)}>
                                                    <MoreVertIcon fontSize="small" />
                                                </IconButton>
                                            </ListItemSecondaryAction>
                                        )}
                                    </ListItem>
                                ))}
                            </List>
                        </Collapse>

                        <Button
                            fullWidth
                            startIcon={<ExitToAppIcon />}
                            color="error"
                            sx={{ mt: 2, mx: 1, justifyContent: 'flex-start', textTransform: 'none' }}
                            onClick={handleLeaveGroup}
                        >
                            Rời khỏi nhóm
                        </Button>
                    </Box>
                )}
            </Box>

            {/* Theme Dialog */}
            <Dialog open={themeDialogOpen} onClose={() => setThemeDialogOpen(false)} PaperProps={{ sx: { bgcolor: 'white', borderRadius: 3 } }}>
                <DialogTitle sx={{ color: '#050505' }}>Đổi chủ đề</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, py: 1 }}>
                        {THEME_COLORS.map(theme => (
                            <Box
                                key={theme.color}
                                onClick={() => handleThemeChange(theme.color)}
                                sx={{
                                    width: 40, height: 40, borderRadius: '50%',
                                    background: theme.gradient, cursor: 'pointer',
                                    border: conversation.theme === theme.color ? '3px solid #050505' : 'none',
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
                        theme="light"
                        locale="vi"
                        previewPosition="none"
                        skinTonePosition="none"
                        perLine={8}
                        maxFrequentRows={2}
                    />
                </Box>
            </Dialog>

            {/* Edit Name Dialog */}
            <Dialog open={editNameDialogOpen} onClose={() => setEditNameDialogOpen(false)} PaperProps={{ sx: { bgcolor: 'white', borderRadius: 3 } }}>
                <DialogTitle sx={{ color: '#050505' }}>Đổi tên nhóm</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus margin="dense" label="Tên nhóm" fullWidth variant="outlined"
                        value={newName} onChange={(e) => setNewName(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditNameDialogOpen(false)}>Hủy</Button>
                    <Button onClick={handleUpdateName} variant="contained" disabled={!newName.trim()}>Lưu</Button>
                </DialogActions>
            </Dialog>

            {/* Nickname List Dialog */}
            <Dialog
                open={nicknameListDialogOpen}
                onClose={() => setNicknameListDialogOpen(false)}
                fullWidth
                maxWidth="xs"
                PaperProps={{ sx: { bgcolor: 'white', borderRadius: 3 } }}
            >
                <DialogTitle sx={{ color: '#050505', display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
                    <IconButton onClick={() => setNicknameListDialogOpen(false)} size="small">
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h6" fontWeight={600}>Biệt danh</Typography>
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
                                        '&:hover': { bgcolor: '#f0f2f5' },
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
                                            <Typography fontWeight={500} color="#050505">
                                                {participant.nickname || fullName}
                                                {isCurrentUser && ' (Bạn)'}
                                            </Typography>
                                        }
                                        secondary={
                                            participant.nickname ? (
                                                <Typography fontSize={13} color="#65676b">
                                                    {fullName}
                                                </Typography>
                                            ) : (
                                                <Typography fontSize={13} color="#65676b">
                                                    Đặt biệt danh
                                                </Typography>
                                            )
                                        }
                                    />
                                    <EditIcon sx={{ color: '#65676b', fontSize: 20 }} />
                                </ListItem>
                            );
                        })}
                    </List>
                </DialogContent>
            </Dialog>

            {/* Edit Nickname Dialog */}
            <Dialog open={editNicknameDialogOpen} onClose={() => setEditNicknameDialogOpen(false)} PaperProps={{ sx: { bgcolor: 'white', borderRadius: 3 } }}>
                <DialogTitle sx={{ color: '#050505' }}>Đặt biệt danh</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 1, color: '#65676b' }}>
                        Đặt biệt danh cho {selectedMember?.user.firstName} {selectedMember?.user.lastName}
                    </Typography>
                    <TextField
                        autoFocus margin="dense" label="Biệt danh" fullWidth variant="outlined"
                        value={newNickname} onChange={(e) => setNewNickname(e.target.value)} placeholder="Để trống để gỡ biệt danh"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditNicknameDialogOpen(false)}>Hủy</Button>
                    <Button onClick={handleUpdateNickname} variant="contained">Lưu</Button>
                </DialogActions>
            </Dialog>

            {/* Add Member Dialog */}
            <Dialog open={addMemberDialogOpen} onClose={() => setAddMemberDialogOpen(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { bgcolor: 'white', borderRadius: 3 } }}>
                <DialogTitle sx={{ color: '#050505' }}>Thêm thành viên</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus margin="dense" label="Tìm kiếm người dùng" fullWidth variant="outlined"
                        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <List sx={{ mt: 2, maxHeight: 300, overflowY: 'auto' }}>
                        {isSearching ? <CircularProgress size={24} sx={{ display: 'block', m: 'auto' }} /> :
                            searchResults?.items.map((account: AccountCardFriendType) => {
                                const isAlreadyMember = conversation.participants.some(p => p.user._id === account.id);
                                return (
                                    <ListItem key={account.id}>
                                        <ListItemAvatar><Avatar src={account.avatar} /></ListItemAvatar>
                                        <ListItemText primary={account.name} secondary={account.name} />
                                        <ListItemSecondaryAction>
                                            <Button size="small" variant="contained" disabled={isAlreadyMember} onClick={() => handleAddMember(account.id)}>
                                                {isAlreadyMember ? 'Đã tham gia' : 'Thêm'}
                                            </Button>
                                        </ListItemSecondaryAction>
                                    </ListItem>
                                );
                            })
                        }
                    </List>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddMemberDialogOpen(false)}>Đóng</Button>
                </DialogActions>
            </Dialog>

            {/* Member Action Menu */}
            <Menu
                anchorEl={memberMenuAnchor}
                open={Boolean(memberMenuAnchor)}
                onClose={handleMemberMenuClose}
                slotProps={{ paper: { sx: { bgcolor: 'white', borderRadius: 2, boxShadow: '0 2px 12px rgba(0,0,0,0.15)' } } }}
            >
                <MenuItem onClick={() => { setEditNicknameDialogOpen(true); setNewNickname(selectedMember?.nickname || ''); }}>
                    <EditIcon fontSize="small" sx={{ mr: 1, color: '#65676b' }} />
                    <Typography color="#050505">Đặt biệt danh</Typography>
                </MenuItem>
                {isAdmin && selectedMember?.user._id !== userId && (
                    <MenuItem onClick={handlePromoteAdmin}>
                        <SecurityIcon fontSize="small" sx={{ mr: 1, color: '#65676b' }} />
                        <Typography color="#050505">{selectedMember?.isAdmin ? 'Gỡ quyền quản trị' : 'Chỉ định làm quản trị viên'}</Typography>
                    </MenuItem>
                )}
                {isAdmin && selectedMember?.user._id !== userId && (
                    <MenuItem onClick={handleKickMember}>
                        <ExitToAppIcon fontSize="small" sx={{ mr: 1, color: '#e74c3c' }} />
                        <Typography color="#e74c3c">Xóa khỏi nhóm</Typography>
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
                        bgcolor: 'white',
                        borderRadius: 3,
                        height: '80vh',
                        maxHeight: '600px'
                    }
                }}
            >
                <DialogTitle sx={{
                    color: '#050505',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    borderBottom: '1px solid #e4e6eb',
                    pb: 1
                }}>
                    <IconButton onClick={() => setMediaGalleryOpen(false)} size="small">
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h6" fontWeight={600}>File phương tiện và file</Typography>
                </DialogTitle>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs
                        value={mediaTab}
                        onChange={(_, v) => setMediaTab(v)}
                        sx={{
                            '& .MuiTab-root': {
                                textTransform: 'none',
                                fontWeight: 600,
                                color: '#65676b',
                                '&.Mui-selected': { color: themeColor }
                            },
                            '& .MuiTabs-indicator': { backgroundColor: themeColor }
                        }}
                    >
                        <Tab label="File phương tiện" />
                        <Tab label="File" />
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
                                    Chưa có file phương tiện nào
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
                            <Typography color="text.secondary" textAlign="center" py={4}>
                                Chưa có file nào
                            </Typography>
                        </Box>
                    )}
                </DialogContent>
            </Dialog>

            {/* Image Preview Dialog */}
            <Dialog
                open={!!imagePreview}
                onClose={() => setImagePreview(null)}
                maxWidth="lg"
                PaperProps={{
                    sx: {
                        bgcolor: 'transparent',
                        boxShadow: 'none',
                        maxWidth: '90vw',
                        maxHeight: '90vh'
                    }
                }}
            >
                <IconButton
                    onClick={() => setImagePreview(null)}
                    sx={{
                        position: 'absolute',
                        top: -40,
                        right: 0,
                        color: 'white',
                        bgcolor: 'rgba(0,0,0,0.5)',
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
                    }}
                >
                    <CloseIcon />
                </IconButton>
                {imagePreview && (
                    imagePreview.includes('.mp4') || imagePreview.includes('.webm') || imagePreview.includes('.mov') ? (
                        <video
                            src={imagePreview}
                            controls
                            autoPlay
                            style={{ maxWidth: '90vw', maxHeight: '85vh' }}
                        />
                    ) : (
                        <Box
                            component="img"
                            src={imagePreview}
                            alt=""
                            sx={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain' }}
                        />
                    )
                )}
            </Dialog>
        </Box>
    );
}
