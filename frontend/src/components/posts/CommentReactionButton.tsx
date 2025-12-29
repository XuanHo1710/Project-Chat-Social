"use client";

import { useState, useRef, useEffect } from "react";
import { Box, Typography, Tooltip, Grow, ClickAwayListener } from "@mui/material";
import { ThumbUpOutlined as ThumbUpOutlinedIcon } from "@mui/icons-material";
import { useToggleCommentReaction, useGetUserCommentReaction } from "@/queries/useCommentQueries";
import { CommentReactionType } from "@/types/comment";

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
    totalLikes?: number;
    onReactionChange?: (totalLikes: number) => void;
}

export default function CommentReactionButton({
    commentId,
    totalLikes = 0,
    onReactionChange
}: CommentReactionButtonProps) {
    const [showReactions, setShowReactions] = useState(false);
    const [localReaction, setLocalReaction] = useState<CommentReactionType | null>(null);
    const [localTotalLikes, setLocalTotalLikes] = useState(totalLikes);

    // Fetch user's reaction for this comment
    const { data: userReactionData, isLoading } = useGetUserCommentReaction(commentId);
    const toggleReaction = useToggleCommentReaction();
    const hoverTimeout = useRef<NodeJS.Timeout | null>(null);
    const leaveTimeout = useRef<NodeJS.Timeout | null>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // Update localTotalLikes when prop changes
    useEffect(() => {
        setLocalTotalLikes(totalLikes);
    }, [totalLikes]);

    useEffect(() => {
        if (!isLoading && userReactionData) {
            setLocalReaction(userReactionData.type);
        }
    }, [userReactionData, isLoading]);

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

    const handleReactionSelect = (type: CommentReactionType) => {
        setShowReactions(false);

        // UI optimistic update
        if (localReaction === type) {
            // Remove reaction
            const newTotal = Math.max(0, localTotalLikes - 1);
            setLocalTotalLikes(newTotal);
            onReactionChange?.(newTotal);
            setLocalReaction(null);
        } else if (!localReaction) {
            // Add new reaction
            const newTotal = localTotalLikes + 1;
            setLocalTotalLikes(newTotal);
            onReactionChange?.(newTotal);
            setLocalReaction(type);
        } else {
            // Change reaction type (total stays same)
            setLocalReaction(type);
        }

        // Debounce API call
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(async () => {
            try {
                await toggleReaction.mutateAsync({ commentId, type });
            } catch (e) {
                console.error("Comment reaction error:", e);
            }
        }, 1500);
    };

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
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.5,
                        cursor: "pointer",
                        userSelect: "none",
                    }}
                >
                    {localReaction ? (
                        <Typography sx={{ fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center' }}>{currentReactionData?.emoji}</Typography>
                    ) : null}
                    <Typography
                        sx={{
                            fontSize: 12,
                            color: currentReactionData?.color || "#65676b",
                            fontWeight: 600,
                            lineHeight: 1,
                            "&:hover": { textDecoration: "underline" },
                        }}
                    >
                        {currentReactionData?.label || "Thích"}
                    </Typography>
                    {localTotalLikes > 0 && (
                        <Typography sx={{ fontSize: 11, color: "#65676b", lineHeight: 1 }}>
                            ({localTotalLikes})
                        </Typography>
                    )}
                </Box>
            </Box>
        </ClickAwayListener>
    );
}
