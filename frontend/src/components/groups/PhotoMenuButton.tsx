'use client';

import { useState, useRef } from 'react';
import {
    Box,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    CircularProgress,
} from '@mui/material';
import {
    Visibility as ViewIcon,
    FileUpload as UploadIcon,
} from '@mui/icons-material';
import { uploadChatMedia } from '@/services/cloudinary.service';
import { toast } from 'sonner';

interface PhotoMenuButtonProps {
    type: 'avatar' | 'cover';
    currentImage?: string | null;
    onImageUpdated: (url: string) => Promise<void>;
    onViewImage?: () => void;
    children: React.ReactNode;
    disabled?: boolean;
}

export default function PhotoMenuButton({
    type,
    currentImage,
    onImageUpdated,
    onViewImage,
    children,
    disabled = false,
}: PhotoMenuButtonProps) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        if (disabled) return;
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleViewImage = () => {
        handleClose();
        if (onViewImage && currentImage) {
            onViewImage();
        }
    };

    const handleUploadClick = () => {
        handleClose();
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error('Vui lòng chọn file ảnh');
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            toast.error('Kích thước ảnh không được vượt quá 10MB');
            return;
        }

        setIsUploading(true);
        try {
            const result = await uploadChatMedia([file]);
            if (result.success && result.results.length > 0) {
                const newUrl = result.results[0].url;
                await onImageUpdated(newUrl);
                toast.success(type === 'avatar' ? 'Cập nhật ảnh đại diện thành công!' : 'Cập nhật ảnh bìa thành công!');
            } else {
                toast.error('Lỗi khi tải ảnh lên');
            }
        } catch (error) {
            console.error('Failed to upload image:', error);
            toast.error('Lỗi khi cập nhật ảnh');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <>
            <Box
                onClick={handleClick}
                sx={{
                    cursor: disabled ? 'default' : 'pointer',
                    position: 'relative',
                }}
            >
                {children}
                {isUploading && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'rgba(0,0,0,0.5)',
                            borderRadius: type === 'avatar' ? '50%' : 2,
                        }}
                    >
                        <CircularProgress size={24} sx={{ color: 'white' }} />
                    </Box>
                )}
            </Box>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                PaperProps={{
                    sx: {
                        minWidth: 200,
                        borderRadius: 2,
                        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                        mt: 1,
                    }
                }}
            >
                {currentImage && onViewImage && (
                    <MenuItem onClick={handleViewImage}>
                        <ListItemIcon>
                            <ViewIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>
                            {type === 'avatar' ? 'Xem ảnh đại diện' : 'Xem ảnh bìa'}
                        </ListItemText>
                    </MenuItem>
                )}
                <MenuItem onClick={handleUploadClick}>
                    <ListItemIcon>
                        <UploadIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>
                        {type === 'avatar' ? 'Tải lên ảnh đại diện' : 'Tải lên ảnh bìa'}
                    </ListItemText>
                </MenuItem>
            </Menu>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />
        </>
    );
}
