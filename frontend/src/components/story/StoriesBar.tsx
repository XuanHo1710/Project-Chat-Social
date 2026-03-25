'use client';

import React, { useState, useRef } from 'react';
import {
    Box,
    Avatar,
    Typography,
    IconButton,
    Dialog,
    DialogContent,
    TextField,
    Button,
    CircularProgress,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    SelectChangeEvent,
    useTheme,
} from '@mui/material';
import {
    Add as AddIcon,
    Close as CloseIcon,
    Image as ImageIcon,
    Videocam as VideocamIcon,
    Public as PublicIcon,
    People as PeopleIcon,
    Lock as LockIcon,
} from '@mui/icons-material';
import { useStoriesFeed, useCreateStory } from '@/queries/useStoryQueries';
import { uploadChatMedia } from '@/services/cloudinary.service';
import StoryViewer from '@/components/story/StoryViewer';
import DraggableCaption from '@/components/story/DraggableCaption';
import { UserLoginType } from '@/types/account';
import { StoryPrivacy, CaptionStyle } from '@/types/story';
import { useTranslation } from 'react-i18next';

const DEFAULT_CAPTION_STYLE: CaptionStyle = {
    x: 50,
    y: 80,
    fontSize: 18,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.5)',
};

export default function StoriesBar({ currentUser }: { currentUser: UserLoginType }) {
    const { data: storyGroups, isLoading } = useStoriesFeed();
    const createStoryMutation = useCreateStory();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const { t } = useTranslation();

    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [caption, setCaption] = useState('');
    const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(DEFAULT_CAPTION_STYLE);
    const [privacy, setPrivacy] = useState<StoryPrivacy>('FRIENDS');
    const [isUploading, setIsUploading] = useState(false);
    const [videoDuration, setVideoDuration] = useState(0);
    const [videoError, setVideoError] = useState('');

    const [viewerOpen, setViewerOpen] = useState(false);
    const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);

    const previewContainerRef = useRef<HTMLDivElement>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check if video
        if (file.type.startsWith('video/')) {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                window.URL.revokeObjectURL(video.src);
                if (video.duration > 15) {
                    setVideoError(t('story.video_too_long'));
                    setSelectedFile(null);
                    setPreviewUrl(null);
                } else {
                    setVideoError('');
                    setVideoDuration(video.duration);
                    setSelectedFile(file);
                    setPreviewUrl(URL.createObjectURL(file));
                }
            };
            video.src = URL.createObjectURL(file);
        } else {
            setVideoError('');
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }

        e.target.value = '';
    };

    const handleCreateStory = async () => {
        if (!selectedFile) return;

        setIsUploading(true);
        try {
            const uploadResult = await uploadChatMedia([selectedFile]);
            if (!uploadResult.success || uploadResult.results.length === 0) {
                throw new Error('Upload failed');
            }

            const mediaUrl = uploadResult.results[0].url;
            const isVideo = selectedFile.type.startsWith('video/');

            await createStoryMutation.mutateAsync({
                type: isVideo ? 'VIDEO' : 'IMAGE',
                mediaUrl,
                duration: isVideo ? videoDuration : undefined,
                caption: caption || undefined,
                captionStyle: caption ? captionStyle : undefined,
                privacy,
            });

            handleCloseDialog();
        } catch (error) {
            console.error('Failed to create story:', error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleCloseDialog = () => {
        setCreateDialogOpen(false);
        setSelectedFile(null);
        setPreviewUrl(null);
        setCaption('');
        setCaptionStyle(DEFAULT_CAPTION_STYLE);
        setPrivacy('FRIENDS');
        setVideoError('');
        setVideoDuration(0);
    };

    const handlePrivacyChange = (event: SelectChangeEvent<StoryPrivacy>) => {
        setPrivacy(event.target.value as StoryPrivacy);
    };

    const getPrivacyIcon = (value: StoryPrivacy) => {
        switch (value) {
            case 'PUBLIC':
                return <PublicIcon />;
            case 'FRIENDS':
                return <PeopleIcon />;
            case 'PRIVATE':
                return <LockIcon />;
            default:
                return <PeopleIcon />;
        }
    };

    const getPrivacyLabel = (value: StoryPrivacy) => {
        switch (value) {
            case 'PUBLIC':
                return t('story.public');
            case 'FRIENDS':
                return t('story.friends');
            case 'PRIVATE':
                return t('story.only_me');
            default:
                return t('story.friends');
        }
    };

    const handleStoryClick = (index: number) => {
        setSelectedGroupIndex(index);
        setViewerOpen(true);
    };

    return (
        <>
            <Box
                sx={{
                    display: 'flex',
                    gap: 1,
                    p: 2,
                    overflowX: 'auto',
                    bgcolor: 'background.paper',
                    borderRadius: 2,
                    boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.1)',
                    mb: 2,
                    '&::-webkit-scrollbar': { height: 6 },
                    '&::-webkit-scrollbar-thumb': { bgcolor: isDark ? '#555' : '#ccc', borderRadius: 3 },
                }}
            >


                {/* Create Story Card */}
                <Box
                    onClick={() => setCreateDialogOpen(true)}
                    sx={{
                        width: 110,
                        height: 200,
                        borderRadius: 2,
                        overflow: 'hidden',
                        position: 'relative',
                        cursor: 'pointer',
                        bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#f0f2f5',
                        border: `1px solid ${theme.palette.divider}`,
                        '&:hover': { opacity: 0.9 },
                    }}
                >
                    <>
                        <Box
                            component="img"
                            src={currentUser?.avatar || "https://i.pinimg.com/736x/3c/67/75/3c67757cef723535a7484a6c7bfbfc43.jpg"}
                            sx={{
                                width: '100%',
                                height: '75%',
                                objectFit: 'cover',
                            }}
                        />
                        <Box
                            sx={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: '25%',
                                bgcolor: 'background.paper',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Box
                                sx={{
                                    position: 'absolute',
                                    top: -18,
                                    bgcolor: 'primary.main',
                                    borderRadius: '50%',
                                    border: `4px solid ${theme.palette.background.paper}`,
                                    width: 36,
                                    height: 36,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <AddIcon sx={{ color: 'white', fontSize: 20 }} />
                            </Box>
                            <Typography fontSize={12} color="text.primary" fontWeight={600} mt={1}>
                                {t('story.create_story')}
                            </Typography>
                        </Box>
                    </>

                </Box>

                {/* Friend Stories */}
                {storyGroups?.data.map((group, index) => (
                    <Box
                        key={group._id}
                        onClick={() => handleStoryClick(index)}
                        sx={{
                            width: 110,
                            height: 200,
                            borderRadius: 2,
                            overflow: 'hidden',
                            position: 'relative',
                            cursor: 'pointer',
                            '&:hover': { opacity: 0.9 },
                        }}
                    >
                        <Box
                            component={group.latestStory.type === 'VIDEO' ? 'video' : 'img'}
                            src={group.latestStory.type === 'VIDEO'
                                ? (group.latestStory.thumbnail || group.latestStory.mediaUrl)
                                : group.latestStory.mediaUrl}
                            sx={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                            }}
                        />
                        {/* Gradient overlay */}
                        <Box
                            sx={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: '50%',
                                background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
                            }}
                        />
                        {/* Avatar with ring */}
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 8,
                                left: 8,
                                border: group.hasUnviewed ? '3px solid #1877f2' : `3px solid ${theme.palette.text.secondary}`,
                                borderRadius: '50%',
                            }}
                        >
                            <Avatar src={group.user.avatar || ""} sx={{ width: 40, height: 40 }} />
                        </Box>
                        {/* Name */}
                        <Typography
                            sx={{
                                position: 'absolute',
                                bottom: 8,
                                left: 8,
                                right: 8,
                                color: 'white',
                                fontSize: 13,
                                fontWeight: 500,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {group.user.firstName} {group.user.lastName}
                        </Typography>
                    </Box>
                ))}

                {isLoading && (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 110 }}>
                        <CircularProgress size={24} />
                    </Box>
                )}
            </Box>

            {/* Create Story Dialog */}
            <Dialog
                open={createDialogOpen}
                onClose={handleCloseDialog}
                maxWidth="sm"
                fullWidth
                fullScreen={typeof window !== 'undefined' && window.innerWidth < 600}
                PaperProps={{
                    sx: {
                        borderRadius: { xs: 0, sm: 3 },
                        maxHeight: { xs: '100vh', sm: '90vh' },
                    }
                }}
            >
                <DialogContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" fontWeight={700}>{t('story.create_story')}</Typography>
                        <IconButton onClick={handleCloseDialog} sx={{ color: 'text.secondary' }}>
                            <CloseIcon />
                        </IconButton>
                    </Box>

                    {!previewUrl ? (
                        <Box
                            onClick={() => fileInputRef.current?.click()}
                            sx={{
                                border: `2px dashed ${theme.palette.divider}`,
                                borderRadius: 3,
                                p: { xs: 4, sm: 6 },
                                textAlign: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    borderColor: 'primary.main',
                                    bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(24,119,242,0.04)',
                                    transform: 'scale(1.01)',
                                },
                            }}
                        >
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mb: 2 }}>
                                <Box sx={{
                                    width: 64, height: 64, borderRadius: 2,
                                    bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#e7f3ff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <ImageIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                                </Box>
                                <Box sx={{
                                    width: 64, height: 64, borderRadius: 2,
                                    bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#e7f3ff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <VideocamIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                                </Box>
                            </Box>
                            <Typography color="text.secondary" fontSize={14}>
                                {t('story.select_media')}
                            </Typography>
                        </Box>
                    ) : (
                        <Box
                            ref={previewContainerRef}
                            sx={{ position: 'relative', minHeight: 400 }}
                        >
                            {selectedFile?.type.startsWith('video/') ? (
                                <video
                                    ref={videoRef}
                                    src={previewUrl}
                                    controls
                                    style={{
                                        width: '100%',
                                        maxHeight: 400,
                                        borderRadius: 8,
                                    }}
                                />
                            ) : (
                                <Box
                                    component="img"
                                    src={previewUrl}
                                    sx={{
                                        width: '100%',
                                        maxHeight: 400,
                                        objectFit: 'contain',
                                        borderRadius: 2,
                                    }}
                                />
                            )}

                            {/* Draggable Caption */}
                            {!selectedFile?.type.startsWith('video/') && (
                                <DraggableCaption
                                    caption={caption}
                                    onCaptionChange={setCaption}
                                    captionStyle={captionStyle}
                                    onStyleChange={setCaptionStyle}
                                    containerRef={previewContainerRef}
                                />
                            )}

                            <IconButton
                                onClick={() => {
                                    setSelectedFile(null);
                                    setPreviewUrl(null);
                                }}
                                sx={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    bgcolor: 'rgba(0,0,0,0.5)',
                                    color: 'white',
                                    '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                                }}
                            >
                                <CloseIcon />
                            </IconButton>
                        </Box>
                    )}

                    {videoError && (
                        <Typography color="error" sx={{ mt: 1 }}>
                            {videoError}
                        </Typography>
                    )}

                    <input
                        type="file"
                        ref={fileInputRef}
                        hidden
                        accept="image/*,video/*"
                        onChange={handleFileSelect}
                    />

                    {/* Show TextField only for video (image uses DraggableCaption) */}
                    {selectedFile?.type.startsWith('video/') && (
                        <TextField
                            fullWidth
                            placeholder={t('story.write_caption')}
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            sx={{
                                mt: 2,
                                '& .MuiOutlinedInput-root': {
                                    color: 'text.primary',
                                    '& fieldset': { borderColor: theme.palette.divider },
                                    '&:hover fieldset': { borderColor: 'primary.main' },
                                },
                                '& .MuiInputBase-input::placeholder': { color: 'text.secondary' },
                            }}
                        />
                    )}

                    {/* Privacy Selector */}
                    <FormControl fullWidth sx={{ mt: 2 }}>
                        <InputLabel id="privacy-label">{t('story.audience')}</InputLabel>
                        <Select
                            labelId="privacy-label"
                            value={privacy}
                            label={t('story.audience')}
                            onChange={handlePrivacyChange}
                            renderValue={(value) => (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    {getPrivacyIcon(value)}
                                    {getPrivacyLabel(value)}
                                </Box>
                            )}
                        >
                            <MenuItem value="PUBLIC">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <PublicIcon />
                                    <Box>
                                        <Typography>{t('story.public')}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {t('story.public_desc')}
                                        </Typography>
                                    </Box>
                                </Box>
                            </MenuItem>
                            <MenuItem value="FRIENDS">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <PeopleIcon />
                                    <Box>
                                        <Typography>{t('story.friends')}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {t('story.friends_desc')}
                                        </Typography>
                                    </Box>
                                </Box>
                            </MenuItem>
                            <MenuItem value="PRIVATE">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <LockIcon />
                                    <Box>
                                        <Typography>{t('story.only_me')}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {t('story.only_me_desc')}
                                        </Typography>
                                    </Box>
                                </Box>
                            </MenuItem>
                        </Select>
                    </FormControl>

                    <Button
                        fullWidth
                        variant="contained"
                        disabled={!selectedFile || isUploading || !!videoError}
                        onClick={handleCreateStory}
                        sx={{
                            mt: 2,
                            py: 1.2,
                            fontWeight: 700,
                            fontSize: 14,
                            borderRadius: 2,
                            textTransform: 'none',
                            bgcolor: 'primary.main',
                            '&:hover': { bgcolor: 'primary.dark' },
                            '&:disabled': { bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#e4e6eb', color: isDark ? 'rgba(255,255,255,0.3)' : '#bcc0c4' },
                        }}
                    >
                        {isUploading ? <CircularProgress size={24} /> : t('story.share_to_story')}
                    </Button>
                </DialogContent>
            </Dialog>

            {/* Story Viewer */}
            {viewerOpen && storyGroups && (
                <StoryViewer
                    storyGroups={storyGroups.data}
                    initialGroupIndex={selectedGroupIndex}
                    currentUserId={currentUser.id}
                    onClose={() => setViewerOpen(false)}
                />
            )}
        </>
    );
}
