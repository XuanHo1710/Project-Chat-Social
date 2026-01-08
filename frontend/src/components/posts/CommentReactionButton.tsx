"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Box, Typography, Tooltip, Grow, ClickAwayListener } from "@mui/material";
import { useGetUserCommentReaction } from "@/queries/useCommentQueries";
import { Comment, CommentReactionType } from "@/types/comment";
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
    comment: Comment;
    initialTotalLikes?: number;
}

export default function CommentReactionButton({
    comment,
    initialTotalLikes = 0
}: CommentReactionButtonProps) {
    const [showReactions, setShowReactions] = useState(false);

    const { socketReaction } = useSocket();

    // Use global store for reaction state
    const { commentReactions, setCommentReaction, initCommentReaction, setFromApi, setFromServer } = useCommentReactionStore();
    const reactionState = commentReactions[comment._id];

    // Local state derived from global store
    const localReaction = reactionState?.userReaction ?? null;

    // Fetch user's reaction for this comment (initial load)
    // const { data: userReactionData, isLoading } = useGetUserCommentReaction(comment._id);
    const hoverTimeout = useRef<NodeJS.Timeout | null>(null);
    const leaveTimeout = useRef<NodeJS.Timeout | null>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize store with comment data
    useEffect(() => {
        initCommentReaction(comment._id, initialTotalLikes);
    }, [comment._id, initialTotalLikes, initCommentReaction]);

    // Subscribe to comment reaction updates
    useEffect(() => {
        if (!socketReaction || !comment._id) return;

        // Listen for own reaction result
        const handleCommentReactionResult = (data: {
            success: boolean;
            commentId: string;
            action: string;
            totalLikes: number;
        }) => {
            if (data.commentId === comment._id && data.success) {
                // Server confirmed - use authoritative count
                setFromServer(comment._id, data.totalLikes);
            }
        };

        socketReaction.on('comment:reaction:result', handleCommentReactionResult);

        return () => {
            socketReaction.off('comment:reaction:result', handleCommentReactionResult);
        };
    }, [socketReaction, comment._id, setFromServer]);

    // Set initial reaction from API (ONLY if no local updates)
    useEffect(() => {
        if (comment.reactInfo) {
            // Use setFromApi which won't overwrite if hasInteracted is true
            setFromApi(comment._id, comment.reactInfo.type as StoreReactionType);
        }
    }, [comment, setFromApi]);

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
        const currentState = useCommentReactionStore.getState().commentReactions[comment._id];
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
        setCommentReaction(comment._id, {
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
                    commentId: comment._id,
                    type
                });
            }
        }, 400);
    }, [comment._id, socketReaction, setCommentReaction, initialTotalLikes]);

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
                </Box>
            </Box>
        </ClickAwayListener>
    );
}
