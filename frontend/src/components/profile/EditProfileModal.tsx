'use client';

import { useState, useEffect, useRef } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Avatar,
    Typography,
    Button,
    IconButton,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Divider,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    CircularProgress,
} from '@mui/material';
import {
    Close as CloseIcon,
    PhotoCamera as PhotoCameraIcon,
    School as SchoolIcon,
    Work as WorkIcon,
    Home as HomeIcon,
    Male as MaleIcon,
    Female as FemaleIcon,
    Transgender as TransgenderIcon,
    AddAPhoto as AddAPhotoIcon,
    Add as AddIcon,
} from '@mui/icons-material';
import { ProfileType, UpdateProfileType, AddressType } from '@/types/account';
import { accountService } from '@/services/account.service';
import { uploadChatMedia } from '@/services/cloudinary.service';
import { toast } from 'sonner';
import AddressPickerModal from '@/components/profile/AddressPickerModal';

interface EditProfileModalProps {
    open: boolean;
    onClose: () => void;
    profile: ProfileType;
    onUpdate: (profile: ProfileType) => void;
}

export default function EditProfileModal({ open, onClose, profile, onUpdate }: EditProfileModalProps) {
    const [loading, setLoading] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadingCover, setUploadingCover] = useState(false);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    // Address picker modal
    const [addressPickerOpen, setAddressPickerOpen] = useState(false);

    const [formData, setFormData] = useState<UpdateProfileType>({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        avatar: '',
        background: '',
        bio: '',
        gender: 'OTHER',
        birthday: '',
        addresses: [],
    });

    useEffect(() => {
        if (profile) {
            setFormData({
                firstName: profile.firstName || '',
                lastName: profile.lastName || '',
                email: profile.email || '',
                phone: profile.phone || '',
                avatar: profile.avatar || '',
                background: profile.background || '',
                bio: profile.bio || '',
                gender: profile.gender || 'OTHER',
                birthday: profile.birthday ? profile.birthday.split('T')[0] : '',
                addresses: profile.addresses || [],
            });
        }
    }, [profile]);

    const handleChange = (field: keyof UpdateProfileType, value: UpdateProfileType[keyof UpdateProfileType]) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleAvatarFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setUploadingAvatar(true);
            const result = await uploadChatMedia([file]);
            if (result.success && result.results.length > 0) {
                const avatarUrl = result.results[0].url;
                setFormData(prev => ({ ...prev, avatar: avatarUrl }));
                toast.success('Tải ảnh đại diện thành công!');
            }
        } catch (error) {
            console.error('Error uploading avatar:', error);
            toast.error('Lỗi khi tải ảnh lên');
        } finally {
            setUploadingAvatar(false);
            if (avatarInputRef.current) avatarInputRef.current.value = '';
        }
    };

    const handleCoverFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setUploadingCover(true);
            const result = await uploadChatMedia([file]);
            if (result.success && result.results.length > 0) {
                const backgroundUrl = result.results[0].url;
                setFormData(prev => ({ ...prev, background: backgroundUrl }));
                toast.success('Tải ảnh bìa thành công!');
            }
        } catch (error) {
            console.error('Error uploading cover:', error);
            toast.error('Lỗi khi tải ảnh lên');
        } finally {
            setUploadingCover(false);
            if (coverInputRef.current) coverInputRef.current.value = '';
        }
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            const updatedProfile = await accountService.updateProfile(formData);
            onUpdate(updatedProfile);
            toast.success('Cập nhật thông tin thành công!');
            onClose();
        } catch (error) {
            console.error('Error updating profile:', error);
            toast.error('Lỗi khi cập nhật thông tin');
        } finally {
            setLoading(false);
        }
    };

    const fullName = `${formData.firstName} ${formData.lastName}`.trim();

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    bgcolor: 'white',
                    borderRadius: 3,
                    maxHeight: '90vh'
                }
            }}
        >
            {/* Hidden file inputs */}
            <input
                type="file"
                ref={avatarInputRef}
                onChange={handleAvatarFileSelect}
                accept="image/*"
                style={{ display: 'none' }}
            />
            <input
                type="file"
                ref={coverInputRef}
                onChange={handleCoverFileSelect}
                accept="image/*"
                style={{ display: 'none' }}
            />

            <DialogTitle sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #e4e6eb',
                pb: 1
            }}>
                <Typography variant="h6" fontWeight={700} color="#050505">
                    Chỉnh sửa trang cá nhân
                </Typography>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 0 }}>
                {/* Profile Picture Section */}
                <Box sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography fontWeight={600} color="#050505">
                            Ảnh đại diện
                        </Typography>
                        <Button
                            sx={{ textTransform: 'none', color: '#1877f2' }}
                            onClick={() => avatarInputRef.current?.click()}
                            disabled={uploadingAvatar}
                        >
                            {uploadingAvatar ? 'Đang tải...' : 'Chọn ảnh'}
                        </Button>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <Box sx={{ position: 'relative' }}>
                            <Avatar
                                src={formData.avatar}
                                sx={{
                                    width: 120,
                                    height: 120,
                                    bgcolor: '#e4e6eb',
                                    color: '#65676b',
                                    fontSize: 48,
                                }}
                            >
                                {!formData.avatar && fullName.charAt(0)}
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
                                    <CircularProgress size={30} sx={{ color: 'white' }} />
                                </Box>
                            )}
                            <IconButton
                                sx={{
                                    position: 'absolute',
                                    bottom: 0,
                                    right: 0,
                                    bgcolor: '#e4e6eb',
                                    border: '2px solid white',
                                    '&:hover': { bgcolor: '#d8dadf' }
                                }}
                                onClick={() => avatarInputRef.current?.click()}
                                disabled={uploadingAvatar}
                            >
                                <PhotoCameraIcon sx={{ fontSize: 18, color: '#050505' }} />
                            </IconButton>
                        </Box>
                    </Box>
                </Box>

                <Divider />

                {/* Cover Photo Section */}
                <Box sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography fontWeight={600} color="#050505">
                            Ảnh bìa
                        </Typography>
                        <Button
                            sx={{ textTransform: 'none', color: '#1877f2' }}
                            onClick={() => coverInputRef.current?.click()}
                            disabled={uploadingCover}
                        >
                            {uploadingCover ? 'Đang tải...' : 'Chọn ảnh'}
                        </Button>
                    </Box>
                    <Box
                        sx={{
                            position: 'relative',
                            height: 120,
                            borderRadius: 2,
                            overflow: 'hidden',
                            background: formData.background
                                ? `url(${formData.background}) center/cover no-repeat`
                                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            '&:hover': {
                                '&::after': {
                                    content: '""',
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    bgcolor: 'rgba(0,0,0,0.3)',
                                }
                            }
                        }}
                        onClick={() => coverInputRef.current?.click()}
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
                                justifyContent: 'center',
                                zIndex: 1
                            }}>
                                <CircularProgress sx={{ color: 'white' }} />
                            </Box>
                        )}
                        {!formData.background && !uploadingCover && (
                            <Box sx={{ textAlign: 'center', color: 'white', zIndex: 1 }}>
                                <AddAPhotoIcon sx={{ fontSize: 32 }} />
                                <Typography fontSize={14}>Nhấn để chọn ảnh bìa</Typography>
                            </Box>
                        )}
                    </Box>
                </Box>

                <Divider />

                {/* Bio Section */}
                <Box sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography fontWeight={600} color="#050505">
                            Tiểu sử
                        </Typography>
                    </Box>
                    <TextField
                        placeholder="Mô tả bản thân..."
                        value={formData.bio || ''}
                        onChange={(e) => handleChange('bio', e.target.value)}
                        multiline
                        rows={3}
                        fullWidth
                        inputProps={{ maxLength: 101 }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                bgcolor: '#f0f2f5',
                            },
                            '& .MuiOutlinedInput-input': {
                                color: '#050505',
                                textAlign: 'center'
                            }
                        }}
                    />
                    <Typography
                        fontSize={12}
                        color="#65676b"
                        textAlign="right"
                        sx={{ mt: 0.5 }}
                    >
                        {(formData.bio?.length || 0)}/101
                    </Typography>
                </Box>

                <Divider />

                {/* Basic Info Section */}
                <Box sx={{ p: 2 }}>
                    <Typography fontWeight={600} color="#050505" gutterBottom>
                        Thông tin cơ bản
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <TextField
                            label="Họ"
                            value={formData.firstName}
                            onChange={(e) => handleChange('firstName', e.target.value)}
                            fullWidth
                            size="small"
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    bgcolor: '#f0f2f5',
                                },
                                '& .MuiInputLabel-root': { color: '#65676b' },
                                '& .MuiOutlinedInput-input': { color: '#050505' }
                            }}
                        />
                        <TextField
                            label="Tên"
                            value={formData.lastName}
                            onChange={(e) => handleChange('lastName', e.target.value)}
                            fullWidth
                            size="small"
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    bgcolor: '#f0f2f5',
                                },
                                '& .MuiInputLabel-root': { color: '#65676b' },
                                '& .MuiOutlinedInput-input': { color: '#050505' }
                            }}
                        />
                    </Box>

                    <TextField
                        label="Email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        fullWidth
                        size="small"
                        sx={{
                            mb: 2,
                            '& .MuiOutlinedInput-root': {
                                bgcolor: '#f0f2f5',
                            },
                            '& .MuiInputLabel-root': { color: '#65676b' },
                            '& .MuiOutlinedInput-input': { color: '#050505' }
                        }}
                    />

                    <TextField
                        label="Số điện thoại"
                        value={formData.phone}
                        onChange={(e) => handleChange('phone', e.target.value)}
                        fullWidth
                        size="small"
                        sx={{
                            mb: 2,
                            '& .MuiOutlinedInput-root': {
                                bgcolor: '#f0f2f5',
                            },
                            '& .MuiInputLabel-root': { color: '#65676b' },
                            '& .MuiOutlinedInput-input': { color: '#050505' }
                        }}
                    />

                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                        <InputLabel sx={{ color: '#65676b' }}>Giới tính</InputLabel>
                        <Select
                            value={formData.gender}
                            label="Giới tính"
                            onChange={(e) => handleChange('gender', e.target.value)}
                            sx={{
                                bgcolor: '#f0f2f5',
                                color: '#050505',
                                '& .MuiSelect-icon': { color: '#65676b' }
                            }}
                        >
                            <MenuItem value="MALE">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <MaleIcon sx={{ color: '#1877f2' }} /> Nam
                                </Box>
                            </MenuItem>
                            <MenuItem value="FEMALE">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <FemaleIcon sx={{ color: '#e91e8c' }} /> Nữ
                                </Box>
                            </MenuItem>
                            <MenuItem value="OTHER">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <TransgenderIcon sx={{ color: '#65676b' }} /> Khác
                                </Box>
                            </MenuItem>
                        </Select>
                    </FormControl>

                    <TextField
                        label="Ngày sinh"
                        type="date"
                        value={formData.birthday}
                        onChange={(e) => handleChange('birthday', e.target.value)}
                        fullWidth
                        size="small"
                        slotProps={{
                            inputLabel: { shrink: true }
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                bgcolor: '#f0f2f5',
                            },
                            '& .MuiInputLabel-root': { color: '#65676b' },
                            '& .MuiOutlinedInput-input': { color: '#050505' }
                        }}
                    />
                </Box>

                <Divider />

                {/* Address Section */}
                <Box sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography fontWeight={600} color="#050505">
                            Địa chỉ
                        </Typography>
                    </Box>

                    {/* Display existing addresses */}
                    {formData.addresses && formData.addresses.length > 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                            {formData.addresses.map((addr, idx) => (
                                <Box
                                    key={idx}
                                    sx={{
                                        p: 1.5,
                                        bgcolor: '#f0f2f5',
                                        borderRadius: 2,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <HomeIcon sx={{ color: '#65676b' }} />
                                        <Box>
                                            <Typography fontSize={14} color="#050505">
                                                {addr.ward?.name}, {addr.district?.name}, {addr.province?.name}
                                            </Typography>
                                            {addr.detailAddress && (
                                                <Typography fontSize={12} color="#65676b">
                                                    {addr.detailAddress}
                                                </Typography>
                                            )}
                                        </Box>
                                    </Box>
                                    <IconButton
                                        size="small"
                                        onClick={() => {
                                            const newAddresses = formData.addresses?.filter((_, i) => i !== idx) || [];
                                            handleChange('addresses', newAddresses);
                                        }}
                                        sx={{ color: '#65676b' }}
                                    >
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            ))}
                        </Box>
                    ) : (
                        <Typography color="#65676b" fontSize={14} sx={{ mb: 2 }}>
                            Chưa có địa chỉ nào
                        </Typography>
                    )}

                    {/* Add new address button */}
                    <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<AddIcon />}
                        sx={{
                            color: '#1877f2',
                            borderColor: '#1877f2',
                            textTransform: 'none',
                            '&:hover': {
                                borderColor: '#166fe5',
                                bgcolor: '#e7f3ff'
                            }
                        }}
                        onClick={() => setAddressPickerOpen(true)}
                    >
                        Thêm địa chỉ
                    </Button>
                </Box>

                <Divider />

                {/* Additional Info */}
                <Box sx={{ p: 2 }}>
                    <Typography fontWeight={600} color="#050505" gutterBottom>
                        Chi tiết khác
                    </Typography>
                    <Typography color="#65676b" fontSize={13} sx={{ mb: 2 }}>
                        Thông tin bạn chọn sẽ ở chế độ Công khai và hiển thị ở đầu trang cá nhân của bạn.
                    </Typography>

                    <List disablePadding>
                        <ListItem
                            sx={{
                                bgcolor: '#f0f2f5',
                                borderRadius: 2,
                                mb: 1,
                                cursor: 'pointer',
                                '&:hover': { bgcolor: '#e4e6eb' }
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 40 }}>
                                <WorkIcon sx={{ color: '#65676b' }} />
                            </ListItemIcon>
                            <ListItemText
                                primary={<Typography color="#1877f2" fontSize={14}>Thêm nơi làm việc</Typography>}
                            />
                        </ListItem>

                        <ListItem
                            sx={{
                                bgcolor: '#f0f2f5',
                                borderRadius: 2,
                                mb: 1,
                                cursor: 'pointer',
                                '&:hover': { bgcolor: '#e4e6eb' }
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 40 }}>
                                <SchoolIcon sx={{ color: '#65676b' }} />
                            </ListItemIcon>
                            <ListItemText
                                primary={<Typography color="#1877f2" fontSize={14}>Thêm trường học</Typography>}
                            />
                        </ListItem>

                        <ListItem
                            sx={{
                                bgcolor: '#f0f2f5',
                                borderRadius: 2,
                                mb: 1,
                                cursor: 'pointer',
                                '&:hover': { bgcolor: '#e4e6eb' }
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 40 }}>
                                <HomeIcon sx={{ color: '#65676b' }} />
                            </ListItemIcon>
                            <ListItemText
                                primary={<Typography color="#1877f2" fontSize={14}>Thêm địa chỉ</Typography>}
                            />
                        </ListItem>
                    </List>
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 2, borderTop: '1px solid #e4e6eb' }}>
                <Button
                    onClick={onClose}
                    sx={{
                        textTransform: 'none',
                        color: '#050505',
                        fontWeight: 600,
                        '&:hover': { bgcolor: '#f0f2f5' }
                    }}
                >
                    Hủy
                </Button>
                <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={loading}
                    sx={{
                        textTransform: 'none',
                        bgcolor: '#1877f2',
                        fontWeight: 600,
                        '&:hover': { bgcolor: '#166fe5' },
                        '&:disabled': { bgcolor: '#e4e6eb' }
                    }}
                >
                    {loading ? <CircularProgress size={20} color="inherit" /> : 'Lưu'}
                </Button>
            </DialogActions>

            {/* Address Picker Modal */}
            <AddressPickerModal
                open={addressPickerOpen}
                onClose={() => setAddressPickerOpen(false)}
                onSave={(newAddress: AddressType) => {
                    const newAddresses = [...(formData.addresses || []), newAddress];
                    handleChange('addresses', newAddresses);
                }}
            />
        </Dialog>
    );
}
