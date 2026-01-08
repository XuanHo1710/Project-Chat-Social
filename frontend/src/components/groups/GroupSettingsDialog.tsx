'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Typography,
    Button,
    TextField,
    FormControl,
    FormControlLabel,
    RadioGroup,
    Radio,
    IconButton,
    Divider,
    CircularProgress,
} from '@mui/material';
import {
    Close as CloseIcon,
    Lock as LockIcon,
    Public as PublicIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { groupService } from '@/services/group.service';
import { Group, GroupPrivacy, GroupVisibility, UpdateGroupData } from '@/types/group';
import { toast } from 'sonner';

interface GroupSettingsDialogProps {
    open: boolean;
    onClose: () => void;
    group: Group;
    onGroupUpdated: (updatedGroup: Partial<Group>) => void;
}

export default function GroupSettingsDialog({
    open,
    onClose,
    group,
    onGroupUpdated,
}: GroupSettingsDialogProps) {
    const [name, setName] = useState(group.name);
    const [description, setDescription] = useState(group.description || '');
    const [privacy, setPrivacy] = useState<GroupPrivacy>(group.privacy);
    const [visibility, setVisibility] = useState<GroupVisibility>(group.visibility);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setName(group.name);
            setDescription(group.description || '');
            setPrivacy(group.privacy);
            setVisibility(group.visibility);
        }
    }, [open, group]);

    const handleSave = async () => {
        if (!name.trim()) {
            toast.error('Tên nhóm không được để trống');
            return;
        }

        setIsSaving(true);
        try {
            const updateData: UpdateGroupData = {
                name: name.trim(),
                description: description.trim(),
                privacy,
                visibility,
            };

            await groupService.updateGroup(group._id, updateData);
            onGroupUpdated(updateData);
            toast.success('Đã cập nhật cài đặt nhóm');
            onClose();
        } catch {
            const message = 'Không thể cập nhật cài đặt';
            toast.error(message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: { borderRadius: 2 }
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
                    Cài đặt nhóm
                </Typography>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
                {/* Group Name */}
                <Box sx={{ mb: 3 }}>
                    <Typography fontWeight={600} sx={{ mb: 1 }}>
                        Tên nhóm
                    </Typography>
                    <TextField
                        fullWidth
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nhập tên nhóm"
                        inputProps={{ maxLength: 100 }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                            }
                        }}
                    />
                </Box>

                {/* Description */}
                <Box sx={{ mb: 3 }}>
                    <Typography fontWeight={600} sx={{ mb: 1 }}>
                        Giới thiệu về nhóm
                    </Typography>
                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Mô tả về nhóm của bạn..."
                        inputProps={{ maxLength: 2000 }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                            }
                        }}
                    />
                    <Typography variant="caption" color="#65676b" sx={{ mt: 0.5, display: 'block' }}>
                        {description.length}/2000 ký tự
                    </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Privacy Settings */}
                <Box sx={{ mb: 3 }}>
                    <Typography fontWeight={600} sx={{ mb: 1 }}>
                        Quyền riêng tư
                    </Typography>
                    <FormControl component="fieldset">
                        <RadioGroup
                            value={privacy}
                            onChange={(e) => setPrivacy(e.target.value as GroupPrivacy)}
                        >
                            <FormControlLabel
                                value={GroupPrivacy.PUBLIC}
                                control={<Radio />}
                                label={
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                        <PublicIcon sx={{ color: '#65676b', mt: 0.5 }} />
                                        <Box>
                                            <Typography fontWeight={500}>Công khai</Typography>
                                            <Typography variant="body2" color="#65676b">
                                                Ai cũng có thể xem bài viết và tham gia nhóm
                                            </Typography>
                                        </Box>
                                    </Box>
                                }
                                sx={{ alignItems: 'flex-start', mb: 1 }}
                            />
                            <FormControlLabel
                                value={GroupPrivacy.PRIVATE}
                                control={<Radio />}
                                label={
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                        <LockIcon sx={{ color: '#65676b', mt: 0.5 }} />
                                        <Box>
                                            <Typography fontWeight={500}>Riêng tư</Typography>
                                            <Typography variant="body2" color="#65676b">
                                                Chỉ thành viên mới xem được bài viết. Cần được duyệt để tham gia.
                                            </Typography>
                                        </Box>
                                    </Box>
                                }
                                sx={{ alignItems: 'flex-start' }}
                            />
                        </RadioGroup>
                    </FormControl>
                </Box>

                {/* Visibility Settings */}
                <Box sx={{ mb: 2 }}>
                    <Typography fontWeight={600} sx={{ mb: 1 }}>
                        Hiển thị
                    </Typography>
                    <FormControl component="fieldset">
                        <RadioGroup
                            value={visibility}
                            onChange={(e) => setVisibility(e.target.value as GroupVisibility)}
                        >
                            <FormControlLabel
                                value={GroupVisibility.VISIBLE}
                                control={<Radio />}
                                label={
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                        <VisibilityIcon sx={{ color: '#65676b', mt: 0.5 }} />
                                        <Box>
                                            <Typography fontWeight={500}>Hiển thị</Typography>
                                            <Typography variant="body2" color="#65676b">
                                                Ai cũng có thể tìm thấy nhóm này
                                            </Typography>
                                        </Box>
                                    </Box>
                                }
                                sx={{ alignItems: 'flex-start', mb: 1 }}
                            />
                            <FormControlLabel
                                value={GroupVisibility.HIDDEN}
                                control={<Radio />}
                                label={
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                        <VisibilityOffIcon sx={{ color: '#65676b', mt: 0.5 }} />
                                        <Box>
                                            <Typography fontWeight={500}>Ẩn</Typography>
                                            <Typography variant="body2" color="#65676b">
                                                Chỉ thành viên mới có thể tìm thấy nhóm này
                                            </Typography>
                                        </Box>
                                    </Box>
                                }
                                sx={{ alignItems: 'flex-start' }}
                            />
                        </RadioGroup>
                    </FormControl>
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 2, borderTop: '1px solid #e4e6eb' }}>
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
                    onClick={handleSave}
                    disabled={isSaving || !name.trim()}
                    variant="contained"
                    sx={{
                        textTransform: 'none',
                        bgcolor: '#1877f2',
                        fontWeight: 600,
                        '&:hover': { bgcolor: '#166fe5' },
                    }}
                >
                    {isSaving ? <CircularProgress size={20} color="inherit" /> : 'Lưu thay đổi'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
