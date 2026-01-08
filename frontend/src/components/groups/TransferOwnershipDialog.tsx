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
    ListItemAvatar,
    ListItemText,
    ListItemButton,
    IconButton,
    CircularProgress,
    Alert,
} from '@mui/material';
import {
    Search as SearchIcon,
    Close as CloseIcon,
    Check as CheckIcon,
} from '@mui/icons-material';
import { groupService } from '@/services/group.service';
import { GroupMember } from '@/types/group';
import { useAuthStore } from '@/stores/useAuthStore';
import { toast } from 'sonner';

interface TransferOwnershipDialogProps {
    open: boolean;
    onClose: () => void;
    groupId: string;
    groupName: string;
    onTransferred: () => void;
}

export default function TransferOwnershipDialog({
    open,
    onClose,
    groupId,
    groupName,
    onTransferred,
}: TransferOwnershipDialogProps) {
    const { user } = useAuthStore();
    const [members, setMembers] = useState<GroupMember[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);
    const [isTransferring, setIsTransferring] = useState(false);
    const [confirmStep, setConfirmStep] = useState(false);

    const loadMembers = async () => {
        setIsLoading(true);
        try {
            const response = await groupService.getMembers(groupId, 1, 100);
            if (response && response.members) {
                // Filter out current user
                const otherMembers = response.members.filter(m => m._id !== user?.id);
                setMembers(otherMembers);
            }
        } catch (error) {
            console.error('Failed to load members:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            loadMembers();
            setSelectedMember(null);
            setConfirmStep(false);
            setSearchQuery('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, groupId]);

    const handleSelectMember = (member: GroupMember) => {
        setSelectedMember(member);
    };

    const handleConfirm = () => {
        setConfirmStep(true);
    };

    const handleTransfer = async () => {
        if (!selectedMember) return;

        setIsTransferring(true);
        try {
            await groupService.transferOwnership(groupId, selectedMember._id);
            toast.success(`Đã chuyển quyền sở hữu nhóm cho ${selectedMember.firstName} ${selectedMember.lastName}`);
            onTransferred();
            onClose();
        } catch {
            const message = 'Không thể chuyển quyền sở hữu';
            toast.error(message);
        } finally {
            setIsTransferring(false);
        }
    };

    const filteredMembers = members.filter(member => {
        const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
        return fullName.includes(searchQuery.toLowerCase());
    });

    const handleBack = () => {
        setConfirmStep(false);
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
                borderBottom: '1px solid #e4e6eb',
                pb: 2
            }}>
                <Typography variant="h6" fontWeight={700}>
                    {confirmStep ? 'Xác nhận chuyển quyền' : 'Chuyển quyền sở hữu nhóm'}
                </Typography>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: confirmStep ? 3 : 0 }}>
                {confirmStep && selectedMember ? (
                    <Box>
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            <Typography fontWeight={600} sx={{ mb: 1 }}>
                                Bạn có chắc chắn muốn chuyển quyền sở hữu nhóm {groupName}?
                            </Typography>
                            <Typography variant="body2">
                                Hành động này sẽ chuyển tất cả quyền quản trị viên cao nhất cho{' '}
                                <strong>{selectedMember.firstName} {selectedMember.lastName}</strong>.
                                Bạn sẽ vẫn là quản trị viên của nhóm nhưng không còn là chủ sở hữu.
                            </Typography>
                        </Alert>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: '#f0f2f5', borderRadius: 2 }}>
                            <Avatar
                                src={selectedMember.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedMember.firstName + ' ' + selectedMember.lastName)}&background=1877f2&color=fff`}
                                sx={{ width: 56, height: 56 }}
                            />
                            <Box>
                                <Typography fontWeight={600}>
                                    {selectedMember.firstName} {selectedMember.lastName}
                                </Typography>
                                <Typography variant="body2" color="#65676b">
                                    @{selectedMember.username}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                ) : (
                    <>
                        {/* Search */}
                        <Box sx={{ p: 2, borderBottom: '1px solid #e4e6eb' }}>
                            <TextField
                                fullWidth
                                placeholder="Tìm thành viên..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon sx={{ color: '#65676b' }} />
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: 4,
                                        bgcolor: '#f0f2f5',
                                        '& fieldset': { border: 'none' }
                                    }
                                }}
                            />
                        </Box>

                        {/* Members List */}
                        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                            {isLoading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                    <CircularProgress />
                                </Box>
                            ) : filteredMembers.length === 0 ? (
                                <Typography color="#65676b" sx={{ textAlign: 'center', py: 4 }}>
                                    {members.length === 0 ? 'Không có thành viên nào khác trong nhóm' : 'Không tìm thấy thành viên'}
                                </Typography>
                            ) : (
                                <List>
                                    {filteredMembers.map((member) => (
                                        <ListItemButton
                                            key={member._id}
                                            onClick={() => handleSelectMember(member)}
                                            selected={selectedMember?._id === member._id}
                                            sx={{
                                                '&.Mui-selected': {
                                                    bgcolor: '#e7f3ff',
                                                    '&:hover': { bgcolor: '#d8e9ff' }
                                                },
                                                borderRadius: 1,
                                                mx: 1,
                                                my: 0.5,
                                            }}
                                        >
                                            <ListItemAvatar>
                                                <Avatar
                                                    src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.firstName + ' ' + member.lastName)}&background=1877f2&color=fff`}
                                                />
                                            </ListItemAvatar>
                                            <ListItemText
                                                primary={
                                                    <Typography fontWeight={500}>
                                                        {member.firstName} {member.lastName}
                                                    </Typography>
                                                }
                                                secondary={`@${member.username}`}
                                            />
                                            {selectedMember?._id === member._id && (
                                                <CheckIcon sx={{ color: '#1877f2' }} />
                                            )}
                                        </ListItemButton>
                                    ))}
                                </List>
                            )}
                        </Box>
                    </>
                )}
            </DialogContent>

            <DialogActions sx={{ p: 2, borderTop: '1px solid #e4e6eb' }}>
                {confirmStep ? (
                    <>
                        <Button
                            onClick={handleBack}
                            sx={{
                                textTransform: 'none',
                                color: '#65676b',
                                fontWeight: 600,
                            }}
                        >
                            Quay lại
                        </Button>
                        <Button
                            onClick={handleTransfer}
                            disabled={isTransferring}
                            variant="contained"
                            color="warning"
                            sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                            }}
                        >
                            {isTransferring ? <CircularProgress size={20} color="inherit" /> : 'Xác nhận chuyển quyền'}
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            onClick={onClose}
                            sx={{
                                textTransform: 'none',
                                color: '#65676b',
                                fontWeight: 600,
                            }}
                        >
                            Hủy
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={!selectedMember}
                            variant="contained"
                            sx={{
                                textTransform: 'none',
                                bgcolor: '#1877f2',
                                fontWeight: 600,
                                '&:hover': { bgcolor: '#166fe5' },
                            }}
                        >
                            Tiếp tục
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
}
