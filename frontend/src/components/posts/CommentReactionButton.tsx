"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Box, Typography, Tooltip, Grow, ClickAwayListener } from "@mui/material";
import { useGetUserCommentReaction } from "@/queries/useCommentQueries";
import { CommentReactionType } from "@/types/comment";
import { useSocket } from "@/contexts/SocketContext";
import { useCommentReactionStore, CommentReactionType as StoreReactionType } from "@/stores/useCommentReactionStore";

// Reaction data with emoji, label, and color
const REACTIONS = [
    { type: "LIKE" as CommentReactionType, emoji: "👍", label: "Thích", color: "#1877f2" },
    { type: "LOVE" as CommentReactionType, emoji: "❤️", label: "Yêu thích", color: "#f33e58" },
    { type: "HAHA" as CommentReactionType, emoji: "😆", label: "Haha", color: "#f7b125" },
    { type: "WOW" as CommentReactionType, emoji: "😮", label: "Wow", color: "#f7b125" },
    { type: "SAD" as CommentReactionType, emoji: "😢", label: "Buồn", color: "#f7b125" },
    { type: "ANGRY" as CommentReactionType, emoji: "😡", label: "Phẫn nộ", color: "#e9710f" },
];

interface CommentReactionButtonProps {
    commentId: string;
    initialTotalLikes?: number;
}

export default function CommentReactionButton({
    commentId,
    initialTotalLikes = 0
}: CommentReactionButtonProps) {
    const [showReactions, setShowReactions] = useState(false);

    const { socketReaction } = useSocket();

    // Use global store for reaction state
    const { commentReactions, setCommentReaction, initCommentReaction, setFromApi, setFromServer } = useCommentReactionStore();
    const reactionState = commentReactions[commentId];

    // Local state derived from global store
    const localReaction = reactionState?.userReaction ?? null;
    const localTotalLikes = reactionState?.totalLikes ?? initialTotalLikes;

    // Fetch user's reaction for this comment (initial load)
    const { data: userReactionData, isLoading } = useGetUserCommentReaction(commentId);
    const hoverTimeout = useRef<NodeJS.Timeout | null>(null);
    const leaveTimeout = useRef<NodeJS.Timeout | null>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize store with comment data
    useEffect(() => {
        initCommentReaction(commentId, initialTotalLikes);
    }, [commentId, initialTotalLikes, initCommentReaction]);

    // Subscribe to comment reaction updates
    useEffect(() => {
        if (!socketReaction || !commentId) return;

        // Listen for own reaction result
        const handleCommentReactionResult = (data: {
            success: boolean;
            commentId: string;
            action: string;
            totalLikes: number;
        }) => {
            if (data.commentId === commentId && data.success) {
                // Server confirmed - use authoritative count
                setFromServer(commentId, data.totalLikes);
            }
        };

        socketReaction.on('comment:reaction:result', handleCommentReactionResult);

        return () => {
            socketReaction.off('comment:reaction:result', handleCommentReactionResult);
        };
    }, [socketReaction, commentId, setFromServer]);

    // Set initial reaction from API (ONLY if no local updates)
    useEffect(() => {
        if (!isLoading && userReactionData) {
            // Use setFromApi which won't overwrite if hasInteracted is true
            setFromApi(commentId, userReactionData.type as StoreReactionType);
        }
    }, [userReactionData, isLoading, commentId, setFromApi]);

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

    const handleReactionSelect = useCallback((type: CommentReactionType) => {
        setShowReactions(false);

        // Get current state from store (always up to date)
        const currentState = useCommentReactionStore.getState().commentReactions[commentId];
        const currentReaction = currentState?.userReaction;
        const currentTotal = currentState?.totalLikes ?? initialTotalLikes;

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

        // Update global store immediately (optimistic)
        setCommentReaction(commentId, {
            userReaction: newReaction,
            totalLikes: newTotal
        });

        // Cancel previous debounce
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        // Debounce - only send the FINAL state after user stops clicking
        debounceRef.current = setTimeout(() => {
            if (socketReaction?.connected) {
                socketReaction.emit('comment:reaction:toggle', {
                    commentId,
                    type
                });
            }
        }, 400);
    }, [commentId, socketReaction, setCommentReaction, initialTotalLikes]);

    const handleClick = () => {
        handleReactionSelect("LIKE");
    };

    const currentReactionData = REACTIONS.find((r) => r.type === localReaction);

    return (
        <ClickAwayListener onClickAway={() => setShowReactions(false)}>
            <Box
                sx={{ position: "relative", display: "inline-block" }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {/* Reaction Picker Popup */}
                <Grow in={showReactions}>
                    <Box
                        sx={{
                            position: "absolute",
                            bottom: "100%",
                            left: "50%",
                            transform: "translateX(-50%)",
                            mb: 0.5,
                            display: "flex",
                            gap: 0.5,
                            bgcolor: "white",
                            borderRadius: 4,
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
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleReactionSelect(reaction.type);
                                    }}
                                    sx={{
                                        fontSize: 22,
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
                        display: localReaction ? "inline-flex" : "flex",
                        alignItems: "center",
                        gap: 0.5,
                        cursor: "pointer",
                        userSelect: "none",
                    }}
                >
                    {localReaction ? (
                        <Typography sx={{ fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                            {currentReactionData?.emoji}
                        </Typography>
                    ) : null}
                    <Typography
                        sx={{
                            fontSize: 12,
                            color: currentReactionData?.color || "#65676b",
                            fontWeight: 600,
                            "&:hover": { textDecoration: "underline" },
                        }}
                    >
                        {currentReactionData?.label || "Thích"}
                    </Typography>
                    {localTotalLikes > 0 && (
                        <Typography sx={{ fontSize: 11, color: "#65676b", lineHeight: 1, ml: 0.5 }}>
                            ({localTotalLikes})
                        </Typography>
                    )}
                </Box>
            </Box>
        </ClickAwayListener>
    );
}
