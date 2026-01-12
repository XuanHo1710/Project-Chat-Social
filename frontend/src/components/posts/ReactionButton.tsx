"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Box, Typography, Tooltip, Grow, ClickAwayListener, useTheme } from "@mui/material";
import { ThumbUpOutlined as ThumbUpOutlinedIcon } from "@mui/icons-material";
import { useGetUserReaction } from "@/queries/useReactionQueries";
import { ReactionType } from "@/types/reaction";
import { useSocket } from "@/contexts/SocketContext";
import { useReactionStore, ReactionType as StoreReactionType } from "@/stores/useReactionStore";
import { PostType } from "@/types/post";

// Reaction data with emoji, label, and color
const REACTIONS = [
    { type: "LIKE" as ReactionType, emoji: "👍", label: "Thích", color: "#1877f2" },
    { type: "LOVE" as ReactionType, emoji: "❤️", label: "Yêu thích", color: "#f33e58" },
    { type: "HAHA" as ReactionType, emoji: "😆", label: "Haha", color: "#f7b125" },
    { type: "WOW" as ReactionType, emoji: "😮", label: "Wow", color: "#f7b125" },
    { type: "SAD" as ReactionType, emoji: "😢", label: "Buồn", color: "#f7b125" },
    { type: "ANGRY" as ReactionType, emoji: "😡", label: "Phẫn nộ", color: "#e9710f" },
];

interface ReactionButtonProps {
    post: PostType;
    initialTotalReacts?: number;
    variant?: 'default' | 'reels';
}

export default function ReactionButton({ post, initialTotalReacts = 0, variant = 'default' }: ReactionButtonProps) {
    const [showReactions, setShowReactions] = useState(false);
    const { socketReaction } = useSocket();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const hoverBg = isDark ? 'rgba(255,255,255,0.1)' : '#f0f2f5';

    // Use selectors to get specific post reaction state - ensures re-render on change
    const userReaction = useReactionStore(state => state.postReactions[post._id]?.userReaction);
    const totalReacts = useReactionStore(state => state.postReactions[post._id]?.totalReacts);
    const setPostReaction = useReactionStore(state => state.setPostReaction);
    const initPostReaction = useReactionStore(state => state.initPostReaction);
    const setFromApi = useReactionStore(state => state.setFromApi);
    const setFromServer = useReactionStore(state => state.setFromServer);

    // Local state derived from global store
    const localReaction = userReaction ?? null;
    const localTotalReacts = totalReacts ?? initialTotalReacts;

    const hoverTimeout = useRef<NodeJS.Timeout | null>(null);
    const leaveTimeout = useRef<NodeJS.Timeout | null>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize store with post data
    useEffect(() => {
        initPostReaction(post._id, initialTotalReacts);
    }, [post._id, initialTotalReacts, initPostReaction]);

    // Subscribe to post updates when component mounts
    useEffect(() => {
        if (!socketReaction || !post._id) return;

        socketReaction.emit('post:subscribe', { postId: post._id });

        // Listen for reaction updates from server (authoritative)
        const handleReactionUpdated = (data: {
            postId: string;
            userId: string;
            action: string;
            type: ReactionType;
            totalReacts: number;
        }) => {
            if (data.postId === post._id) {
                // Server is authoritative for totalReacts
                setFromServer(post._id, data.totalReacts);
            }
        };

        // Listen for own reaction result
        const handleReactionResult = (data: {
            success: boolean;
            postId: string;
            action: string;
            totalReacts: number;
        }) => {
            if (data.postId === post._id && data.success) {
                // Server confirmed - use authoritative count
                setFromServer(post._id, data.totalReacts);
            }
        };

        socketReaction.on('reaction:updated', handleReactionUpdated);
        socketReaction.on('reaction:result', handleReactionResult);

        return () => {
            socketReaction.emit('post:unsubscribe', { postId: post._id });
            socketReaction.off('reaction:updated', handleReactionUpdated);
            socketReaction.off('reaction:result', handleReactionResult);
        };
    }, [socketReaction, post._id, setFromServer]);

    // Set initial reaction from API (ONLY if no local updates)
    useEffect(() => {
        if (post && post.reactInfo) {
            // Use setFromApi which won't overwrite if hasLocalUpdate is true
            setFromApi(post._id, post.reactInfo.type as StoreReactionType);
        }
    }, [post._id, setFromApi, post, post.reactInfo]);

    const handleMouseEnter = () => {
        if (leaveTimeout.current) {
            clearTimeout(leaveTimeout.current);
            leaveTimeout.current = null;
        }
        hoverTimeout.current = setTimeout(() => {
            setShowReactions(true);
        }, 500);
    };

    const handleMouseLeave = () => {
        if (hoverTimeout.current) {
            clearTimeout(hoverTimeout.current);
            hoverTimeout.current = null;
        }
        leaveTimeout.current = setTimeout(() => {
            setShowReactions(false);
        }, 300);
    };

    const handleReactionSelect = useCallback((type: ReactionType) => {
        setShowReactions(false);

        // Get current state from store (always up to date)
        const currentState = useReactionStore.getState().postReactions[post._id];
        const currentReaction = currentState?.userReaction;
        const currentTotal = currentState?.totalReacts ?? initialTotalReacts;

        // Calculate new state
        let newReaction: StoreReactionType | null;
        let newTotal: number;

        if (currentReaction === type) {
            // Remove reaction
            newReaction = null;
            newTotal = Math.max(0, currentTotal - 1);
        } else if (!currentReaction) {
            // Add new reaction
            newReaction = type as StoreReactionType;
            newTotal = currentTotal + 1;
        } else {
            // Change reaction type (total stays same)
            newReaction = type as StoreReactionType;
            newTotal = currentTotal;
        }

        // Update global store immediately (optimistic) - marks hasLocalUpdate = true
        setPostReaction(post._id, {
            userReaction: newReaction,
            totalReacts: newTotal
        });

        // Cancel previous debounce
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        // Debounce - only send the FINAL state after user stops clicking
        debounceRef.current = setTimeout(() => {
            if (socketReaction?.connected) {
                socketReaction.emit('reaction:toggle', { postId: post._id, type });
            }
        }, 400);
    }, [post._id, socketReaction, setPostReaction, initialTotalReacts]);

    const handleClick = () => {
        handleReactionSelect("LIKE");
    };

    const currentReactionData = REACTIONS.find((r) => r.type === localReaction);

    // Reels variant
    if (variant === 'reels') {
        return (
            <ClickAwayListener onClickAway={() => setShowReactions(false)}>
                <Box
                    sx={{ position: "relative", display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 999 }}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    {/* Reaction Picker Popup for Reels */}
                    <Grow in={showReactions}>
                        <Box
                            sx={{
                                position: "absolute",
                                bottom: "100%",
                                left: "50%",
                                transform: "translateX(-50%)",
                                mb: 1,
                                display: "flex",
                                gap: 1,
                                bgcolor: "background.paper",
                                borderRadius: 5,
                                px: 1,
                                py: 0.5,
                                boxShadow: isDark ? "0 2px 12px rgba(0,0,0,0.5)" : "0 2px 12px rgba(0,0,0,0.15)",
                                zIndex: 1000,
                            }}
                            onMouseEnter={() => {
                                if (leaveTimeout.current) {
                                    clearTimeout(leaveTimeout.current);
                                    leaveTimeout.current = null;
                                }
                            }}
                            onMouseLeave={handleMouseLeave}
                        >
                            {REACTIONS.map((reaction) => (
                                <Tooltip key={reaction.type} title={reaction.label} placement="top">
                                    <Box
                                        onClick={() => handleReactionSelect(reaction.type)}
                                        sx={{
                                            fontSize: 28,
                                            cursor: "pointer",
                                            transition: "transform 0.2s",
                                            "&:hover": {
                                                transform: "scale(1.3)",
                                            },
                                        }}
                                    >
                                        {reaction.emoji}
                                    </Box>
                                </Tooltip>
                            ))}
                        </Box>
                    </Grow>

                    {/* Reels Icon Button */}
                    <Box
                        onClick={handleClick}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: 'rgba(255,255,255,0.15)',
                            color: 'white',
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
                            cursor: "pointer",
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
                            userSelect: "none",
                        }}
                    >
                        {localReaction ? (
                            <Typography sx={{ fontSize: 24 }}>{currentReactionData?.emoji}</Typography>
                        ) : (
                            <ThumbUpOutlinedIcon sx={{ fontSize: 24, color: 'white' }} />
                        )}
                    </Box>
                    <Typography sx={{ color: 'white', fontSize: 13, mt: 0.5 }}>
                        {localTotalReacts > 0 ? localTotalReacts.toLocaleString() : ''}
                    </Typography>
                </Box>
            </ClickAwayListener>
        );
    }

    // Default variant
    return (
        <ClickAwayListener onClickAway={() => setShowReactions(false)}>
            <Box
                sx={{ position: "relative", flex: 1 }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {/* Reaction Picker Popup */}
                <Grow in={showReactions}>
                    <Box
                        sx={{
                            position: "absolute",
                            bottom: "100%",
                            left: "0",
                            transform: "translateX(-50%)",
                            mb: 1,
                            display: "flex",
                            gap: 2,
                            bgcolor: "background.paper",
                            borderRadius: 5,
                            px: 1,
                            py: 0.5,
                            boxShadow: isDark ? "0 2px 12px rgba(0,0,0,0.5)" : "0 2px 12px rgba(0,0,0,0.15)",
                            zIndex: 999,
                        }}
                        onMouseEnter={() => {
                            if (leaveTimeout.current) {
                                clearTimeout(leaveTimeout.current);
                                leaveTimeout.current = null;
                            }
                        }}
                        onMouseLeave={handleMouseLeave}
                    >
                        {REACTIONS.map((reaction) => (
                            <Tooltip key={reaction.type} title={reaction.label} placement="top">
                                <Box
                                    onClick={() => handleReactionSelect(reaction.type)}
                                    sx={{
                                        fontSize: 35,
                                        cursor: "pointer",
                                        transition: "transform 0.2s",
                                        "&:hover": {
                                            transform: "scale(1.3)",
                                        },
                                    }}
                                >
                                    {reaction.emoji}
                                </Box>
                            </Tooltip>
                        ))}
                    </Box>
                </Grow>

                {/* Main Button */}
                <Box
                    onClick={handleClick}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 1,
                        py: 1,
                        px: 2,
                        borderRadius: 2,
                        cursor: "pointer",
                        color: currentReactionData?.color || (isDark ? 'text.secondary' : '#65676b'),
                        "&:hover": { bgcolor: hoverBg },
                        userSelect: "none",
                    }}
                >
                    {localReaction ? (
                        <Typography sx={{ fontSize: 20 }}>{currentReactionData?.emoji}</Typography>
                    ) : (
                        <ThumbUpOutlinedIcon sx={{ fontSize: 20 }} />
                    )}
                    <Typography
                        sx={{
                            fontWeight: 600,
                            fontSize: 15,
                            color: currentReactionData?.color || (isDark ? 'text.secondary' : '#65676b'),
                        }}
                    >
                        {currentReactionData?.label || "Thích"}
                    </Typography>
                </Box>
            </Box>
        </ClickAwayListener>
    );
}
