'use client';

import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Button,
    Stack,
    Card,
    CardContent,
    CardActions,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    useTheme,
    alpha,
    Chip,
    Tooltip,
    CircularProgress,
    Alert,
    Snackbar
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Palette as PaletteIcon,
    Check as CheckIcon,
    ColorLens as ColorLensIcon,
    DarkMode as DarkModeIcon,
    LightMode as LightModeIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { themeService, Theme } from '@/services/theme.service';
import { useThemeStore } from '@/stores/useThemeStore';

interface ThemeFormData {
    name: string;
    primaryColor: string;
    secondaryColor: string;
    bgDarkMode: string;
    bgLightMode: string;
}

export default function ThemesManagementPage() {
    const theme = useTheme();
    const { t } = useTranslation();
    const isDark = theme.palette.mode === 'dark';

    // State
    const [themes, setThemes] = useState<Theme[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [themeToDelete, setThemeToDelete] = useState<Theme | null>(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

    const [formData, setFormData] = useState<ThemeFormData>({
        name: '',
        primaryColor: '#1877f2',
        secondaryColor: '#42b72a',
        bgDarkMode: '#18191a',
        bgLightMode: '#f0f2f5'
    });

    const { setCustomTheme } = useThemeStore();


    // Fetch themes
    const fetchThemes = async () => {
        try {
            setLoading(true);
            const response = await themeService.getAllThemes();
            setThemes(response.data);
        } catch (err) {
            console.error('Failed to fetch themes:', err);
            setError('Failed to load themes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchThemes();
    }, []);

    const handleOpenDialog = (themeItem?: Theme) => {
        if (themeItem) {
            setEditingTheme(themeItem);
            setFormData({
                name: themeItem.name,
                primaryColor: themeItem.primaryColor,
                secondaryColor: themeItem.secondaryColor,
                bgDarkMode: themeItem.bgDarkMode,
                bgLightMode: themeItem.bgLightMode
            });
        } else {
            setEditingTheme(null);
            setFormData({
                name: '',
                primaryColor: '#1877f2',
                secondaryColor: '#42b72a',
                bgDarkMode: '#18191a',
                bgLightMode: '#f0f2f5'
            });
        }
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setEditingTheme(null);
    };

    const handleSave = async () => {
        try {
            if (editingTheme) {
                await themeService.updateTheme(editingTheme._id, formData);
                setSnackbar({ open: true, message: 'Theme updated successfully', severity: 'success' });
            } else {
                await themeService.createTheme(formData);
                setSnackbar({ open: true, message: 'Theme created successfully', severity: 'success' });
            }
            await fetchThemes();
            handleCloseDialog();
        } catch (err) {
            console.error('Failed to save theme:', err);
            setSnackbar({ open: true, message: 'Failed to save theme', severity: 'error' });
        }
    };

    const handleSetActive = async (themeItem: Theme, currentActive: boolean) => {
        if (currentActive) return;
        try {
            await themeService.setActiveTheme(themeItem._id);
            setSnackbar({ open: true, message: 'Theme applied successfully', severity: 'success' });
            await fetchThemes();
            setCustomTheme(themeItem);
        } catch (err) {
            console.error('Failed to set active theme:', err);
            setSnackbar({ open: true, message: 'Failed to apply theme', severity: 'error' });
        }
    };

    const handleDeleteClick = (themeItem: Theme) => {
        setThemeToDelete(themeItem);
        setDeleteConfirmOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (themeToDelete) {
            try {
                await themeService.deleteTheme(themeToDelete._id);
                setSnackbar({ open: true, message: 'Theme deleted successfully', severity: 'success' });
                await fetchThemes();
            } catch (err) {
                console.error('Failed to delete theme:', err);
                setSnackbar({ open: true, message: 'Failed to delete theme', severity: 'error' });
            }
        }
        setDeleteConfirmOpen(false);
        setThemeToDelete(null);
    };

    const handleCloseSnackbar = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
                <Box>
                    <Typography variant="h5" fontWeight="bold">{t('admin.themes_title')}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {t('admin.themes_subtitle')}
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog()}
                >
                    {t('admin.add_new_theme')}
                </Button>
            </Stack>

            {/* Theme Cards Grid */}
            <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
                gap: 3
            }}>
                {themes.map((themeItem) => (
                    <Card
                        key={themeItem._id}
                        sx={{
                            borderRadius: 3,
                            bgcolor: isDark ? '#242526' : '#ffffff',
                            border: themeItem.isActive
                                ? `2px solid ${themeItem.primaryColor}`
                                : `1px solid ${isDark ? '#3a3b3c' : '#e4e6eb'}`,
                            boxShadow: themeItem.isActive
                                ? `0 4px 20px ${alpha(themeItem.primaryColor, 0.3)}`
                                : 'none',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                                transform: 'translateY(-4px)',
                                boxShadow: `0 8px 30px ${alpha(themeItem.primaryColor, 0.25)}`
                            }
                        }}
                    >
                        {/* Theme Preview */}
                        <Box sx={{
                            height: 120,
                            background: `linear-gradient(135deg, ${themeItem.bgDarkMode} 50%, ${themeItem.bgLightMode} 50%)`,
                            position: 'relative',
                            borderRadius: '12px 12px 0 0'
                        }}>
                            {/* Color dots preview */}
                            <Box sx={{
                                position: 'absolute',
                                bottom: 12,
                                left: 12,
                                display: 'flex',
                                gap: 1
                            }}>
                                <Tooltip title="Primary Color">
                                    <Box sx={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '50%',
                                        bgcolor: themeItem.primaryColor,
                                        border: '3px solid white',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                                    }} />
                                </Tooltip>
                                <Tooltip title="Secondary Color">
                                    <Box sx={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '50%',
                                        bgcolor: themeItem.secondaryColor,
                                        border: '3px solid white',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                                    }} />
                                </Tooltip>
                            </Box>

                            {/* Active badge */}
                            {themeItem.isActive && (
                                <Chip
                                    icon={<CheckIcon sx={{ fontSize: 16 }} />}
                                    label={t('admin.active')}
                                    size="small"
                                    sx={{
                                        position: 'absolute',
                                        top: 12,
                                        right: 12,
                                        bgcolor: themeItem.primaryColor,
                                        color: 'white',
                                        fontWeight: 600
                                    }}
                                />
                            )}
                        </Box>

                        <CardContent>
                            <Typography variant="h6" fontWeight="700" gutterBottom>
                                {themeItem.name}
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.5}>
                                <Chip
                                    icon={<DarkModeIcon sx={{ fontSize: 14 }} />}
                                    label={themeItem.bgDarkMode}
                                    size="small"
                                    sx={{ fontSize: '0.7rem' }}
                                />
                                <Chip
                                    icon={<LightModeIcon sx={{ fontSize: 14 }} />}
                                    label={themeItem.bgLightMode}
                                    size="small"
                                    sx={{ fontSize: '0.7rem' }}
                                />
                            </Stack>
                        </CardContent>

                        <CardActions sx={{ px: 2, pb: 2, justifyContent: 'space-between' }}>
                            {!themeItem.isActive ? (
                                <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<PaletteIcon />}
                                    onClick={() => handleSetActive(themeItem, themeItem.isActive)}
                                    sx={{ borderColor: themeItem.primaryColor, color: themeItem.primaryColor }}
                                >
                                    {t('admin.apply')}
                                </Button>
                            ) : (
                                <Chip label={`✓ ${t('admin.active')}`} color="success" size="small" />
                            )}

                            <Stack direction="row" spacing={0.5}>
                                <Tooltip title={t('admin.edit_theme')}>
                                    <IconButton
                                        size="small"
                                        onClick={() => handleOpenDialog(themeItem)}
                                    >
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete">
                                    <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => handleDeleteClick(themeItem)}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                        </CardActions>
                    </Card>
                ))}
            </Box>

            {/* Add/Edit Dialog */}
            <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>
                    <Stack direction="row" alignItems="center" gap={1}>
                        <ColorLensIcon color="primary" />
                        {editingTheme ? t('admin.edit_theme') : t('admin.create_theme')}
                    </Stack>
                </DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={3} sx={{ py: 1 }}>
                        <TextField
                            fullWidth
                            label={t('admin.theme_name')}
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />

                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block', mb: 1 }}>
                                    {t('admin.primary_color')}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <input
                                        type="color"
                                        value={formData.primaryColor}
                                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                                        style={{ width: 50, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer' }}
                                    />
                                    <TextField
                                        size="small"
                                        value={formData.primaryColor}
                                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                                        sx={{ flex: 1 }}
                                    />
                                </Box>
                            </Box>

                            <Box sx={{ flex: 1 }}>
                                <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block', mb: 1 }}>
                                    {t('admin.secondary_color')}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <input
                                        type="color"
                                        value={formData.secondaryColor}
                                        onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                                        style={{ width: 50, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer' }}
                                    />
                                    <TextField
                                        size="small"
                                        value={formData.secondaryColor}
                                        onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                                        sx={{ flex: 1 }}
                                    />
                                </Box>
                            </Box>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block', mb: 1 }}>
                                    {t('admin.bg_dark')}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <input
                                        type="color"
                                        value={formData.bgDarkMode}
                                        onChange={(e) => setFormData({ ...formData, bgDarkMode: e.target.value })}
                                        style={{ width: 50, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer' }}
                                    />
                                    <TextField
                                        size="small"
                                        value={formData.bgDarkMode}
                                        onChange={(e) => setFormData({ ...formData, bgDarkMode: e.target.value })}
                                        sx={{ flex: 1 }}
                                    />
                                </Box>
                            </Box>

                            <Box sx={{ flex: 1 }}>
                                <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block', mb: 1 }}>
                                    {t('admin.bg_light')}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <input
                                        type="color"
                                        value={formData.bgLightMode}
                                        onChange={(e) => setFormData({ ...formData, bgLightMode: e.target.value })}
                                        style={{ width: 50, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer' }}
                                    />
                                    <TextField
                                        size="small"
                                        value={formData.bgLightMode}
                                        onChange={(e) => setFormData({ ...formData, bgLightMode: e.target.value })}
                                        sx={{ flex: 1 }}
                                    />
                                </Box>
                            </Box>
                        </Box>

                        {/* Preview */}
                        <Box>
                            <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block', mb: 1 }}>
                                {t('admin.preview')}
                            </Typography>
                            <Box sx={{
                                height: 80,
                                borderRadius: 2,
                                background: `linear-gradient(135deg, ${formData.bgDarkMode} 50%, ${formData.bgLightMode} 50%)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 2
                            }}>
                                <Box sx={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: '50%',
                                    bgcolor: formData.primaryColor,
                                    border: '3px solid white'
                                }} />
                                <Box sx={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: '50%',
                                    bgcolor: formData.secondaryColor,
                                    border: '3px solid white'
                                }} />
                            </Box>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={handleCloseDialog}>{t('common.cancel')}</Button>
                    <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={!formData.name}
                    >
                        {editingTheme ? t('admin.update_theme') : t('admin.create_theme')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
                <DialogTitle>{t('admin.confirm_delete_title')}</DialogTitle>
                <DialogContent>
                    <Typography>
                        {t('admin.confirm_delete_theme', { name: themeToDelete?.name })}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirmOpen(false)}>{t('common.cancel')}</Button>
                    <Button color="error" variant="contained" onClick={handleConfirmDelete}>
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}
