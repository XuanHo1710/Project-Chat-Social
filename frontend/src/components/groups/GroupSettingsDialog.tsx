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
    useTheme,
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
import { useTranslation } from 'react-i18next';

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
    const theme = useTheme();
    const { t } = useTranslation();
    const isDark = theme.palette.mode === 'dark';
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
            toast.error(t('group_settings.name_required'));
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
            toast.success(t('group_settings.updated_success'));
            onClose();
        } catch {
            toast.error(t('group_settings.update_error'));
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
                borderBottom: `1px solid ${theme.palette.divider}`,
                pb: 2
            }}>
                <Typography variant="h6" fontWeight={700}>
                    {t('group_settings.title')}
                </Typography>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
                {/* Group Name */}
                <Box sx={{ mb: 3 }}>
                    <Typography fontWeight={600} sx={{ mb: 1 }}>
                        {t('group_settings.group_name_label')}
                    </Typography>
                    <TextField
                        fullWidth
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t('group_settings.group_name_placeholder')}
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
                        {t('group_settings.group_description_label')}
                    </Typography>
                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={t('group_settings.group_description_placeholder')}
                        inputProps={{ maxLength: 2000 }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                            }
                        }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {t('group_settings.character_count', { count: description.length })}
                    </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Privacy Settings */}
                <Box sx={{ mb: 3 }}>
                    <Typography fontWeight={600} sx={{ mb: 1 }}>
                        {t('group_settings.privacy_label')}
                    </Typography>
                    <FormControl component="fieldset">
                        <RadioGroup
                            value={privacy}
                            onChange={(e) => setPrivacy(e.target.value as GroupPrivacy)}
                        >
                            <FormControlLabel
                                value={"PUBLIC"}
                                control={<Radio />}
                                label={
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                        <PublicIcon sx={{ color: 'text.secondary', mt: 0.5 }} />
                                        <Box>
                                            <Typography fontWeight={500}>{t('group_settings.public')}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {t('group_settings.public_description')}
                                            </Typography>
                                        </Box>
                                    </Box>
                                }
                                sx={{ alignItems: 'flex-start', mb: 1 }}
                            />
                            <FormControlLabel
                                value={"PRIVATE"}
                                control={<Radio />}
                                label={
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                        <LockIcon sx={{ color: 'text.secondary', mt: 0.5 }} />
                                        <Box>
                                            <Typography fontWeight={500}>{t('group_settings.private')}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {t('group_settings.private_description')}
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
                        {t('group_settings.visibility_label')}
                    </Typography>
                    <FormControl component="fieldset">
                        <RadioGroup
                            value={visibility}
                            onChange={(e) => setVisibility(e.target.value as GroupVisibility)}
                        >
                            <FormControlLabel
                                value={"VISIBLE"}
                                control={<Radio />}
                                label={
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                        <VisibilityIcon sx={{ color: 'text.secondary', mt: 0.5 }} />
                                        <Box>
                                            <Typography fontWeight={500}>{t('group_settings.visible')}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {t('group_settings.visible_description')}
                                            </Typography>
                                        </Box>
                                    </Box>
                                }
                                sx={{ alignItems: 'flex-start', mb: 1 }}
                            />
                            <FormControlLabel
                                value={"HIDDEN"}
                                control={<Radio />}
                                label={
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                        <VisibilityOffIcon sx={{ color: 'text.secondary', mt: 0.5 }} />
                                        <Box>
                                            <Typography fontWeight={500}>{t('group_settings.hidden')}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {t('group_settings.hidden_description')}
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

            <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                <Button
                    onClick={onClose}
                    sx={{
                        textTransform: 'none',
                        color: 'text.secondary',
                        fontWeight: 600,
                    }}
                >
                    {t('common.cancel')}
                </Button>
                <Button
                    onClick={handleSave}
                    disabled={isSaving || !name.trim()}
                    variant="contained"
                    sx={{
                        textTransform: 'none',
                        bgcolor: 'primary.main',
                        fontWeight: 600,
                        '&:hover': { bgcolor: 'primary.dark' },
                    }}
                >
                    {isSaving ? <CircularProgress size={20} color="inherit" /> : t('group_settings.save_button')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
