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
    useTheme,
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
import { useTranslation } from 'react-i18next';

interface EditProfileModalProps {
    open: boolean;
    onClose: () => void;
    profile: ProfileType;
    onUpdate: (profile: ProfileType) => void;
}

export default function EditProfileModal({ open, onClose, profile, onUpdate }: EditProfileModalProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const { t } = useTranslation();
    const inputBg = isDark ? 'rgba(255,255,255,0.1)' : '#f0f2f5';
    const hoverBg = isDark ? 'rgba(255,255,255,0.15)' : '#e4e6eb';
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
                toast.success(t('profile.upload_avatar_success'));
            }
        } catch (error) {
            console.error('Error uploading avatar:', error);
            toast.error(t('profile.upload_error'));
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
                toast.success(t('profile.upload_cover_success'));
            }
        } catch (error) {
            console.error('Error uploading cover:', error);
            toast.error(t('profile.upload_error'));
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
            toast.success(t('profile.update_success'));
            onClose();
        } catch (error) {
            console.error('Error updating profile:', error);
            toast.error(t('profile.update_error'));
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
                    bgcolor: 'background.paper',
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
                borderBottom: `1px solid ${theme.palette.divider}`,
                pb: 1
            }}>
                <Typography variant="h6" fontWeight={700} color="text.primary">
                    {t('profile.edit_profile')}
                </Typography>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 0 }}>
                {/* Profile Picture Section */}
                <Box sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography fontWeight={600} color="text.primary">
                            {t('profile.avatar')}
                        </Typography>
                        <Button
                            sx={{ textTransform: 'none', color: 'primary.main' }}
                            onClick={() => avatarInputRef.current?.click()}
                            disabled={uploadingAvatar}
                        >
                            {uploadingAvatar ? t('common.loading') : t('profile.choose_photo')}
                        </Button>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <Box sx={{ position: 'relative' }}>
                            <Avatar
                                src={formData.avatar}
                                sx={{
                                    width: 120,
                                    height: 120,
                                    bgcolor: hoverBg,
                                    color: 'text.secondary',
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
                                    bgcolor: hoverBg,
                                    border: `2px solid ${theme.palette.background.paper}`,
                                    '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.2)' : '#d8dadf' }
                                }}
                                onClick={() => avatarInputRef.current?.click()}
                                disabled={uploadingAvatar}
                            >
                                <PhotoCameraIcon sx={{ fontSize: 18, color: 'text.primary' }} />
                            </IconButton>
                        </Box>
                    </Box>
                </Box>

                <Divider />

                {/* Cover Photo Section */}
                <Box sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography fontWeight={600} color="text.primary">
                            {t('profile.cover_photo')}
                        </Typography>
                        <Button
                            sx={{ textTransform: 'none', color: 'primary.main' }}
                            onClick={() => coverInputRef.current?.click()}
                            disabled={uploadingCover}
                        >
                            {uploadingCover ? t('common.loading') : t('profile.choose_photo')}
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
                                <Typography fontSize={14}>{t('profile.tap_to_choose_cover')}</Typography>
                            </Box>
                        )}
                    </Box>
                </Box>

                <Divider />

                {/* Bio Section */}
                <Box sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography fontWeight={600} color="text.primary">
                            {t('profile.bio')}
                        </Typography>
                    </Box>
                    <TextField
                        placeholder={t('profile.bio_placeholder')}
                        value={formData.bio || ''}
                        onChange={(e) => handleChange('bio', e.target.value)}
                        multiline
                        rows={3}
                        fullWidth
                        inputProps={{ maxLength: 101 }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                bgcolor: inputBg,
                            },
                            '& .MuiOutlinedInput-input': {
                                color: 'text.primary',
                                textAlign: 'center'
                            }
                        }}
                    />
                    <Typography
                        fontSize={12}
                        color="text.secondary"
                        textAlign="right"
                        sx={{ mt: 0.5 }}
                    >
                        {(formData.bio?.length || 0)}/101
                    </Typography>
                </Box>

                <Divider />

                {/* Basic Info Section */}
                <Box sx={{ p: 2 }}>
                    <Typography fontWeight={600} color="text.primary" gutterBottom>
                        {t('profile.basic_info')}
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <TextField
                            label={t('auth.firstName')}
                            value={formData.firstName}
                            onChange={(e) => handleChange('firstName', e.target.value)}
                            fullWidth
                            size="small"
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    bgcolor: inputBg,
                                },
                                '& .MuiInputLabel-root': { color: 'text.secondary' },
                                '& .MuiOutlinedInput-input': { color: 'text.primary' }
                            }}
                        />
                        <TextField
                            label={t('auth.lastName')}
                            value={formData.lastName}
                            onChange={(e) => handleChange('lastName', e.target.value)}
                            fullWidth
                            size="small"
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    bgcolor: inputBg,
                                },
                                '& .MuiInputLabel-root': { color: 'text.secondary' },
                                '& .MuiOutlinedInput-input': { color: 'text.primary' }
                            }}
                        />
                    </Box>

                    <TextField
                        label={t('auth.email')}
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
                            '& .MuiInputLabel-root': { color: 'text.secondary' },
                            '& .MuiOutlinedInput-input': { color: 'text.primary' }
                        }}
                    />

                    <TextField
                        label={t('auth.phone')}
                        value={formData.phone}
                        onChange={(e) => handleChange('phone', e.target.value)}
                        fullWidth
                        size="small"
                        sx={{
                            mb: 2,
                            '& .MuiOutlinedInput-root': {
                                bgcolor: '#f0f2f5',
                            },
                            '& .MuiInputLabel-root': { color: 'text.secondary' },
                            '& .MuiOutlinedInput-input': { color: 'text.primary' }
                        }}
                    />

                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                        <InputLabel sx={{ color: 'text.secondary' }}>{t('auth.gender')}</InputLabel>
                        <Select
                            value={formData.gender}
                            label={t('auth.gender')}
                            onChange={(e) => handleChange('gender', e.target.value)}
                            sx={{
                                bgcolor: inputBg,
                                color: 'text.primary',
                                '& .MuiSelect-icon': { color: 'text.secondary' }
                            }}
                        >
                            <MenuItem value="MALE">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <MaleIcon sx={{ color: 'primary.main' }} /> {t('auth.male')}
                                </Box>
                            </MenuItem>
                            <MenuItem value="FEMALE">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <FemaleIcon sx={{ color: '#e91e8c' }} /> {t('auth.female')}
                                </Box>
                            </MenuItem>
                            <MenuItem value="OTHER">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <TransgenderIcon sx={{ color: 'text.secondary' }} /> {t('auth.other')}
                                </Box>
                            </MenuItem>
                        </Select>
                    </FormControl>

                    <TextField
                        label={t('auth.birthday')}
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
                                bgcolor: inputBg,
                            },
                            '& .MuiInputLabel-root': { color: 'text.secondary' },
                            '& .MuiOutlinedInput-input': { color: 'text.primary' }
                        }}
                    />
                </Box>

                <Divider />

                {/* Address Section */}
                <Box sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography fontWeight={600} color="text.primary">
                            {t('profile.address')}
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
                                        bgcolor: inputBg,
                                        borderRadius: 2,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <HomeIcon sx={{ color: 'text.secondary' }} />
                                        <Box>
                                            <Typography fontSize={14} color="text.primary">
                                                {addr.ward?.name}, {addr.district?.name}, {addr.province?.name}
                                            </Typography>
                                            {addr.detailAddress && (
                                                <Typography fontSize={12} color="text.secondary">
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
                                        sx={{ color: 'text.secondary' }}
                                    >
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            ))}
                        </Box>
                    ) : (
                        <Typography color="text.secondary" fontSize={14} sx={{ mb: 2 }}>
                            {t('profile.no_address')}
                        </Typography>
                    )}

                    {/* Add new address button */}
                    <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<AddIcon />}
                        sx={{
                            color: 'primary.main',
                            borderColor: 'primary.main',
                            textTransform: 'none',
                            '&:hover': {
                                borderColor: 'primary.dark',
                                bgcolor: isDark ? 'rgba(45, 136, 255, 0.1)' : '#e7f3ff'
                            }
                        }}
                        onClick={() => setAddressPickerOpen(true)}
                    >
                        {t('profile.add_address')}
                    </Button>
                </Box>

                <Divider />

                {/* Additional Info */}
                <Box sx={{ p: 2 }}>
                    <Typography fontWeight={600} color="text.primary" gutterBottom>
                        {t('profile.other_details')}
                    </Typography>
                    <Typography color="text.secondary" fontSize={13} sx={{ mb: 2 }}>
                        {t('profile.public_info_notice')}
                    </Typography>

                    <List disablePadding>
                        <ListItem
                            sx={{
                                bgcolor: inputBg,
                                borderRadius: 2,
                                mb: 1,
                                cursor: 'pointer',
                                '&:hover': { bgcolor: hoverBg }
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 40 }}>
                                <WorkIcon sx={{ color: 'text.secondary' }} />
                            </ListItemIcon>
                            <ListItemText
                                primary={<Typography color="primary.main" fontSize={14}>{t('profile.add_work')}</Typography>}
                            />
                        </ListItem>

                        <ListItem
                            sx={{
                                bgcolor: inputBg,
                                borderRadius: 2,
                                mb: 1,
                                cursor: 'pointer',
                                '&:hover': { bgcolor: hoverBg }
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 40 }}>
                                <SchoolIcon sx={{ color: 'text.secondary' }} />
                            </ListItemIcon>
                            <ListItemText
                                primary={<Typography color="primary.main" fontSize={14}>{t('profile.add_school')}</Typography>}
                            />
                        </ListItem>

                        <ListItem
                            sx={{
                                bgcolor: inputBg,
                                borderRadius: 2,
                                mb: 1,
                                cursor: 'pointer',
                                '&:hover': { bgcolor: hoverBg }
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 40 }}>
                                <HomeIcon sx={{ color: 'text.secondary' }} />
                            </ListItemIcon>
                            <ListItemText
                                primary={<Typography color="primary.main" fontSize={14}>{t('profile.add_address')}</Typography>}
                            />
                        </ListItem>
                    </List>
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                <Button
                    onClick={onClose}
                    sx={{
                        textTransform: 'none',
                        color: 'text.primary',
                        fontWeight: 600,
                        '&:hover': { bgcolor: hoverBg }
                    }}
                >
                    {t('common.cancel')}
                </Button>
                <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={loading}
                    sx={{
                        textTransform: 'none',
                        bgcolor: 'primary.main',
                        fontWeight: 600,
                        '&:hover': { bgcolor: 'primary.dark' },
                        '&:disabled': { bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb' }
                    }}
                >
                    {loading ? <CircularProgress size={20} color="inherit" /> : t('common.save')}
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
