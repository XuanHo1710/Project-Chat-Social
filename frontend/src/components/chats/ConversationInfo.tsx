'use client';

import React, { useState } from 'react';
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
    Palette as PaletteIcon,
    EmojiEmotions as EmojiEmotionsIcon,
    Photo as PhotoIcon,
    InsertDriveFile as FileIcon,
    Lock as LockIcon,
} from '@mui/icons-material';
import { useConversationDetail } from '@/queries/useConversationQueries';
import { useSocket } from '@/contexts/SocketContext';
import { useAccountsByPage } from '@/queries/useAccountQueries';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

// Quick action buttons data
const QUICK_ACTIONS = [
    { icon: PersonIcon, label: 'Trang cá nhân' },
    { icon: NotificationsIcon, label: 'Tắt thông báo' },
    { icon: SearchIcon, label: 'Tìm kiếm' },
];

// Theme colors for chat background
const THEME_COLORS = [
    '#0084ff', '#44bec7', '#ffc300', '#fa3c4c', '#d696bb',
    '#6699cc', '#13cf13', '#ff7e29', '#e68585', '#7646ff'
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
    const [selectedMember, setSelectedMember] = useState<any>(null);

    const [themeDialogOpen, setThemeDialogOpen] = useState(false);
    const [reactionDialogOpen, setReactionDialogOpen] = useState(false);

    const conversation = conversationData?.data;

    const { data: searchResults, isLoading: isSearching } = useAccountsByPage(userId, { search: searchQuery });

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

    const handleMemberMenuOpen = (event: React.MouseEvent<HTMLElement>, member: any) => {
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
                                <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: conversation.theme || '#0084ff', mr: 2 }} />
                                <ListItemText primary={<Typography fontSize={14} color="#050505">Đổi chủ đề</Typography>} />
                            </ListItemButton>
                            <ListItemButton sx={{ borderRadius: 2, py: 1 }} onClick={() => setReactionDialogOpen(true)}>
                                <Typography fontSize={24} sx={{ mr: 2 }}>{conversation.quickReaction || '👍'}</Typography>
                                <ListItemText primary={<Typography fontSize={14} color="#050505">Thay đổi biểu tượng cảm xúc</Typography>} />
                            </ListItemButton>
                            <ListItemButton sx={{ borderRadius: 2, py: 1 }}>
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
                            <ListItemButton sx={{ borderRadius: 2, py: 1 }}>
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
                                {conversation.participants.map((member: any) => (
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
                        {THEME_COLORS.map(color => (
                            <Box
                                key={color}
                                onClick={() => handleThemeChange(color)}
                                sx={{
                                    width: 40, height: 40, borderRadius: '50%',
                                    bgcolor: color, cursor: 'pointer',
                                    border: conversation.theme === color ? '3px solid #050505' : 'none',
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
                            searchResults?.items.map((account: any) => {
                                const isAlreadyMember = conversation.participants.some(p => p.user._id === account._id);
                                return (
                                    <ListItem key={account._id}>
                                        <ListItemAvatar><Avatar src={account.avatar} /></ListItemAvatar>
                                        <ListItemText primary={`${account.firstName} ${account.lastName}`} secondary={account.username} />
                                        <ListItemSecondaryAction>
                                            <Button size="small" variant="contained" disabled={isAlreadyMember} onClick={() => handleAddMember(account._id)}>
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
        </Box>
    );
}
