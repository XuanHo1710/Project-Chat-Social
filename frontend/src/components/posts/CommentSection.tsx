"use client";

import React, { useState, useRef, KeyboardEvent } from "react";
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
    Portal,
    LinearProgress,
} from "@mui/material";
import {
    Send as SendIcon,
    Mood as MoodIcon,
    MoreHoriz as MoreIcon,
    Reply as ReplyIcon,
    PhotoLibrary as PhotoIcon,
    Close as CloseIcon,
    PlayCircle as PlayIcon,
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
import { UploadMediaFiles } from "@/utils/uploadImage";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";

// Helper function to render content with @mentions as links
// Format: @[userId:displayName] -> renders as clickable link to profile
function renderContentWithMentions(content: string) {
    if (!content) return null;

    // Regex to match @[userId:displayName] format
    const mentionRegex = /@\[([a-f0-9]+):([^\]]+)\]/gi;
    const parts: (string | React.ReactNode)[] = [];
    let lastIndex = 0;
    let match;
    let keyIndex = 0;

    while ((match = mentionRegex.exec(content)) !== null) {
        // Add text before the mention
        if (match.index > lastIndex) {
            parts.push(content.slice(lastIndex, match.index));
        }

        // Extract userId and displayName
        const userId = match[1];
        const displayName = match[2];

        // Add the mention as a link to user profile
        parts.push(
            <Link
                key={keyIndex++}
                href={`/profile/${userId}`}
                style={{
                    color: '#1877f2',
                    textDecoration: 'none',
                    fontWeight: 600,
                }}
                onClick={(e) => e.stopPropagation()}
            >
                @{displayName}
            </Link>
        );

        lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
        parts.push(content.slice(lastIndex));
    }

    return parts.length > 0 ? parts : content;
}

interface CommentSectionProps {
    postId: string;
    totalComments?: number;
    onCommentCountChange?: (count: number) => void;
    onChangeTotalComments?: (count: number) => void;
}

interface MediaPreview {
    file: File;
    preview: string;
    type: 'IMAGE' | 'VIDEO';
}

// Single Comment Item Component - Max 2 levels
function CommentItem({
    comment,
    postId,
    onReply,
    isReply = false,
}: {
    comment: Comment;
    postId: string;
    onReply: (parentId: string | null, userId: string, userName: string) => void;
    isReply?: boolean;
}) {
    const { user } = useAuthStore();
    const [showReplies, setShowReplies] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const deleteComment = useDeleteComment();
    const { data: repliesData, fetchNextPage, hasNextPage, isFetchingNextPage } = useGetReplies(
        comment._id,
        showReplies && !isReply // Only fetch replies for top-level comments
    );

    const isOwner = user?.id === comment?.userId?._id;
    const replies = repliesData?.pages?.flatMap((page) => page?.data || []) || [];
    const userName = comment?.userId ? `${comment.userId.firstName || ''} ${comment.userId.lastName || ''}`.trim() : 'Người dùng';

    const handleDelete = async () => {
        setMenuAnchor(null);
        await deleteComment.mutateAsync(comment._id);
        toast.success("Bình luận đã được xóa thành công");
    };

    // Guard against undefined comment
    if (!comment || !comment._id) return null;

    return (
        <Box sx={{ display: "flex", gap: 1, mb: 1.5 }}>
            <Avatar
                src={comment?.userId?.avatar || ""}
                sx={{ width: isReply ? 28 : 32, height: isReply ? 28 : 32 }}
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
                        {renderContentWithMentions(comment.content)}
                    </Typography>
                </Box>

                {/* Media display */}
                {comment.media && comment.media.length > 0 && (
                    <Box sx={{ mt: 1, maxWidth: 300 }}>
                        {comment.media.map((m, idx) => (
                            <Box key={idx} sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden' }}>
                                {m.mediaType === 'VIDEO' ? (
                                    <video
                                        src={m.url}
                                        controls
                                        style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }}
                                    />
                                ) : (
                                    <Image
                                        src={m.url}
                                        alt="comment media"
                                        width={m.width || 300}
                                        height={m.height || 200}
                                        style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8 }}
                                    />
                                )}
                            </Box>
                        ))}
                    </Box>
                )}

                {/* Legacy image support */}
                {comment.image && !comment.media?.length && (
                    <Box
                        component="img"
                        src={comment.image}
                        sx={{ maxWidth: 200, borderRadius: 1, mt: 1 }}
                    />
                )}

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
                        onClick={() => {
                            // For replies, reply to parent's parent (top-level)
                            // For top-level comments, reply to this comment
                            const replyParentId = isReply ? comment.parentId : comment._id;
                            onReply(replyParentId || null, comment.userId._id, userName);
                        }}
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

                {/* Show replies toggle - only for top-level comments */}
                {!isReply && comment.totalReplies > 0 && !showReplies && (
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

                {/* Replies - Max 1 level deep (so total 2 levels) */}
                {!isReply && showReplies && (
                    <Box sx={{ mt: 1, ml: 1 }}>
                        {replies.map((reply) => (
                            <CommentItem
                                key={reply._id}
                                comment={reply}
                                postId={postId}
                                onReply={onReply}
                                isReply={true}
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

export default function CommentSection({ postId, totalComments, onCommentCountChange, onChangeTotalComments }: CommentSectionProps) {
    const { user } = useAuthStore();
    const [commentText, setCommentText] = useState("");
    const [replyTo, setReplyTo] = useState<{ id: string | null; userId: string; name: string } | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [emojiAnchorEl, setEmojiAnchorEl] = useState<HTMLElement | null>(null);
    const [mediaPreview, setMediaPreview] = useState<MediaPreview | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data: commentsData, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useGetComments(postId);
    const createComment = useCreateComment();

    const comments = commentsData?.pages?.flatMap((page) => page?.data || [])?.filter(Boolean) || [];

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const isVideo = file.type.startsWith('video/');
        setMediaPreview({
            file,
            preview: URL.createObjectURL(file),
            type: isVideo ? 'VIDEO' : 'IMAGE',
        });

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleRemoveMedia = () => {
        if (mediaPreview) {
            URL.revokeObjectURL(mediaPreview.preview);
            setMediaPreview(null);
        }
    };

    const handleSubmit = async () => {
        if (!commentText.trim() && !mediaPreview) return;

        try {
            let media = undefined;

            // Upload media if exists
            if (mediaPreview) {
                setIsUploading(true);
                setUploadProgress(0);
                const results = await UploadMediaFiles(
                    [mediaPreview.file],
                    (progress) => setUploadProgress(progress)
                );
                if (results.length > 0) {
                    media = [{
                        mediaType: results[0].mediaType,
                        url: results[0].url,
                        publicId: results[0].publicId,
                        width: results[0].width,
                        height: results[0].height,
                    }];
                }
                setIsUploading(false);
            }

            // Convert @name to @[userId:name] format for storage
            let contentToSave = commentText.trim();
            if (replyTo && replyTo.userId && replyTo.name) {
                const displayMention = `@${replyTo.name}`;
                const storageMention = `@[${replyTo.userId}:${replyTo.name}]`;
                contentToSave = contentToSave.replace(displayMention, storageMention);
            }

            await createComment.mutateAsync({
                postId,
                content: contentToSave,
                parentId: replyTo?.id || undefined,
                media,
            });

            setCommentText("");
            setReplyTo(null);
            handleRemoveMedia();
            if (totalComments !== undefined) {
                onCommentCountChange?.(totalComments + 1);
                onChangeTotalComments?.(totalComments + 1);
            }
        } catch (error) {
            console.error("Failed to create comment:", error);
            setIsUploading(false);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleReply = (parentId: string | null, userId: string, userName: string) => {
        setReplyTo({ id: parentId, userId, name: userName });
        // Display @name in input (clean UI), will convert to @[userId:name] on submit
        setCommentText(`@${userName} `);
        inputRef.current?.focus();
    };

    const handleCancelReply = () => {
        // Remove @mention from text if it's at the beginning
        const mentionPattern = `@${replyTo?.name} `;
        if (replyTo && commentText.startsWith(mentionPattern)) {
            setCommentText(commentText.slice(mentionPattern.length));
        }
        setReplyTo(null);
    };

    const handleEmojiSelect = (emoji: { native: string }) => {
        setCommentText((prev) => prev + emoji.native);
    };

    const handleEmojiClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setEmojiAnchorEl(event.currentTarget);
        setShowEmojiPicker(!showEmojiPicker);
    };

    const handleCloseEmojiPicker = () => {
        setShowEmojiPicker(false);
        setEmojiAnchorEl(null);
    };

    const hasContent = commentText.trim() || mediaPreview;
    const isSubmitting = isUploading || createComment.isPending;

    return (
        <Box sx={{ px: 2, pb: 2, position: "relative" }}>
            {/* Comments List */}
            {isLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                    <CircularProgress size={24} />
                </Box>
            ) : (
                <>
                    {comments.map((comment) => (
                        <CommentItem
                            key={comment._id}
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
                        onClick={handleCancelReply}
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

            {/* Media Preview */}
            {mediaPreview && (
                <Box sx={{ mb: 1, position: 'relative', display: 'inline-block' }}>
                    {isUploading && (
                        <Box sx={{ mb: 0.5 }}>
                            <LinearProgress variant="determinate" value={uploadProgress} sx={{ borderRadius: 1 }} />
                            <Typography sx={{ fontSize: 11, color: '#65676b', textAlign: 'center' }}>
                                Đang tải lên... {uploadProgress}%
                            </Typography>
                        </Box>
                    )}
                    <Box sx={{ position: 'relative', display: 'inline-block' }}>
                        {mediaPreview.type === 'VIDEO' ? (
                            <Box sx={{ position: 'relative' }}>
                                <video
                                    src={mediaPreview.preview}
                                    style={{ maxWidth: 150, maxHeight: 100, borderRadius: 8 }}
                                />
                                <PlayIcon sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 32, color: 'white' }} />
                            </Box>
                        ) : (
                            <Box
                                component="img"
                                src={mediaPreview.preview}
                                sx={{ maxWidth: 150, maxHeight: 100, borderRadius: 2, objectFit: 'cover' }}
                            />
                        )}
                        <IconButton
                            size="small"
                            onClick={handleRemoveMedia}
                            sx={{
                                position: 'absolute',
                                top: -8,
                                right: -8,
                                bgcolor: 'rgba(0,0,0,0.6)',
                                color: 'white',
                                '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
                                width: 20,
                                height: 20,
                            }}
                        >
                            <CloseIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                    </Box>
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
                        gap: 0.5,
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
                    <IconButton
                        size="small"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                    >
                        <PhotoIcon sx={{ fontSize: 20, color: "#65676b" }} />
                    </IconButton>
                    <IconButton
                        size="small"
                        onClick={handleEmojiClick}
                    >
                        <MoodIcon sx={{ fontSize: 20, color: "#65676b" }} />
                    </IconButton>
                    {hasContent && (
                        <IconButton
                            size="small"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <CircularProgress size={18} sx={{ color: '#1877f2' }} />
                            ) : (
                                <SendIcon sx={{ fontSize: 20, color: "#1877f2" }} />
                            )}
                        </IconButton>
                    )}
                </Box>
            </Box>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
            />

            {/* Emoji Picker - Portal to render at top level */}
            {showEmojiPicker && emojiAnchorEl && (
                <Portal>
                    <Box
                        onClick={handleCloseEmojiPicker}
                        sx={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 1400,
                        }}
                    />
                    <Box
                        sx={{
                            position: 'fixed',
                            top: emojiAnchorEl ? `${emojiAnchorEl.getBoundingClientRect().top - 400}px` : '40%',
                            left: emojiAnchorEl ? `${emojiAnchorEl.getBoundingClientRect().left + 50}px` : '40%',
                            zIndex: 1500,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                            borderRadius: 2,
                            overflow: 'hidden',
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
                </Portal>
            )}
        </Box>
    );
}
