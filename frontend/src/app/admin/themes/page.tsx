'use client';

import React, { useState } from 'react';
import {
    Box,
    Paper,
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
    Grid,
    Chip,
    Tooltip,
    Switch,
    FormControlLabel
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

// Mock themes data
const mockThemes = [
    {
        id: 1,
        name: 'Facebook Classic',
        primaryColor: '#1877f2',
        secondaryColor: '#42b72a',
        bgDark: '#18191a',
        bgLight: '#f0f2f5',
        isActive: true,
        isDefault: true
    },
    {
        id: 2,
        name: 'Ocean Blue',
        primaryColor: '#0077b6',
        secondaryColor: '#00b4d8',
        bgDark: '#1a1d29',
        bgLight: '#e8f4f8',
        isActive: false,
        isDefault: false
    },
    {
        id: 3,
        name: 'Purple Galaxy',
        primaryColor: '#7c3aed',
        secondaryColor: '#a855f7',
        bgDark: '#1e1b2e',
        bgLight: '#f3e8ff',
        isActive: false,
        isDefault: false
    },
    {
        id: 4,
        name: 'Forest Green',
        primaryColor: '#059669',
        secondaryColor: '#10b981',
        bgDark: '#1a2e1a',
        bgLight: '#ecfdf5',
        isActive: false,
        isDefault: false
    },
    {
        id: 5,
        name: 'Sunset Orange',
        primaryColor: '#ea580c',
        secondaryColor: '#f97316',
        bgDark: '#2e1a1a',
        bgLight: '#fff7ed',
        isActive: false,
        isDefault: false
    },
];

interface ThemeFormData {
    name: string;
    primaryColor: string;
    secondaryColor: string;
    bgDark: string;
    bgLight: string;
}

export default function ThemesManagementPage() {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [themes, setThemes] = useState(mockThemes);
    const [openDialog, setOpenDialog] = useState(false);
    const [editingTheme, setEditingTheme] = useState<any>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [themeToDelete, setThemeToDelete] = useState<any>(null);
    const [formData, setFormData] = useState<ThemeFormData>({
        name: '',
        primaryColor: '#1877f2',
        secondaryColor: '#42b72a',
        bgDark: '#18191a',
        bgLight: '#f0f2f5'
    });

    const handleOpenDialog = (themeItem?: any) => {
        if (themeItem) {
            setEditingTheme(themeItem);
            setFormData({
                name: themeItem.name,
                primaryColor: themeItem.primaryColor,
                secondaryColor: themeItem.secondaryColor,
                bgDark: themeItem.bgDark,
                bgLight: themeItem.bgLight
            });
        } else {
            setEditingTheme(null);
            setFormData({
                name: '',
                primaryColor: '#1877f2',
                secondaryColor: '#42b72a',
                bgDark: '#18191a',
                bgLight: '#f0f2f5'
            });
        }
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setEditingTheme(null);
    };

    const handleSave = () => {
        if (editingTheme) {
            setThemes(themes.map(t => t.id === editingTheme.id ? { ...t, ...formData } : t));
        } else {
            const newTheme = {
                id: Date.now(),
                ...formData,
                isActive: false,
                isDefault: false
            };
            setThemes([...themes, newTheme]);
        }
        handleCloseDialog();
    };

    const handleSetActive = (id: number) => {
        setThemes(themes.map(t => ({ ...t, isActive: t.id === id })));
    };

    const handleDeleteClick = (themeItem: any) => {
        setThemeToDelete(themeItem);
        setDeleteConfirmOpen(true);
    };

    const handleConfirmDelete = () => {
        if (themeToDelete) {
            setThemes(themes.filter(t => t.id !== themeToDelete.id));
        }
        setDeleteConfirmOpen(false);
        setThemeToDelete(null);
    };

    return (
        <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
                <Box>
                    <Typography variant="h5" fontWeight="bold">Quản lý Giao diện</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Tùy chỉnh màu sắc và theme cho ứng dụng
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog()}
                >
                    Thêm Theme mới
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
                        key={themeItem.id}
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
                            background: `linear-gradient(135deg, ${themeItem.bgDark} 50%, ${themeItem.bgLight} 50%)`,
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
                                    label="Đang sử dụng"
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

                            {/* Default badge */}
                            {themeItem.isDefault && (
                                <Chip
                                    label="Mặc định"
                                    size="small"
                                    sx={{
                                        position: 'absolute',
                                        top: 12,
                                        left: 12,
                                        bgcolor: 'rgba(255,255,255,0.9)',
                                        color: themeItem.primaryColor,
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
                                    label={themeItem.bgDark}
                                    size="small"
                                    sx={{ fontSize: '0.7rem' }}
                                />
                                <Chip
                                    icon={<LightModeIcon sx={{ fontSize: 14 }} />}
                                    label={themeItem.bgLight}
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
                                    onClick={() => handleSetActive(themeItem.id)}
                                    sx={{ borderColor: themeItem.primaryColor, color: themeItem.primaryColor }}
                                >
                                    Áp dụng
                                </Button>
                            ) : (
                                <Chip label="✓ Đang dùng" color="success" size="small" />
                            )}

                            <Stack direction="row" spacing={0.5}>
                                <Tooltip title="Chỉnh sửa">
                                    <IconButton
                                        size="small"
                                        onClick={() => handleOpenDialog(themeItem)}
                                    >
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                {!themeItem.isDefault && (
                                    <Tooltip title="Xóa">
                                        <IconButton
                                            size="small"
                                            color="error"
                                            onClick={() => handleDeleteClick(themeItem)}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                )}
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
                        {editingTheme ? 'Chỉnh sửa Theme' : 'Thêm Theme mới'}
                    </Stack>
                </DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={3} sx={{ py: 1 }}>
                        <TextField
                            fullWidth
                            label="Tên Theme"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />

                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block', mb: 1 }}>
                                    Màu chính (Primary)
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
                                    Màu phụ (Secondary)
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
                                    Nền Dark Mode
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <input
                                        type="color"
                                        value={formData.bgDark}
                                        onChange={(e) => setFormData({ ...formData, bgDark: e.target.value })}
                                        style={{ width: 50, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer' }}
                                    />
                                    <TextField
                                        size="small"
                                        value={formData.bgDark}
                                        onChange={(e) => setFormData({ ...formData, bgDark: e.target.value })}
                                        sx={{ flex: 1 }}
                                    />
                                </Box>
                            </Box>

                            <Box sx={{ flex: 1 }}>
                                <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block', mb: 1 }}>
                                    Nền Light Mode
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <input
                                        type="color"
                                        value={formData.bgLight}
                                        onChange={(e) => setFormData({ ...formData, bgLight: e.target.value })}
                                        style={{ width: 50, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer' }}
                                    />
                                    <TextField
                                        size="small"
                                        value={formData.bgLight}
                                        onChange={(e) => setFormData({ ...formData, bgLight: e.target.value })}
                                        sx={{ flex: 1 }}
                                    />
                                </Box>
                            </Box>
                        </Box>

                        {/* Preview */}
                        <Box>
                            <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block', mb: 1 }}>
                                Xem trước
                            </Typography>
                            <Box sx={{
                                height: 80,
                                borderRadius: 2,
                                background: `linear-gradient(135deg, ${formData.bgDark} 50%, ${formData.bgLight} 50%)`,
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
                    <Button onClick={handleCloseDialog}>Hủy</Button>
                    <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={!formData.name}
                    >
                        {editingTheme ? 'Cập nhật' : 'Tạo Theme'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
                <DialogTitle>Xác nhận xóa</DialogTitle>
                <DialogContent>
                    <Typography>
                        Bạn có chắc chắn muốn xóa theme <strong>{themeToDelete?.name}</strong>?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirmOpen(false)}>Hủy</Button>
                    <Button color="error" variant="contained" onClick={handleConfirmDelete}>
                        Xóa
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
