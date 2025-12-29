"use client";

import { useState, useRef, KeyboardEvent } from "react";
import {
    Box,
    Avatar,
    Typography,
    IconButton,
    InputBase,
    CircularProgress,
    Button,
    Menu,
    MenuItem,
} from "@mui/material";
import {
    Send as SendIcon,
    Mood as MoodIcon,
    MoreHoriz as MoreIcon,
    Reply as ReplyIcon,
} from "@mui/icons-material";
import { useAuthStore } from "@/stores/useAuthStore";
import {
    useGetComments,
    useCreateComment,
    useDeleteComment,
    useGetReplies,
} from "@/queries/useCommentQueries";
import { Comment } from "@/types/comment";
import { timeAgo } from "@/utils/formatDate";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

interface CommentSectionProps {
    postId: string;
    totalComments?: number;
    onCommentCountChange?: (count: number) => void;
}

// Single Comment Item Component
function CommentItem({
    comment,
    postId,
    onReply,
    depth = 0,
}: {
    comment: Comment;
    postId: string;
    onReply: (commentId: string, userName: string) => void;
    depth?: number;
}) {
    const { user } = useAuthStore();
    const [showReplies, setShowReplies] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const deleteComment = useDeleteComment();
    const { data: repliesData, fetchNextPage, hasNextPage, isFetchingNextPage } = useGetReplies(
        comment._id,
        showReplies
    );

    const isOwner = user?.id === comment?.userId?._id;
    const replies = repliesData?.pages?.flatMap((page) => page?.data || []) || [];
    const userName = comment?.userId ? `${comment.userId.firstName || ''} ${comment.userId.lastName || ''}`.trim() : 'Người dùng';

    const handleDelete = async () => {
        setMenuAnchor(null);
        await deleteComment.mutateAsync(comment._id);
    };

    // Guard against undefined comment
    if (!comment || !comment._id) return null;

    return (
        <Box sx={{ display: "flex", gap: 1, mb: 1.5 }}>
            <Avatar
                src={comment?.userId?.avatar || ""}
                sx={{ width: depth > 0 ? 28 : 32, height: depth > 0 ? 28 : 32 }}
            >
                {comment?.userId?.firstName?.[0] || 'U'}
            </Avatar>
            <Box sx={{ flex: 1 }}>
                <Box
                    sx={{
                        bgcolor: "#f0f2f5",
                        borderRadius: 2,
                        px: 1.5,
                        py: 1,
                        display: "inline-block",
                        maxWidth: "100%",
                    }}
                >
                    <Typography sx={{ fontWeight: 600, fontSize: 13, color: "#050505" }}>
                        {userName}
                    </Typography>
                    <Typography sx={{ fontSize: 14, color: "#050505", whiteSpace: "pre-wrap" }}>
                        {comment.content}
                    </Typography>
                    {comment.image && (
                        <Box
                            component="img"
                            src={comment.image}
                            sx={{ maxWidth: 200, borderRadius: 1, mt: 1 }}
                        />
                    )}
                </Box>

                {/* Actions */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 0.5, px: 1 }}>
                    <Typography
                        sx={{
                            fontSize: 12,
                            color: "#65676b",
                            fontWeight: 600,
                            cursor: "pointer",
                            "&:hover": { textDecoration: "underline" },
                        }}
                    >
                        Thích
                    </Typography>
                    <Typography
                        onClick={() => onReply(comment._id, userName)}
                        sx={{
                            fontSize: 12,
                            color: "#65676b",
                            fontWeight: 600,
                            cursor: "pointer",
                            "&:hover": { textDecoration: "underline" },
                        }}
                    >
                        Phản hồi
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: "#65676b" }}>
                        {timeAgo(comment.createdAt)}
                    </Typography>
                    {isOwner && (
                        <>
                            <IconButton
                                size="small"
                                onClick={(e) => setMenuAnchor(e.currentTarget)}
                                sx={{ ml: "auto" }}
                            >
                                <MoreIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                            <Menu
                                anchorEl={menuAnchor}
                                open={Boolean(menuAnchor)}
                                onClose={() => setMenuAnchor(null)}
                            >
                                <MenuItem onClick={handleDelete}>Xóa</MenuItem>
                            </Menu>
                        </>
                    )}
                </Box>

                {/* Show replies toggle */}
                {comment.totalReplies > 0 && !showReplies && (
                    <Typography
                        onClick={() => setShowReplies(true)}
                        sx={{
                            fontSize: 13,
                            color: "#65676b",
                            fontWeight: 600,
                            cursor: "pointer",
                            mt: 0.5,
                            px: 1,
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                            "&:hover": { textDecoration: "underline" },
                        }}
                    >
                        <ReplyIcon sx={{ fontSize: 14, transform: "scaleX(-1)" }} />
                        Xem {comment.totalReplies} phản hồi
                    </Typography>
                )}

                {/* Replies */}
                {showReplies && (
                    <Box sx={{ mt: 1, ml: 1 }}>
                        {replies.map((reply) => (
                            <CommentItem
                                key={reply._id}
                                comment={reply}
                                postId={postId}
                                onReply={onReply}
                                depth={depth + 1}
                            />
                        ))}
                        {hasNextPage && (
                            <Button
                                size="small"
                                onClick={() => fetchNextPage()}
                                disabled={isFetchingNextPage}
                                sx={{ fontSize: 12, textTransform: "none" }}
                            >
                                {isFetchingNextPage ? "Đang tải..." : "Xem thêm phản hồi"}
                            </Button>
                        )}
                    </Box>
                )}
            </Box>
        </Box>
    );
}

export default function CommentSection({ postId, totalComments, onCommentCountChange }: CommentSectionProps) {
    const { user } = useAuthStore();
    const [commentText, setCommentText] = useState("");
    const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const { data: commentsData, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useGetComments(postId);
    const createComment = useCreateComment();

    const comments = commentsData?.pages?.flatMap((page) => page?.data || [])?.filter(Boolean) || [];

    const handleSubmit = async () => {
        if (!commentText.trim()) return;

        try {
            await createComment.mutateAsync({
                postId,
                content: commentText.trim(),
                parentId: replyTo?.id,
            });
            setCommentText("");
            setReplyTo(null);
            if (totalComments !== undefined) {
                onCommentCountChange?.(totalComments + 1);
            }
        } catch (error) {
            console.error("Failed to create comment:", error);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleReply = (commentId: string, userName: string) => {
        setReplyTo({ id: commentId, name: userName });
        inputRef.current?.focus();
    };

    const handleEmojiSelect = (emoji: { native: string }) => {
        setCommentText((prev) => prev + emoji.native);
    };

    return (
        <Box sx={{ px: 2, pb: 2 }}>
            {/* Comments List */}
            {isLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                    <CircularProgress size={24} />
                </Box>
            ) : (
                <>
                    {comments.map((comment, index) => (
                        <CommentItem
                            key={index}
                            comment={comment}
                            postId={postId}
                            onReply={handleReply}
                        />
                    ))}
                    {hasNextPage && (
                        <Button
                            size="small"
                            onClick={() => fetchNextPage()}
                            disabled={isFetchingNextPage}
                            sx={{ fontSize: 13, textTransform: "none", color: "#65676b" }}
                        >
                            {isFetchingNextPage ? "Đang tải..." : "Xem thêm bình luận"}
                        </Button>
                    )}
                </>
            )}

            {/* Reply indicator */}
            {replyTo && (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        px: 1,
                        py: 0.5,
                        bgcolor: "#f0f2f5",
                        borderRadius: 1,
                        mb: 1,
                    }}
                >
                    <Typography sx={{ fontSize: 13, color: "#65676b" }}>
                        Đang trả lời <strong>{replyTo.name}</strong>
                    </Typography>
                    <Typography
                        onClick={() => setReplyTo(null)}
                        sx={{
                            fontSize: 13,
                            color: "#1877f2",
                            cursor: "pointer",
                            ml: "auto",
                            "&:hover": { textDecoration: "underline" },
                        }}
                    >
                        Hủy
                    </Typography>
                </Box>
            )}

            {/* Comment Input */}
            <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", position: "relative" }}>
                <Avatar src={user?.avatar} sx={{ width: 32, height: 32 }}>
                    {user?.fullName?.[0]}
                </Avatar>
                <Box
                    sx={{
                        flex: 1,
                        bgcolor: "#f0f2f5",
                        borderRadius: 3,
                        px: 1.5,
                        py: 0.5,
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                    }}
                >
                    <InputBase
                        inputRef={inputRef}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={replyTo ? `Trả lời ${replyTo.name}...` : "Viết bình luận..."}
                        multiline
                        maxRows={4}
                        sx={{ flex: 1, fontSize: 14 }}
                    />
                    <Box sx={{ display: "flex", position: "relative" }}>
                        <IconButton
                            size="small"
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        >
                            <MoodIcon sx={{ fontSize: 20, color: "#65676b" }} />
                        </IconButton>

                        {/* Emoji Picker */}
                        {showEmojiPicker && (
                            <Box
                                sx={{
                                    position: "absolute",
                                    bottom: "100%",
                                    right: 0,
                                    mb: 1,
                                    zIndex: 1300,
                                    boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
                                    borderRadius: 2,
                                    overflow: "hidden",
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Picker
                                    data={data}
                                    onEmojiSelect={handleEmojiSelect}
                                    theme="light"
                                    locale="vi"
                                    previewPosition="none"
                                />
                            </Box>
                        )}
                    </Box>
                    {commentText.trim() && (
                        <IconButton
                            size="small"
                            onClick={handleSubmit}
                            disabled={createComment.isPending}
                        >
                            {createComment.isPending ? (
                                <CircularProgress size={18} />
                            ) : (
                                <SendIcon sx={{ fontSize: 20, color: "#1877f2" }} />
                            )}
                        </IconButton>
                    )}
                </Box>
            </Box>
        </Box>
    );
}
