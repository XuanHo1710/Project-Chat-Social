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
                    setVideoError('Video không được dài quá 15 giây');
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
                return 'Công khai';
            case 'FRIENDS':
                return 'Bạn bè';
            case 'PRIVATE':
                return 'Chỉ mình tôi';
            default:
                return 'Bạn bè';
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
                    bgcolor: 'white',
                    borderRadius: 2,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    mb: 2,
                    '&::-webkit-scrollbar': { height: 6 },
                    '&::-webkit-scrollbar-thumb': { bgcolor: '#ccc', borderRadius: 3 },
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
                        bgcolor: '#f0f2f5',
                        border: '1px solid #e4e6eb',
                        '&:hover': { opacity: 0.9 },
                    }}
                >
                    <>
                        <Box
                            component="img"
                            src={currentUser.avatar}
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
                                bgcolor: 'white',
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
                                    bgcolor: '#1877f2',
                                    borderRadius: '50%',
                                    border: '4px solid white',
                                    width: 36,
                                    height: 36,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <AddIcon sx={{ color: 'white', fontSize: 20 }} />
                            </Box>
                            <Typography fontSize={12} color="#050505" fontWeight={600} mt={1}>
                                Tạo tin
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
                                border: group.hasUnviewed ? '3px solid #1877f2' : '3px solid #65676b',
                                borderRadius: '50%',
                            }}
                        >
                            <Avatar src={group.user.avatar} sx={{ width: 40, height: 40 }} />
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
                PaperProps={{
                    sx: { bgcolor: 'white', color: '#050505' },
                }}
            >
                <DialogContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" fontWeight={700}>Tạo tin</Typography>
                        <IconButton onClick={handleCloseDialog} sx={{ color: '#65676b' }}>
                            <CloseIcon />
                        </IconButton>
                    </Box>

                    {!previewUrl ? (
                        <Box
                            onClick={() => fileInputRef.current?.click()}
                            sx={{
                                border: '2px dashed #ccc',
                                borderRadius: 2,
                                p: 4,
                                textAlign: 'center',
                                cursor: 'pointer',
                                '&:hover': { borderColor: '#1877f2', bgcolor: '#f0f2f5' },
                            }}
                        >
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 2 }}>
                                <ImageIcon sx={{ fontSize: 40, color: '#65676b' }} />
                                <VideocamIcon sx={{ fontSize: 40, color: '#65676b' }} />
                            </Box>
                            <Typography color="#65676b">
                                Nhấn để chọn ảnh hoặc video (tối đa 15s)
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
                            placeholder="Viết chú thích..."
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            sx={{
                                mt: 2,
                                '& .MuiOutlinedInput-root': {
                                    color: '#050505',
                                    '& fieldset': { borderColor: '#ccc' },
                                    '&:hover fieldset': { borderColor: '#1877f2' },
                                },
                                '& .MuiInputBase-input::placeholder': { color: '#65676b' },
                            }}
                        />
                    )}

                    {/* Privacy Selector */}
                    <FormControl fullWidth sx={{ mt: 2 }}>
                        <InputLabel id="privacy-label">Đối tượng</InputLabel>
                        <Select
                            labelId="privacy-label"
                            value={privacy}
                            label="Đối tượng"
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
                                        <Typography>Công khai</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Bất kỳ ai trên Facebook
                                        </Typography>
                                    </Box>
                                </Box>
                            </MenuItem>
                            <MenuItem value="FRIENDS">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <PeopleIcon />
                                    <Box>
                                        <Typography>Bạn bè</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Bạn bè của bạn
                                        </Typography>
                                    </Box>
                                </Box>
                            </MenuItem>
                            <MenuItem value="PRIVATE">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <LockIcon />
                                    <Box>
                                        <Typography>Chỉ mình tôi</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Chỉ bạn có thể xem
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
                            bgcolor: '#1877f2',
                            '&:hover': { bgcolor: '#166fe5' },
                            '&:disabled': { bgcolor: '#e4e6eb', color: '#bcc0c4' },
                        }}
                    >
                        {isUploading ? <CircularProgress size={24} /> : 'CHIA SẺ LÊN TIN'}
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
