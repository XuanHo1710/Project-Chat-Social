'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Typography,
    Avatar,
    Button,
    TextField,
    InputAdornment,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    ListItemSecondaryAction,
    IconButton,
    Chip,
    CircularProgress,
    Menu,
    MenuItem,
    ListItemIcon,
    Divider,
    useTheme,
} from '@mui/material';
import {
    Search as SearchIcon,
    Close as CloseIcon,
    MoreVert as MoreVertIcon,
    PersonRemove as PersonRemoveIcon,
    Shield as ShieldIcon,
    AdminPanelSettings as AdminIcon,
} from '@mui/icons-material';
import { groupService } from '@/services/group.service';
import { GroupMember, GroupRole } from '@/types/group';
import { useAuthStore } from '@/stores/useAuthStore';
import { toast } from 'sonner';


interface GroupMembersDialogProps {
    open: boolean;
    onClose: () => void;
    groupId: string;
    groupName: string;
    currentUserRole?: GroupRole | null;
    isCreator: boolean;
}

export default function GroupMembersDialog({
    open,
    onClose,
    groupId,
    groupName,
    currentUserRole,
    isCreator
}: GroupMembersDialogProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const hoverBg = isDark ? 'rgba(255,255,255,0.1)' : '#f0f2f5';
    const inputBg = isDark ? 'rgba(255,255,255,0.1)' : '#f0f2f5';
    const { user } = useAuthStore();
    const [members, setMembers] = useState<GroupMember[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);
    const [isRemoving, setIsRemoving] = useState(false);

    const isAdmin = currentUserRole === GroupRole.ADMIN;
    const isModerator = currentUserRole === GroupRole.MODERATOR;

    useEffect(() => {
        if (open) {
            loadMembers();
        }
    }, [open, groupId]);

    const loadMembers = async () => {
        setIsLoading(true);
        try {
            const response = await groupService.getMembers(groupId, 1, 100);
            if (response && response.members) {
                setMembers(response.members || []);
            }
        } catch (error) {
            console.error('Failed to load members:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, member: GroupMember) => {
        event.stopPropagation();
        setMenuAnchor(event.currentTarget);
        setSelectedMember(member);
    };

    const handleCloseMenu = () => {
        setMenuAnchor(null);
        setSelectedMember(null);
    };

    const handleRemoveMember = async () => {
        if (!selectedMember) return;
        setIsRemoving(true);
        try {
            await groupService.removeMember(groupId, selectedMember._id);
            setMembers(prev => prev.filter(m => m._id !== selectedMember._id));
            toast.success(`Đã xóa ${selectedMember.firstName} ${selectedMember.lastName} khỏi nhóm`);
            handleCloseMenu();
        } catch (error: any) {
            const message = error?.response?.data?.message || 'Không thể xóa thành viên';
            toast.error(message);
        } finally {
            setIsRemoving(false);
        }
    };

    const handleUpdateRole = async (role: GroupRole) => {
        if (!selectedMember) return;
        try {
            await groupService.updateMemberRole(groupId, selectedMember._id, role);
            setMembers(prev => prev.map(m =>
                m._id === selectedMember._id ? { ...m, role } : m
            ));
            toast.success(`Đã cập nhật vai trò của ${selectedMember.firstName} ${selectedMember.lastName}`);
            handleCloseMenu();
        } catch (error: any) {
            const message = error?.response?.data?.message || 'Không thể cập nhật vai trò';
            toast.error(message);
        }
    };

    const filteredMembers = members.filter(member => {
        const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
        return fullName.includes(searchQuery.toLowerCase());
    });

    const getRoleChip = (role: GroupRole) => {
        switch (role) {
            case GroupRole.ADMIN:
                return <Chip label="Quản trị viên" size="small" sx={{ bgcolor: '#1877f2', color: 'white', fontSize: 11 }} />;
            case GroupRole.MODERATOR:
                return <Chip label="Người kiểm duyệt" size="small" sx={{ bgcolor: '#42b72a', color: 'white', fontSize: 11 }} />;
            default:
                return null;
        }
    };

    const canManageMember = (member: GroupMember) => {
        // Can't manage yourself
        if (member._id === user?.id) return false;
        // Only admins can manage others
        if (!isAdmin) return false;
        // Only creator can manage other admins
        if (member.role === GroupRole.ADMIN && !isCreator) return false;
        return true;
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: { borderRadius: 2, maxHeight: '80vh' }
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: `1px solid ${theme.palette.divider}`,
                pb: 2
            }}>
                <Typography variant="h6" fontWeight={700}>
                    Thành viên ({members.length})
                </Typography>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 0 }}>
                {/* Search */}
                <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
                    <TextField
                        fullWidth
                        placeholder="Tìm thành viên..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon sx={{ color: 'text.secondary' }} />
                                </InputAdornment>
                            ),
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 4,
                                bgcolor: inputBg,
                                '& fieldset': { border: 'none' }
                            }
                        }}
                    />
                </Box>

                {/* Members List */}
                <Box sx={{ maxHeight: 400, overflow: 'hidden' }}>
                    {isLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : filteredMembers.length === 0 ? (
                        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                            Không tìm thấy thành viên
                        </Typography>
                    ) : (
                        <List>
                            {filteredMembers.map((member) => (
                                <ListItem
                                    key={member._id}
                                    sx={{
                                        '&:hover': { bgcolor: hoverBg },
                                        borderRadius: 1,
                                        mx: 1
                                    }}
                                >
                                    <ListItemAvatar>
                                        <Avatar
                                            src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.firstName + ' ' + member.lastName)}&background=1877f2&color=fff`}
                                        />
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography fontWeight={500}>
                                                    {member.firstName} {member.lastName}
                                                </Typography>
                                                {getRoleChip(member.role)}
                                                {member._id === user?.id && (
                                                    <Typography variant="caption" color="text.secondary">(Bạn)</Typography>
                                                )}
                                            </Box>
                                        }
                                        secondary={`@${member.username}`}
                                    />
                                    {canManageMember(member) && (
                                        <ListItemSecondaryAction>
                                            <IconButton
                                                onClick={(e) => handleOpenMenu(e, member)}
                                                size="small"
                                            >
                                                <MoreVertIcon />
                                            </IconButton>
                                        </ListItemSecondaryAction>
                                    )}
                                </ListItem>
                            ))}
                        </List>
                    )}
                </Box>
            </DialogContent>

            {/* Member Action Menu */}
            <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={handleCloseMenu}
                PaperProps={{
                    sx: { minWidth: 200, borderRadius: 2 }
                }}
            >
                {selectedMember && (
                    <>
                        <Typography sx={{ px: 2, py: 1, fontWeight: 600, color: 'text.primary' }}>
                            {selectedMember.firstName} {selectedMember.lastName}
                        </Typography>
                        <Divider />

                        {isCreator && selectedMember.role !== GroupRole.ADMIN && (
                            <MenuItem onClick={() => handleUpdateRole(GroupRole.ADMIN)}>
                                <ListItemIcon><AdminIcon sx={{ color: '#1877f2' }} /></ListItemIcon>
                                <ListItemText>Thăng lên quản trị viên</ListItemText>
                            </MenuItem>
                        )}

                        {selectedMember.role !== GroupRole.MODERATOR && selectedMember.role !== GroupRole.ADMIN && (
                            <MenuItem onClick={() => handleUpdateRole(GroupRole.MODERATOR)}>
                                <ListItemIcon><ShieldIcon sx={{ color: '#42b72a' }} /></ListItemIcon>
                                <ListItemText>Thăng lên người kiểm duyệt</ListItemText>
                            </MenuItem>
                        )}

                        {(selectedMember.role === GroupRole.MODERATOR || selectedMember.role === GroupRole.ADMIN) &&
                            (isCreator || selectedMember.role !== GroupRole.ADMIN) && (
                                <MenuItem onClick={() => handleUpdateRole(GroupRole.MEMBER)}>
                                    <ListItemIcon><ShieldIcon sx={{ color: 'text.secondary' }} /></ListItemIcon>
                                    <ListItemText>Hạ xuống thành viên</ListItemText>
                                </MenuItem>
                            )}

                        <Divider />

                        <MenuItem
                            onClick={handleRemoveMember}
                            disabled={isRemoving}
                            sx={{ color: '#fa3e3e' }}
                        >
                            <ListItemIcon>
                                <PersonRemoveIcon sx={{ color: '#fa3e3e' }} />
                            </ListItemIcon>
                            <ListItemText>
                                {isRemoving ? 'Đang xóa...' : 'Xóa khỏi nhóm'}
                            </ListItemText>
                        </MenuItem>
                    </>
                )}
            </Menu>
        </Dialog>
    );
}
