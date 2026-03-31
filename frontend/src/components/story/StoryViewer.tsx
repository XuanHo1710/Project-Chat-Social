'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Box,
    Avatar,
    Typography,
    IconButton,
    LinearProgress,
    TextField,
    Dialog,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Snackbar,
    Alert,
    keyframes,
} from '@mui/material';
import {
    Close as CloseIcon,
    ChevronLeft as ChevronLeftIcon,
    ChevronRight as ChevronRightIcon,
    VolumeUp as VolumeUpIcon,
    VolumeOff as VolumeOffIcon,
    MoreHoriz as MoreHorizIcon,
    Pause as PauseIcon,
    PlayArrow as PlayArrowIcon,
    Visibility as VisibilityIcon,
    Delete as DeleteIcon,
    Send as SendIcon,
} from '@mui/icons-material';
import { StoryGroup } from '@/types/story';
import { useViewStory, useReactToStory, useStoryViewers, useDeleteStory } from '@/queries/useStoryQueries';
import { timeAgo } from '@/utils/formatDate';
import StoryViewersModal from './StoryViewersModal';
import StoryReactions from './StoryReactions';
import { useSocket } from '@/contexts/SocketContext';
import { conversationService } from '@/services/conversation.service';
import { useTranslation } from 'react-i18next';

// Floating emoji animation - TikTok/Facebook style vertical stream
const floatUp = keyframes`
  0% {
    opacity: 1;
    transform: translateY(0) scale(0.5);
  }
  10% {
    opacity: 1;
    transform: translateY(-20px) scale(1.2);
  }
  30% {
    opacity: 1;
    transform: translateY(-80px) scale(1);
  }
  60% {
    opacity: 0.8;
    transform: translateY(-180px) scale(0.9);
  }
  100% {
    opacity: 0;
    transform: translateY(-350px) scale(0.6);
  }
`;

interface FloatingEmoji {
    id: number;
    emoji: string;
    delay: number; // stagger delay for stream effect
}

interface StoryViewerProps {
    storyGroups: StoryGroup[];
    initialGroupIndex: number;
    currentUserId: string;
    onClose: () => void;
}

export default function StoryViewer({
    storyGroups,
    initialGroupIndex,
    currentUserId,
    onClose,
}: StoryViewerProps) {
    const [currentGroupIndex, setCurrentGroupIndex] = useState(initialGroupIndex);
    const { t } = useTranslation();
    const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [showViewers, setShowViewers] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
        open: false,
        message: '',
        severity: 'success',
    });

    // New states for improvements
    const [isVideoReady, setIsVideoReady] = useState(false);
    const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);

    const videoRef = useRef<HTMLVideoElement>(null);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const viewedStoriesRef = useRef<Set<string>>(new Set()); // Track viewed stories to prevent double calls

    const { socket } = useSocket();
    const viewStoryMutation = useViewStory();
    const reactMutation = useReactToStory();
    const deleteStoryMutation = useDeleteStory();

    const currentGroup = storyGroups[currentGroupIndex];
    const currentStory = currentGroup?.stories[currentStoryIndex];
    const isOwnStory = currentGroup?.user._id === currentUserId;

    // Fetch viewers for own story
    const { data: viewersData, isLoading: viewersLoading } = useStoryViewers(
        currentStory?._id || '',
        { enabled: isOwnStory && showViewers }
    );


    // Duration for each story (5s for images, actual duration for videos)
    const getDuration = useCallback(() => {
        if (currentStory?.type === 'VIDEO' && currentStory.duration) {
            return currentStory.duration * 1000;
        }
        return 5000; // 5 seconds for images
    }, [currentStory]);

    // Start progress timer
    const startProgress = useCallback(() => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
        }

        const duration = getDuration();
        const interval = 50; // Update every 50ms
        const increment = (interval / duration) * 100;

        progressIntervalRef.current = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    return prev;
                }
                return prev + increment;
            });
        }, interval);
    }, [getDuration]);

    // Stop progress timer
    const stopProgress = useCallback(() => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
    }, []);

    // Handle next story
    const goToNextStory = useCallback(() => {
        if (currentStoryIndex < currentGroup.stories.length - 1) {
            setCurrentStoryIndex(prev => prev + 1);
            setProgress(0);
        } else if (currentGroupIndex < storyGroups.length - 1) {
            setCurrentGroupIndex(prev => prev + 1);
            setCurrentStoryIndex(0);
            setProgress(0);
            setIsVideoReady(false);
        } else {
            onClose();
        }
    }, [currentStoryIndex, currentGroupIndex, currentGroup, storyGroups, onClose]);


    // Handle previous story
    const goToPrevStory = useCallback(() => {
        if (currentStoryIndex > 0) {
            setCurrentStoryIndex(prev => prev - 1);
            setProgress(0);
            setIsVideoReady(false);
        } else if (currentGroupIndex > 0) {
            setCurrentGroupIndex(prev => prev - 1);
            const prevGroup = storyGroups[currentGroupIndex - 1];
            setCurrentStoryIndex(prevGroup.stories.length - 1);
            setProgress(0);
            setIsVideoReady(false);
        }
    }, [currentStoryIndex, currentGroupIndex, storyGroups]);

    // Mark story as viewed - with deduplication
    useEffect(() => {
        if (!currentStory) return;

        // Get story owner ID - handle both object and string formats
        const storyOwnerId = typeof currentStory.userId === 'object'
            ? (currentStory.userId as { _id?: string })._id || String(currentStory.userId)
            : currentStory.userId;

        // Don't view own stories
        if (storyOwnerId === currentUserId) return;

        // Only call API if we haven't viewed this story yet in this session
        if (!viewedStoriesRef.current.has(currentStory._id)) {
            viewedStoriesRef.current.add(currentStory._id);
            viewStoryMutation.mutate(currentStory._id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentStory?._id, currentUserId]);

    // Progress effect - only start when media is ready
    useEffect(() => {
        const isMediaReady = currentStory?.type === 'VIDEO' ? isVideoReady : true;

        if (!isPaused && isMediaReady) {
            startProgress();
        } else {
            stopProgress();
        }

        return () => stopProgress();
    }, [isPaused, currentStory?._id, currentStory?.type, isVideoReady, startProgress, stopProgress]);

    // Auto advance when progress reaches 100
    useEffect(() => {
        if (progress >= 100) {
            goToNextStory();
        }
    }, [progress, goToNextStory]);

    // Handle video - reset video ready state and wait for canplay
    useEffect(() => {
        if (currentStory?.type === 'VIDEO') {
            setIsVideoReady(false);
        } else {
            setIsVideoReady(true);
        }
    }, [currentStory?._id, currentStory?.type]);

    // Handle video playback
    useEffect(() => {
        if (videoRef.current && currentStory?.type === 'VIDEO') {
            videoRef.current.currentTime = 0;
            if (!isPaused && isVideoReady) {
                videoRef.current.play().catch(console.error);
            } else if (isPaused) {
                videoRef.current.pause();
            }
        }
    }, [currentStory, isPaused, isVideoReady]);

    // Video event handlers
    const handleVideoCanPlay = useCallback(() => {
        setIsVideoReady(true);
    }, []);

    const handleVideoPause = useCallback(() => {
        // Sync pause state if video pauses unexpectedly
        if (!isPaused) {
            setIsPaused(true);
        }
    }, [isPaused]);

    const handleVideoPlay = useCallback(() => {
        // Sync play state if video plays
        if (isPaused) {
            setIsPaused(false);
        }
    }, [isPaused]);

    // Add floating emoji - spawn multiple for stream effect
    const addFloatingEmoji = (emoji: string) => {
        // Spawn 3-5 emojis with staggered delays for stream effect
        // const count = 3 + Math.floor(Math.random() * 3);
        const newEmojis: FloatingEmoji[] = [];

        // for (let i = 0; i < count; i++) {
        newEmojis.push({
            id: Date.now(),
            emoji,
            delay: 150,
        });
        // }

        setFloatingEmojis(prev => [...prev, ...newEmojis]);

        // Remove after animation completes
        setTimeout(() => {
            setFloatingEmojis(prev => prev.filter(e => !newEmojis.find(ne => ne.id === e.id)));
        }, 2500 * 150)
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') goToNextStory();
            if (e.key === 'ArrowLeft') goToPrevStory();
            if (e.key === 'Escape') onClose();
            if (e.key === ' ') {
                e.preventDefault();
                setIsPaused(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [goToNextStory, goToPrevStory, onClose]);

    const handleReaction = (reaction: string) => {
        if (currentStory) {
            reactMutation.mutate({ storyId: currentStory._id, reaction });
        }
    };

    const handleOpenViewers = () => {
        setIsPaused(true);
        setShowViewers(true);
    };

    const handleCloseViewers = () => {
        setShowViewers(false);
        setIsPaused(false);
    };

    const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
        setIsPaused(true);
        setMenuAnchor(event.currentTarget);
    };

    const handleCloseMenu = () => {
        setMenuAnchor(null);
        setIsPaused(false);
    };

    const handleDeleteStory = () => {
        if (currentStory) {
            deleteStoryMutation.mutate(currentStory._id, {
                onSuccess: () => {
                    handleCloseMenu();
                    // Move to next story or close if no more stories
                    if (currentGroup.stories.length <= 1) {
                        if (currentGroupIndex < storyGroups.length - 1) {
                            setCurrentGroupIndex(prev => prev + 1);
                            setCurrentStoryIndex(0);
                            setProgress(0);
                        } else {
                            onClose();
                        }
                    } else {
                        goToNextStory();
                    }
                },
            });
        }
    };

    const handleReplyToStory = async () => {
        if (!replyText.trim() || !currentStory || !socket) return;

        try {
            // Get or create conversation with story owner
            const storyOwnerId = currentGroup.user._id;

            // Get all conversations of current user and find DIRECT conversation with story owner
            const conversationResponse = await conversationService.getConversationByUserId(currentUserId);

            let conversationId: string | undefined;
            if (conversationResponse.data && conversationResponse.data.length > 0) {
                // Find DIRECT conversation where both currentUser and storyOwner are participants
                const directConv = conversationResponse.data.find(conv =>
                    conv.type === 'DIRECT' &&
                    conv.participants.some(p => p.user._id === storyOwnerId)
                );
                if (directConv) {
                    conversationId = directConv._id;
                }
            }

            if (!conversationId) {
                // Create new conversation via socket
                socket.emit('createConversation', {
                    participantId: storyOwnerId,
                }, (response: { conversationId: string }) => {
                    conversationId = response.conversationId;
                });
                // Wait a bit for conversation creation
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            if (!conversationId) {
                throw new Error('Could not get or create conversation');
            }

            // Send message with story reply type
            socket.emit('message', {
                conversationId,
                senderId: currentUserId,
                content: replyText,
                type: 'STORY_REPLY',
                storyReply: {
                    storyId: currentStory._id,
                    storyMediaUrl: currentStory.mediaUrl,
                    storyOwnerId: storyOwnerId,
                    storyOwnerName: `${currentGroup.user.firstName} ${currentGroup.user.lastName}`,
                    storyCaption: currentStory.caption || '',
                },
            });

            setReplyText('');
            setIsPaused(false);
            setSnackbar({
                open: true,
                message: t('story_viewer.reply_sent'),
                severity: 'success',
            });
        } catch (error) {
            console.error('Error replying to story:', error);
            setSnackbar({
                open: true,
                message: t('story_viewer.reply_failed'),
                severity: 'error',
            });
        }
    };

    if (!currentGroup || !currentStory) {
        return null;
    }

    return (
        <Dialog
            open
            onClose={onClose}
            fullScreen
            PaperProps={{
                sx: { bgcolor: 'black' },
            }}
        >
            <Box
                sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                }}
            >
                {/* Close button */}
                <IconButton
                    onClick={onClose}
                    sx={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        color: 'white',
                        zIndex: 10,
                    }}
                >
                    <CloseIcon />
                </IconButton>

                {/* Previous button */}
                {(currentGroupIndex > 0 || currentStoryIndex > 0) && (
                    <IconButton
                        onClick={goToPrevStory}
                        sx={{
                            position: 'absolute',
                            left: 16,
                            color: 'white',
                            bgcolor: 'rgba(255,255,255,0.1)',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                        }}
                    >
                        <ChevronLeftIcon fontSize="large" />
                    </IconButton>
                )}

                {/* Next button */}
                {(currentGroupIndex < storyGroups.length - 1 || currentStoryIndex < currentGroup.stories.length - 1) && (
                    <IconButton
                        onClick={goToNextStory}
                        sx={{
                            position: 'absolute',
                            right: 16,
                            color: 'white',
                            bgcolor: 'rgba(255,255,255,0.1)',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                        }}
                    >
                        <ChevronRightIcon fontSize="large" />
                    </IconButton>
                )}

                {/* Story Container */}
                <Box
                    sx={{
                        width: '100%',
                        maxWidth: 420,
                        height: '100%',
                        maxHeight: '90vh',
                        position: 'relative',
                        borderRadius: 2,
                        overflow: 'hidden',
                        bgcolor: '#1c1c1c',
                    }}
                    onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        if (x < rect.width / 3) {
                            goToPrevStory();
                        } else if (x > (rect.width * 2) / 3) {
                            goToNextStory();
                        } else {
                            setIsPaused(prev => !prev);
                        }
                    }}
                >
                    {/* Progress bars */}
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            display: 'flex',
                            gap: 0.5,
                            p: 1,
                            zIndex: 5,
                        }}
                    >
                        {currentGroup.stories.map((_, index) => (
                            <Box key={index} sx={{ flex: 1 }}>
                                <LinearProgress
                                    variant="determinate"
                                    value={
                                        index < currentStoryIndex
                                            ? 100
                                            : index === currentStoryIndex
                                                ? progress
                                                : 0
                                    }
                                    sx={{
                                        height: 2,
                                        borderRadius: 1,
                                        bgcolor: 'rgba(255,255,255,0.3)',
                                        '& .MuiLinearProgress-bar': {
                                            bgcolor: 'white',
                                        },
                                    }}
                                />
                            </Box>
                        ))}
                    </Box>

                    {/* Header */}
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 16,
                            left: 0,
                            right: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            px: 2,
                            zIndex: 5,
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar src={currentGroup.user.avatar || ""} sx={{ width: 40, height: 40 }} />
                            <Box>
                                <Typography color="white" fontWeight={500} fontSize={14}>
                                    {currentGroup.user.firstName} {currentGroup.user.lastName}
                                </Typography>
                                <Typography color="rgba(255,255,255,0.7)" fontSize={12}>
                                    {timeAgo(new Date(currentStory.createdAt))}
                                </Typography>
                            </Box>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }} onClick={(e) => e.stopPropagation()}>
                            <IconButton onClick={() => setIsPaused(prev => !prev)} sx={{ color: 'white' }}>
                                {isPaused ? <PlayArrowIcon /> : <PauseIcon />}
                            </IconButton>
                            {currentStory.type === 'VIDEO' && (
                                <IconButton onClick={() => setIsMuted(prev => !prev)} sx={{ color: 'white' }}>
                                    {isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
                                </IconButton>
                            )}
                            {isOwnStory && (
                                <IconButton onClick={handleOpenMenu} sx={{ color: 'white' }}>
                                    <MoreHorizIcon />
                                </IconButton>
                            )}
                        </Box>
                    </Box>

                    {/* More menu */}
                    <Menu
                        anchorEl={menuAnchor}
                        open={Boolean(menuAnchor)}
                        onClose={handleCloseMenu}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                        onClick={(e) => e.stopPropagation()}
                        slotProps={{
                            paper: {
                                sx: { minWidth: 180 }
                            }
                        }}
                    >
                        <MenuItem onClick={handleDeleteStory}>
                            <ListItemIcon>
                                <DeleteIcon fontSize="small" color="error" />
                            </ListItemIcon>
                            <ListItemText>{t('story_viewer.delete_story')}</ListItemText>
                        </MenuItem>
                    </Menu>

                    {/* Caption with custom style */}
                    {currentStory.caption && (
                        <Box
                            sx={{
                                position: 'absolute',
                                top: '15%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                px: 2,
                                py: 1,
                                bgcolor: currentStory.captionStyle?.backgroundColor || 'rgba(0,0,0,0.5)',
                                borderRadius: 2,
                                maxWidth: '90%',
                            }}
                        >
                            <Typography
                                color={currentStory.captionStyle?.color || 'white'}
                                textAlign="center"
                                fontSize={currentStory.captionStyle?.fontSize || 16}
                            >
                                {currentStory.caption}
                            </Typography>
                        </Box>

                    )}

                    {/* Media */}
                    {currentStory.type === 'VIDEO' ? (
                        <video
                            ref={videoRef}
                            src={currentStory.mediaUrl}
                            muted={isMuted}
                            playsInline
                            onCanPlay={handleVideoCanPlay}
                            onPause={handleVideoPause}
                            onPlay={handleVideoPlay}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                            }}
                        />
                    ) : (
                        <Box
                            component="img"
                            src={currentStory.mediaUrl}
                            sx={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                            }}
                        />
                    )}


                    {/* Reply/Reaction bar for other users' stories */}
                    {!isOwnStory && (
                        <Box
                            sx={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                p: 1.5,
                                pb: 2,
                                background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                                zIndex: 100,
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Message input row */}
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    px: 1,
                                }}
                            >
                                <TextField
                                    fullWidth
                                    placeholder={t('story_viewer.message_placeholder')}
                                    size="small"
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    onFocus={() => setIsPaused(true)}
                                    onBlur={() => !replyText && setIsPaused(false)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleReplyToStory();
                                        }
                                    }}
                                    sx={{
                                        flex: 1,
                                        '& .MuiOutlinedInput-root': {
                                            color: 'white',
                                            bgcolor: 'rgba(255,255,255,0.15)',
                                            borderRadius: 5,
                                            height: 44,
                                            '& fieldset': { border: 'none' },
                                            '&:hover': {
                                                bgcolor: 'rgba(255,255,255,0.2)',
                                            },
                                        },
                                    }}
                                    InputProps={{
                                        endAdornment: replyText && (
                                            <IconButton onClick={handleReplyToStory} sx={{ color: 'white' }}>
                                                <SendIcon fontSize="small" />
                                            </IconButton>
                                        ),
                                    }}
                                />
                            </Box>
                            {/* Reaction buttons row - visible and spaced */}
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    mb: 1.5,
                                }}
                            >
                                <StoryReactions
                                    onReactionComplete={handleReaction}
                                    addFloatingEmoji={addFloatingEmoji}
                                    storyOwnerName={`${currentGroup.user.firstName} ${currentGroup.user.lastName}`}
                                />
                            </Box>

                        </Box>
                    )}

                    {/* Viewers panel for own stories */}
                    {isOwnStory && (
                        <Box
                            sx={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                p: 2,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 1.5,
                                bgcolor: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                                background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                '&:hover': {
                                    bgcolor: 'rgba(0,0,0,0.6)',
                                },
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleOpenViewers();
                            }}
                        >
                            <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                bgcolor: 'rgba(255,255,255,0.15)',
                                px: 2,
                                py: 1,
                                borderRadius: 3,
                                '&:hover': {
                                    bgcolor: 'rgba(255,255,255,0.25)',
                                },
                            }}>
                                <VisibilityIcon sx={{ color: 'white', fontSize: 20 }} />
                                <Typography color="white" fontWeight={500} fontSize={14}>
                                    {currentStory.viewCount || currentStory.viewers?.length || 0} {t('story_viewer.views_count')}
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {/* Floating Emojis Animation - TikTok style vertical stream */}
                    <Box
                        sx={{
                            position: 'absolute',
                            bottom: 80,
                            right: 20,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            pointerEvents: 'none',
                            zIndex: 1000,
                        }}
                    >
                        {floatingEmojis.map((floatingEmoji) => (
                            <Box
                                key={floatingEmoji.id}
                                sx={{
                                    fontSize: '2.2rem',
                                    animation: `${floatUp} 2s ease-out forwards`,
                                    animationDelay: `${floatingEmoji.delay}ms`,
                                    opacity: 0,
                                    animationFillMode: 'forwards',
                                    textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                }}
                            >
                                {floatingEmoji.emoji}
                            </Box>
                        ))}
                    </Box>
                </Box>
            </Box>

            {/* Viewers Modal */}
            <StoryViewersModal
                open={showViewers}
                onClose={handleCloseViewers}
                viewers={viewersData?.data?.viewers || []}
                isLoading={viewersLoading}
                totalViews={viewersData?.data?.totalViews || currentStory?.viewCount || currentStory?.viewers?.length || 0}
                stories={currentGroup?.stories || []}
                currentStoryIndex={currentStoryIndex}
                onStorySelect={(index) => {
                    setCurrentStoryIndex(index);
                    setProgress(0);
                    setIsVideoReady(false);
                }}
            />

            {/* Snackbar for feedback */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Dialog>
    );
}
