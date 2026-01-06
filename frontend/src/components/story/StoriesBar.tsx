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
} from '@mui/material';
import {
    Add as AddIcon,
    Close as CloseIcon,
    Image as ImageIcon,
    Videocam as VideocamIcon,
} from '@mui/icons-material';
import { useStoriesFeed, useCreateStory } from '@/queries/useStoryQueries';
import { uploadChatMedia } from '@/services/cloudinary.service';
import StoryViewer from '@/components/story/StoryViewer';

interface StoriesBarProps {
    currentUser: {
        _id: string;
        firstName: string;
        lastName: string;
        avatar: string;
    };
}

export default function StoriesBar({ currentUser }: StoriesBarProps) {
    const { data: storyGroups, isLoading } = useStoriesFeed();
    const createStoryMutation = useCreateStory();

    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [caption, setCaption] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [videoDuration, setVideoDuration] = useState(0);
    const [videoError, setVideoError] = useState('');

    const [viewerOpen, setViewerOpen] = useState(false);
    const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);

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
                privacy: 'FRIENDS',
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
        setVideoError('');
        setVideoDuration(0);
    };

    const handleStoryClick = (index: number) => {
        setSelectedGroupIndex(index);
        setViewerOpen(true);
    };

    // Access .data from APIResponse
    const storyGroupsData = storyGroups?.data || [];

    // Find own stories
    const ownStoryGroup = storyGroupsData.find(g => g._id === currentUser._id);
    const otherStoryGroups = storyGroupsData.filter(g => g._id !== currentUser._id) || [];

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
                    onClick={() => ownStoryGroup ? handleStoryClick(0) : setCreateDialogOpen(true)}
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
                    {ownStoryGroup ? (
                        <>
                            <Box
                                component={ownStoryGroup.latestStory.type === 'VIDEO' ? 'video' : 'img'}
                                src={ownStoryGroup.latestStory.mediaUrl}
                                sx={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                }}
                            />
                            <Box
                                sx={{
                                    position: 'absolute',
                                    top: 8,
                                    left: 8,
                                    border: ownStoryGroup.hasUnviewed ? '3px solid #1877f2' : '3px solid #65676b',
                                    borderRadius: '50%',
                                }}
                            >
                                <Avatar src={currentUser.avatar} sx={{ width: 40, height: 40 }} />
                            </Box>
                        </>
                    ) : (
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
                    )}
                </Box>

                {/* Friend Stories */}
                {otherStoryGroups.map((group, index) => (
                    <Box
                        key={group._id}
                        onClick={() => handleStoryClick(ownStoryGroup ? index + 1 : index)}
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
                        <Box sx={{ position: 'relative' }}>
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
                    currentUserId={currentUser._id}
                    onClose={() => setViewerOpen(false)}
                />
            )}
        </>
    );
}
