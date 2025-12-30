"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Box, Typography, Tooltip, Grow, ClickAwayListener } from "@mui/material";
import { ThumbUpOutlined as ThumbUpOutlinedIcon } from "@mui/icons-material";
import { useGetUserReaction } from "@/queries/useReactionQueries";
import { ReactionType } from "@/types/reaction";
import { useSocket } from "@/contexts/SocketContext";
import { useReactionStore, ReactionType as StoreReactionType } from "@/stores/useReactionStore";

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
    postId: string;
    initialTotalReacts?: number;
}

export default function ReactionButton({ postId, initialTotalReacts = 0 }: ReactionButtonProps) {
    const [showReactions, setShowReactions] = useState(false);

    const { socketReaction } = useSocket();

    // Use global store for reaction state
    const { postReactions, setPostReaction, initPostReaction, setFromApi, setFromServer } = useReactionStore();
    const reactionState = postReactions[postId];

    // Local state derived from global store
    const localReaction = reactionState?.userReaction ?? null;
    const localTotalReacts = reactionState?.totalReacts ?? initialTotalReacts;

    // Fetch user's reaction for this post (initial load)
    const { data: userReactionData, isLoading } = useGetUserReaction(postId);
    const hoverTimeout = useRef<NodeJS.Timeout | null>(null);
    const leaveTimeout = useRef<NodeJS.Timeout | null>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize store with post data
    useEffect(() => {
        initPostReaction(postId, initialTotalReacts);
    }, [postId, initialTotalReacts, initPostReaction]);

    // Subscribe to post updates when component mounts
    useEffect(() => {
        if (!socketReaction || !postId) return;

        socketReaction.emit('post:subscribe', { postId });

        // Listen for reaction updates from server (authoritative)
        const handleReactionUpdated = (data: {
            postId: string;
            userId: string;
            action: string;
            type: ReactionType;
            totalReacts: number;
        }) => {
            if (data.postId === postId) {
                // Server is authoritative for totalReacts
                setFromServer(postId, data.totalReacts);
            }
        };

        // Listen for own reaction result
        const handleReactionResult = (data: {
            success: boolean;
            postId: string;
            action: string;
            totalReacts: number;
        }) => {
            if (data.postId === postId && data.success) {
                // Server confirmed - use authoritative count
                setFromServer(postId, data.totalReacts);
            }
        };

        socketReaction.on('reaction:updated', handleReactionUpdated);
        socketReaction.on('reaction:result', handleReactionResult);

        return () => {
            socketReaction.emit('post:unsubscribe', { postId });
            socketReaction.off('reaction:updated', handleReactionUpdated);
            socketReaction.off('reaction:result', handleReactionResult);
        };
    }, [socketReaction, postId, setFromServer]);

    // Set initial reaction from API (ONLY if no local updates)
    useEffect(() => {
        if (!isLoading && userReactionData) {
            // Use setFromApi which won't overwrite if hasLocalUpdate is true
            setFromApi(postId, userReactionData.type as StoreReactionType);
        }
    }, [userReactionData, isLoading, postId, setFromApi]);

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
        const currentState = useReactionStore.getState().postReactions[postId];
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
        setPostReaction(postId, {
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
                socketReaction.emit('reaction:toggle', { postId, type });
            }
        }, 400);
    }, [postId, socketReaction, setPostReaction, initialTotalReacts]);

    const handleClick = () => {
        handleReactionSelect("LIKE");
    };

    const currentReactionData = REACTIONS.find((r) => r.type === localReaction);

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
                            bgcolor: "white",
                            borderRadius: 5,
                            px: 1,
                            py: 0.5,
                            boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
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
                        color: currentReactionData?.color || "#65676b",
                        "&:hover": { bgcolor: "#f0f2f5" },
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
                            color: currentReactionData?.color || "#65676b",
                        }}
                    >
                        {currentReactionData?.label || "Thích"}
                    </Typography>
                </Box>
            </Box>
        </ClickAwayListener>
    );
}
