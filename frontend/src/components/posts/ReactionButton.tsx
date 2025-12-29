"use client";

import { useState, useRef, useEffect } from "react";
import { Box, Typography, Tooltip, Grow, ClickAwayListener } from "@mui/material";
import { ThumbUpOutlined as ThumbUpOutlinedIcon } from "@mui/icons-material";
import { useToggleReaction, useGetUserReaction } from "@/queries/useReactionQueries";
import { ReactionType } from "@/types/reaction";
import { on } from "events";

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
    initialReaction?: ReactionType | null;
    onReactionChange: (totalReacts: number) => void;
    totalReacts: number;
}

export default function ReactionButton({ postId, initialReaction, onReactionChange, totalReacts }: ReactionButtonProps) {
    const [showReactions, setShowReactions] = useState(false);
    const [localReaction, setLocalReaction] = useState<ReactionType | null>(initialReaction || null);

    // Fetch user's reaction for this post
    const { data: userReactionData, isLoading } = useGetUserReaction(postId);
    const toggleReaction = useToggleReaction();
    const hoverTimeout = useRef<NodeJS.Timeout | null>(null);
    const leaveTimeout = useRef<NodeJS.Timeout | null>(null);


    useEffect(() => {
        const fetchLocalReaction = () => {
            if (!isLoading && userReactionData) {
                setLocalReaction(userReactionData.type);
            }
        }
        fetchLocalReaction();
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

    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    const handleReactionSelect = (type: ReactionType) => {
        setShowReactions(false);

        // UI optimistic update
        if (localReaction === type) {
            onReactionChange(totalReacts - 1);
            setLocalReaction(null);
        } else if (!localReaction) {
            onReactionChange(totalReacts + 1);
            setLocalReaction(type);
        } else {
            onReactionChange(totalReacts);
            setLocalReaction(type);
        }


        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }


        debounceRef.current = setTimeout(async () => {
            try {
                await toggleReaction.mutateAsync({ postId, type });
            } catch (e) {
                console.error("rollback needed", e);
            }
        }, 1200); // 1200ms khi người dùng không tương tác thì mới gửi request
    };


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
                            left: "50%",
                            transform: "translateX(-50%)",
                            mb: 1,
                            display: "flex",
                            gap: 0.5,
                            bgcolor: "white",
                            borderRadius: 5,
                            px: 1,
                            py: 0.5,
                            boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
                            zIndex: 100,
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
