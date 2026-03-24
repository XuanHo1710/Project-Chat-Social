"use client";

import React, { useState, useRef, KeyboardEvent } from "react";
import {
    Box,
    Avatar,
    Typography,
    IconButton,
    CircularProgress,
    Portal,
    LinearProgress,
    useTheme,
} from "@mui/material";
import {
    Send as SendIcon,
    Mood as MoodIcon,
    PhotoLibrary as PhotoIcon,
    Close as CloseIcon,
    PlayCircle as PlayIcon,
} from "@mui/icons-material";
import { useAuthStore } from "@/stores/useAuthStore";
import {
    useGetComments,
    useCreateComment,
} from "@/queries/useCommentQueries";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { UploadMediaFiles } from "@/utils/uploadImage";
import CommentItem from "@/components/posts/CommentItem";
import MentionInput from "@/components/posts/MentionInput";
import { useTranslation } from "react-i18next";



interface CommentSectionProps {
    postId: string;
    totalComments?: number;
    onCommentCountChange?: (count: number) => void;
    onChangeTotalComments?: (count: number) => void;
    highlightCommentId?: string;
}



export default function CommentSection({ postId, totalComments, onCommentCountChange, onChangeTotalComments, highlightCommentId }: CommentSectionProps) {
    const { user } = useAuthStore();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const inputBg = isDark ? 'rgba(255,255,255,0.1)' : '#f0f2f5';
    const [commentText, setCommentText] = useState("");
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [emojiAnchorEl, setEmojiAnchorEl] = useState<HTMLElement | null>(null);
    const [mediaPreviews, setMediaPreviews] = useState<Array<{ file: File; preview: string; type: 'IMAGE' | 'VIDEO' }>>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { t } = useTranslation();

    const { data: commentsData, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useGetComments(postId);
    const createComment = useCreateComment();

    const comments = commentsData?.pages?.flatMap((page) => page?.data || [])?.filter(Boolean) || [];

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;
        const newPreviews = Array.from(files).map(file => ({
            file,
            preview: URL.createObjectURL(file),
            type: file.type.startsWith('video/') ? 'VIDEO' as const : 'IMAGE' as const
        }));
        setMediaPreviews(prev => [...prev, ...newPreviews]);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleRemoveMedia = (index: number) => {
        setMediaPreviews(prev => {
            const removed = prev[index];
            if (removed) URL.revokeObjectURL(removed.preview);
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleSubmit = async () => {
        if (!commentText.trim() && mediaPreviews.length === 0) return;

        try {
            let media = undefined;

            if (mediaPreviews.length > 0) {
                setIsUploading(true);
                setUploadProgress(0);
                const files = mediaPreviews.map(m => m.file);
                const results = await UploadMediaFiles(files, (progress) => setUploadProgress(progress));
                media = results.map((result, i) => ({
                    mediaType: mediaPreviews[i].type,
                    url: result.url,
                    publicId: result.publicId,
                    width: result.width,
                    height: result.height,
                }));
                setIsUploading(false);
            }

            await createComment.mutateAsync({
                postId,
                content: commentText.trim(),
                media,
            });

            setCommentText("");
            mediaPreviews.forEach(m => URL.revokeObjectURL(m.preview));
            setMediaPreviews([]);
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

    const handleReplyClick = (commentId: string) => {
        if (commentId === activeReplyId || !commentId) {
            setActiveReplyId(null);
        } else {
            setActiveReplyId(commentId);
        }
    };

    const handleReplySuccess = () => {
        setActiveReplyId(null);
        if (totalComments !== undefined) {
            onCommentCountChange?.(totalComments + 1);
            onChangeTotalComments?.(totalComments + 1);
        }
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

    const hasContent = commentText.trim() || mediaPreviews.length > 0;
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
                            activeReplyId={activeReplyId}
                            onReplyClick={handleReplyClick}
                            onReplySuccess={handleReplySuccess}
                            isHighlighted={comment._id === highlightCommentId}
                        />
                    ))}
                    {hasNextPage && (
                        <Typography
                            onClick={() => !isFetchingNextPage && fetchNextPage()}
                            sx={{
                                fontSize: 14,
                                color: "text.secondary",
                                fontWeight: 600,
                                cursor: isFetchingNextPage ? "default" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5,
                                py: 1,
                                "&:hover": { textDecoration: isFetchingNextPage ? "none" : "underline" },
                            }}
                        >
                            {isFetchingNextPage ? (
                                <CircularProgress size={14} sx={{ color: "text.secondary" }} />
                            ) : null}
                            {isFetchingNextPage ? t('common.loading') : t('post.view_more_comments')}
                        </Typography>
                    )}
                </>
            )}

            {/* Media Previews for main input */}
            {mediaPreviews.length > 0 && (
                <Box sx={{ mb: 1 }}>
                    {isUploading && (
                        <Box sx={{ mb: 0.5 }}>
                            <LinearProgress variant="determinate" value={uploadProgress} sx={{ borderRadius: 1 }} />
                            <Typography sx={{ fontSize: 11, color: 'text.secondary', textAlign: 'center' }}>
                                {t('common.uploading')} {uploadProgress}%
                            </Typography>
                        </Box>
                    )}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {mediaPreviews.map((media, index) => (
                            <Box key={index} sx={{ position: 'relative', display: 'inline-block' }}>
                                {media.type === 'VIDEO' ? (
                                    <Box sx={{ position: 'relative' }}>
                                        <video src={media.preview} style={{ maxWidth: 100, maxHeight: 100, borderRadius: 8 }} />
                                        <PlayIcon sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 28, color: 'white' }} />
                                    </Box>
                                ) : (
                                    <Box component="img" src={media.preview} sx={{ width: 100, height: 100, borderRadius: 2, objectFit: 'cover' }} />
                                )}
                                <IconButton
                                    size="small"
                                    onClick={() => handleRemoveMedia(index)}
                                    sx={{
                                        position: 'absolute',
                                        top: -6,
                                        right: -6,
                                        bgcolor: 'rgba(0,0,0,0.6)',
                                        color: 'white',
                                        '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
                                        width: 18,
                                        height: 18,
                                    }}
                                >
                                    <CloseIcon sx={{ fontSize: 12 }} />
                                </IconButton>
                            </Box>
                        ))}
                    </Box>
                </Box>
            )}

            {/* Main Comment Input */}
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", position: "relative" }}>
                <Avatar src={user?.avatar} sx={{ width: 32, height: 32 }}>
                    {user?.fullName?.[0]}
                </Avatar>
                <Box
                    sx={{
                        flex: 1,
                        bgcolor: inputBg,
                        borderRadius: 3,
                        px: 1.5,
                        py: 0.5,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                    }}
                >
                    <MentionInput
                        inputRef={inputRef}
                        value={commentText}
                        onChange={(val) => setCommentText(val)}
                        onKeyDown={handleKeyDown}
                        placeholder={t('post.write_comment')}
                        multiline
                        maxRows={4}
                    />
                    <IconButton
                        size="small"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                    >
                        <PhotoIcon sx={{ fontSize: 20, color: "text.secondary" }} />
                    </IconButton>
                    <IconButton
                        size="small"
                        onClick={handleEmojiClick}
                    >
                        <MoodIcon sx={{ fontSize: 20, color: "text.secondary" }} />
                    </IconButton>
                </Box>
                <IconButton
                    size="small"
                    onClick={handleSubmit}
                    disabled={!hasContent || isSubmitting}
                >
                    {isSubmitting ? (
                        <CircularProgress size={18} sx={{ color: 'primary.main' }} />
                    ) : (
                        <SendIcon sx={{ fontSize: 20, color: hasContent ? "primary.main" : "text.disabled" }} />
                    )}
                </IconButton>
            </Box>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileSelect}
                style={{ display: 'none' }}
            />

            {/* Emoji Picker */}
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
                            theme={isDark ? "dark" : "light"}
                            locale="vi"
                            previewPosition="none"
                        />
                    </Box>
                </Portal>
            )
            }
        </Box >
    );
}
