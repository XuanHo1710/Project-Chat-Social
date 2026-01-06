"use client";
import React, { useState, useRef, KeyboardEvent } from "react";
import {
    Box,
    Avatar,
    Typography,
    IconButton,
    CircularProgress,
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
    Close as CloseIcon,
    PlayCircle as PlayIcon,
    CameraAlt as CameraIcon,
    GifBox as GifIcon,
    Edit as EditIcon,
} from "@mui/icons-material";
import { useAuthStore } from "@/stores/useAuthStore";
import {
    useCreateComment,
    useDeleteComment,
    useGetReplies,
    useUpdateComment,
} from "@/queries/useCommentQueries";
import { Comment, CommentMedia } from "@/types/comment";
import { timeAgo } from "@/utils/formatDate";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { UploadMediaFiles } from "@/utils/uploadImage";
import Image from "next/image";
import { toast } from "sonner";
import CommentReactionButton from "./CommentReactionButton";
import ImageViewer from "./ImageViewer";
import MentionInput from "./MentionInput";
import { commentMediaToMediaItems, renderContentWithMentions } from "@/utils/hashtagParser";

// Edit Comment Input Component - Facebook style
function EditCommentInput({
    comment,
    onCancel,
    onSuccess,
}: {
    comment: Comment;
    onCancel: () => void;
    onSuccess: () => void;
}) {
    const [text, setText] = useState(comment.content);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [emojiAnchorEl, setEmojiAnchorEl] = useState<HTMLElement | null>(null);
    const [mediaPreviews, setMediaPreviews] = useState<Array<{ file: File; preview: string; type: 'IMAGE' | 'VIDEO' }>>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const updateComment = useUpdateComment();

    React.useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        const newPreviews = Array.from(files).map(file => ({
            file,
            preview: URL.createObjectURL(file),
            type: file.type.startsWith('video/') ? 'VIDEO' as const : 'IMAGE' as const
        }));
        setMediaPreviews(prev => [...prev, ...newPreviews]);
    };

    const handleRemoveMedia = (index: number) => {
        setMediaPreviews(prev => {
            const removed = prev[index];
            if (removed) URL.revokeObjectURL(removed.preview);
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleSubmit = async () => {
        if (!text.trim() && mediaPreviews.length === 0) return;

        try {
            let mediaData: CommentMedia[] | undefined;
            if (mediaPreviews.length > 0) {
                setIsUploading(true);
                const files = mediaPreviews.map(m => m.file);
                const uploadedResults = await UploadMediaFiles(files, (progress) => setUploadProgress(progress));
                mediaData = uploadedResults.map((result, i) => ({
                    url: result.url,
                    mediaType: mediaPreviews[i].type
                }));
            }
            await updateComment.mutateAsync({
                commentId: comment._id,
                data: { content: text.trim(), ...(mediaData && { media: mediaData }) },
            });
            setIsUploading(false);
            toast.success("Đã cập nhật bình luận");
            onSuccess();
        } catch (error) {
            console.error("Failed to update comment:", error);
            toast.error("Không thể cập nhật bình luận");
            setIsUploading(false);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
        if (e.key === "Escape") {
            onCancel();
        }
    };

    const handleEmojiSelect = (emoji: { native: string }) => {
        setText((prev) => prev + emoji.native);
        setShowEmojiPicker(false);
    };

    const hasContent = text.trim() || mediaPreviews.length > 0;
    const isSubmitting = isUploading || updateComment.isPending;

    return (
        <Box sx={{ flex: 1 }}>
            {/* Media Previews */}
            {mediaPreviews.length > 0 && (
                <Box sx={{ mb: 1 }}>
                    {isUploading && (
                        <Box sx={{ mb: 0.5 }}>
                            <LinearProgress variant="determinate" value={uploadProgress} sx={{ borderRadius: 1 }} />
                            <Typography sx={{ fontSize: 11, color: '#65676b', textAlign: 'center' }}>Đang tải lên... {uploadProgress}%</Typography>
                        </Box>
                    )}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {mediaPreviews.map((media, index) => (
                            <Box key={index} sx={{ position: 'relative', display: 'inline-block' }}>
                                {media.type === 'VIDEO' ? (
                                    <Box sx={{ position: 'relative' }}>
                                        <video src={media.preview} style={{ maxWidth: 80, maxHeight: 80, borderRadius: 8 }} />
                                        <PlayIcon sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 24, color: 'white' }} />
                                    </Box>
                                ) : (
                                    <Box component="img" src={media.preview} sx={{ width: 80, height: 80, borderRadius: 2, objectFit: 'cover' }} />
                                )}
                                <IconButton size="small" onClick={() => handleRemoveMedia(index)} sx={{ position: 'absolute', top: -6, right: -6, bgcolor: 'rgba(0,0,0,0.6)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' }, width: 18, height: 18 }}>
                                    <CloseIcon sx={{ fontSize: 12 }} />
                                </IconButton>
                            </Box>
                        ))}
                    </Box>
                </Box>
            )}

            {/* Edit Box Container - Light theme */}
            <Box
                sx={{
                    bgcolor: "#f0f2f5",
                    borderRadius: 2,
                    overflow: "hidden",
                }}
            >
                {/* Input Area */}
                <Box sx={{ px: 1.5, py: 1 }}>
                    <MentionInput
                        inputRef={inputRef}
                        value={text}
                        onChange={(val) => setText(val)}
                        onKeyDown={handleKeyDown}
                        placeholder="Chỉnh sửa bình luận..."
                        multiline
                        maxRows={6}
                    />
                </Box>

                {/* Bottom Bar: Icons + Send */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        px: 1,
                        py: 0.5,
                        borderTop: "1px solid #e4e6eb",
                    }}
                >
                    {/* Icons */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                setEmojiAnchorEl(e.currentTarget);
                                setShowEmojiPicker(!showEmojiPicker);
                            }}
                            sx={{ p: 0.5 }}
                        >
                            <MoodIcon sx={{ fontSize: 20, color: "#65676b" }} />
                        </IconButton>
                        <IconButton
                            size="small"
                            sx={{ p: 0.5 }}
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                        >
                            <CameraIcon sx={{ fontSize: 20, color: "#65676b" }} />
                        </IconButton>
                        <IconButton size="small" sx={{ p: 0.5 }}>
                            <GifIcon sx={{ fontSize: 20, color: "#65676b" }} />
                        </IconButton>
                    </Box>

                    {/* Send Button */}
                    <IconButton
                        size="small"
                        onClick={handleSubmit}
                        disabled={!hasContent || isSubmitting}
                        sx={{ p: 0.5 }}
                    >
                        {isSubmitting ? (
                            <CircularProgress size={20} sx={{ color: '#1877f2' }} />
                        ) : (
                            <SendIcon sx={{ fontSize: 20, color: hasContent ? "#1877f2" : "#4e4f50" }} />
                        )}
                    </IconButton>
                </Box>
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

            {/* Hint */}
            <Typography sx={{ fontSize: 12, color: "#65676b", mt: 0.5 }}>
                Nhấn Esc để{" "}
                <Typography
                    component="span"
                    onClick={onCancel}
                    sx={{
                        color: "#1877f2",
                        cursor: "pointer",
                        "&:hover": { textDecoration: "underline" },
                    }}
                >
                    hủy
                </Typography>
                .
            </Typography>

            {/* Emoji Picker */}
            {showEmojiPicker && emojiAnchorEl && (
                <Portal>
                    <Box
                        onClick={() => setShowEmojiPicker(false)}
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
                            top: emojiAnchorEl ? `${emojiAnchorEl.getBoundingClientRect().top - 350}px` : '40%',
                            left: emojiAnchorEl ? `${emojiAnchorEl.getBoundingClientRect().left}px` : '40%',
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

interface ReplyTarget {
    parentId: string;
    userId: string;
    userName: string;
}


// Inline Reply Input Component - hiển thị ngay dưới comment
function InlineReplyInput({
    postId,
    replyTarget,
    onCancel,
    onSuccess,
}: {
    postId: string;
    replyTarget: ReplyTarget;
    onCancel: () => void;
    onSuccess: () => void;
}) {
    const { user } = useAuthStore();
    // Không hiển thị @userName trong input nữa, chỉ lưu vào storage
    const [text, setText] = useState("");
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [emojiAnchorEl, setEmojiAnchorEl] = useState<HTMLElement | null>(null);
    const [mediaPreviews, setMediaPreviews] = useState<Array<{ file: File; preview: string; type: 'IMAGE' | 'VIDEO' }>>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const createComment = useCreateComment();

    React.useEffect(() => {
        inputRef.current?.focus();
    }, []);

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
        if (!text.trim() && mediaPreviews.length === 0) return;

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

            // Thêm @[userId:userName] vào đầu content khi lưu
            const storageMention = `@[${replyTarget.userId}:${replyTarget.userName}]`;
            const contentToSave = `${storageMention} ${text.trim()}`;

            await createComment.mutateAsync({
                postId,
                content: contentToSave,
                parentId: replyTarget.parentId,
                media,
            });

            setText("");
            mediaPreviews.forEach(m => URL.revokeObjectURL(m.preview));
            setMediaPreviews([]);
            onSuccess();
        } catch (error) {
            console.error("Failed to create reply:", error);
            setIsUploading(false);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
        if (e.key === "Escape") {
            onCancel();
        }
    };

    const handleEmojiSelect = (emoji: { native: string }) => {
        setText((prev) => prev + emoji.native);
    };

    const hasContent = text.trim() || mediaPreviews.length > 0;
    const isSubmitting = isUploading || createComment.isPending;

    return (
        <Box sx={{ mt: 1, ml: 4 }}>
            {/* Media Previews */}
            {mediaPreviews.length > 0 && (
                <Box sx={{ mb: 1 }}>
                    {isUploading && (
                        <Box sx={{ mb: 0.5 }}>
                            <LinearProgress variant="determinate" value={uploadProgress} sx={{ borderRadius: 1, width: 100 }} />
                        </Box>
                    )}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {mediaPreviews.map((media, index) => (
                            <Box key={index} sx={{ position: 'relative', display: 'inline-block' }}>
                                {media.type === 'VIDEO' ? (
                                    <Box sx={{ position: 'relative' }}>
                                        <video src={media.preview} style={{ maxWidth: 60, maxHeight: 60, borderRadius: 8 }} />
                                        <PlayIcon sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 16, color: 'white' }} />
                                    </Box>
                                ) : (
                                    <Box component="img" src={media.preview} sx={{ width: 60, height: 60, borderRadius: 1, objectFit: 'cover' }} />
                                )}
                                <IconButton
                                    size="small"
                                    onClick={() => handleRemoveMedia(index)}
                                    sx={{
                                        position: 'absolute',
                                        top: -4,
                                        right: -4,
                                        bgcolor: 'rgba(0,0,0,0.6)',
                                        color: 'white',
                                        '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
                                        width: 14,
                                        height: 14,
                                    }}
                                >
                                    <CloseIcon sx={{ fontSize: 8 }} />
                                </IconButton>
                            </Box>
                        ))}
                    </Box>
                </Box>
            )}

            {/* Reply Input */}
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <Avatar src={user?.avatar} sx={{ width: 24, height: 24 }}>
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
                    {/* Hiển thị @userName như badge */}
                    <Typography
                        component="span"
                        sx={{
                            color: "#1877f2",
                            fontWeight: 600,
                            fontSize: 13,
                            mr: 0.5,
                        }}
                    >
                        @{replyTarget.userName}
                    </Typography>
                    <MentionInput
                        inputRef={inputRef}
                        value={text}
                        onChange={(val) => setText(val)}
                        onKeyDown={handleKeyDown}
                        placeholder="Viết phản hồi..."
                        multiline
                        maxRows={3}
                    />
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                setEmojiAnchorEl(e.currentTarget);
                                setShowEmojiPicker(!showEmojiPicker);
                            }}
                            sx={{ p: 0.5 }}
                        >
                            <MoodIcon sx={{ fontSize: 16, color: "#65676b" }} />
                        </IconButton>
                        <IconButton
                            size="small"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            sx={{ p: 0.5 }}
                        >
                            <CameraIcon sx={{ fontSize: 16, color: "#65676b" }} />
                        </IconButton>
                        <IconButton size="small" sx={{ p: 0.5 }}>
                            <GifIcon sx={{ fontSize: 16, color: "#65676b" }} />
                        </IconButton>
                    </Box>
                </Box>
                {hasContent && (
                    <IconButton
                        size="small"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        sx={{ p: 0.5 }}
                    >
                        {isSubmitting ? (
                            <CircularProgress size={16} sx={{ color: '#1877f2' }} />
                        ) : (
                            <SendIcon sx={{ fontSize: 18, color: "#1877f2" }} />
                        )}
                    </IconButton>
                )}
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
                        onClick={() => setShowEmojiPicker(false)}
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
                            top: emojiAnchorEl ? `${emojiAnchorEl.getBoundingClientRect().top - 350}px` : '40%',
                            left: emojiAnchorEl ? `${emojiAnchorEl.getBoundingClientRect().left}px` : '40%',
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


export default function CommentItem({
    comment,
    postId,
    isReply = false,
    activeReplyId,
    onReplyClick,
    onReplySuccess,
}: {
    comment: Comment;
    postId: string;
    isReply?: boolean;
    activeReplyId: string | null;
    onReplyClick: (commentId: string, parentId: string, userId: string, userName: string) => void;
    onReplySuccess: () => void;
}) {
    const { user } = useAuthStore();
    const [showReplies, setShowReplies] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const [imageViewerIndex, setImageViewerIndex] = useState(0);
    const deleteComment = useDeleteComment();
    const { data: repliesData, fetchNextPage, hasNextPage, isFetchingNextPage } = useGetReplies(
        comment._id,
        showReplies && !isReply
    );

    const isOwner = user?.id === comment?.userId?._id;
    const replies = repliesData?.pages?.flatMap((page) => page?.data || []) || [];
    const userName = comment?.userId ? `${comment.userId.firstName || ''} ${comment.userId.lastName || ''}`.trim() : 'Người dùng';

    const replyParentId = isReply ? comment.parentId : comment._id;
    const isActiveReply = activeReplyId === comment._id;

    const handleDelete = async () => {
        setMenuAnchor(null);
        await deleteComment.mutateAsync(comment._id);
        toast.success("Bình luận đã được xóa thành công");
    };

    const handleEdit = () => {
        setMenuAnchor(null);
        setIsEditing(true);
    };

    const handleReplyClick = () => {
        onReplyClick(comment._id, replyParentId || comment._id, comment.userId._id, userName);
        if (!isReply && !showReplies) {
            setShowReplies(true);
        }
    };

    const handleImageClick = (index: number) => {
        setImageViewerIndex(index);
        setImageViewerOpen(true);
    };

    if (!comment || !comment._id) return null;

    // Get all media for ImageViewer
    const allMedia = comment.media && comment.media.length > 0
        ? commentMediaToMediaItems(comment.media)
        : comment.image
            ? [{ mediaType: 'IMAGE' as const, url: comment.image, publicId: '' }]
            : [];

    return (
        <Box sx={{ display: "flex", gap: 1, mb: 1.5 }}>
            <Avatar
                src={comment?.userId?.avatar || ""}
                sx={{ width: isReply ? 28 : 32, height: isReply ? 28 : 32 }}
            >
                {comment?.userId?.firstName?.[0] || 'U'}
            </Avatar>
            <Box sx={{ flex: 1 }}>
                {isEditing ? (
                    <EditCommentInput
                        comment={comment}
                        onCancel={() => setIsEditing(false)}
                        onSuccess={() => setIsEditing(false)}
                    />
                ) : (
                    <>
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
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <Typography sx={{ fontWeight: 600, fontSize: 13, color: "#050505" }}>
                                    {userName}
                                </Typography>
                                {comment.isEdited && (
                                    <Typography sx={{ fontSize: 11, color: "#65676b", fontStyle: "italic" }}>
                                        · Đã chỉnh sửa
                                    </Typography>
                                )}
                            </Box>
                            <Typography sx={{ fontSize: 14, color: "#050505", whiteSpace: "pre-wrap" }}>
                                {renderContentWithMentions(comment.content)}
                            </Typography>
                        </Box>

                        {/* Media display - clickable to open ImageViewer */}
                        {comment.media && comment.media.length > 0 && (
                            <Box sx={{ mt: 1, maxWidth: 300 }}>
                                {comment.media.map((m, idx) => (
                                    <Box
                                        key={idx}
                                        sx={{
                                            position: 'relative',
                                            borderRadius: 2,
                                            overflow: 'hidden',
                                            cursor: 'pointer',
                                        }}
                                        onClick={() => handleImageClick(idx)}
                                    >
                                        {m.mediaType === 'VIDEO' ? (
                                            <video
                                                src={m.url}
                                                controls
                                                style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }}
                                                onClick={(e) => e.stopPropagation()}
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

                        {/* Legacy image support - clickable */}
                        {comment.image && !comment.media?.length && (
                            <Box
                                component="img"
                                src={comment.image}
                                sx={{
                                    maxWidth: 200,
                                    borderRadius: 1,
                                    mt: 1,
                                    cursor: 'pointer',
                                }}
                                onClick={() => handleImageClick(0)}
                            />
                        )}

                        {/* ImageViewer */}
                        {allMedia.length > 0 && (
                            <ImageViewer
                                open={imageViewerOpen}
                                onClose={() => setImageViewerOpen(false)}
                                media={allMedia}
                                initialIndex={imageViewerIndex}
                            />
                        )}
                    </>
                )}

                {/* Actions */}
                {!isEditing && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 0.5, px: 1 }}>
                        <CommentReactionButton
                            commentId={comment._id}
                            initialTotalLikes={comment.totalLikes || 0}
                        />
                        <Typography
                            onClick={handleReplyClick}
                            sx={{
                                fontSize: 12,
                                color: "#65676b",
                                fontWeight: 600,
                                lineHeight: 1,
                                cursor: "pointer",
                                "&:hover": { textDecoration: "underline" },
                            }}
                        >
                            Phản hồi
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: "#65676b", lineHeight: 1 }}>
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
                                    <MenuItem onClick={handleEdit}>
                                        <EditIcon sx={{ fontSize: 16, mr: 1 }} />
                                        Chỉnh sửa
                                    </MenuItem>
                                    <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>
                                        <CloseIcon sx={{ fontSize: 16, mr: 1 }} />
                                        Xóa
                                    </MenuItem>
                                </Menu>
                            </>
                        )}
                    </Box>
                )}

                {/* Inline Reply Input */}
                {isActiveReply && !isEditing && (
                    <InlineReplyInput
                        postId={postId}
                        replyTarget={{
                            parentId: replyParentId || comment._id,
                            userId: comment.userId._id,
                            userName: userName,
                        }}
                        onCancel={() => onReplyClick("", "", "", "")}
                        onSuccess={onReplySuccess}
                    />
                )}

                {/* Show replies toggle */}
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

                {/* Replies */}
                {!isReply && showReplies && (
                    <Box sx={{ mt: 1, ml: 1 }}>
                        {replies.map((reply) => (
                            <CommentItem
                                key={reply._id}
                                comment={reply}
                                postId={postId}
                                isReply={true}
                                activeReplyId={activeReplyId}
                                onReplyClick={onReplyClick}
                                onReplySuccess={onReplySuccess}
                            />
                        ))}
                        {hasNextPage && (
                            <Typography
                                onClick={() => !isFetchingNextPage && fetchNextPage()}
                                sx={{
                                    fontSize: 13,
                                    color: "#65676b",
                                    fontWeight: 600,
                                    cursor: isFetchingNextPage ? "default" : "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    py: 0.5,
                                    "&:hover": { textDecoration: isFetchingNextPage ? "none" : "underline" },
                                }}
                            >
                                {isFetchingNextPage ? (
                                    <CircularProgress sx={{ fontSize: 12, color: "#65676b" }} />
                                ) : (
                                    <ReplyIcon sx={{ fontSize: 14, transform: "scaleX(-1)" }} />
                                )}
                                {isFetchingNextPage ? "Đang tải..." : "Xem thêm phản hồi"}
                            </Typography>
                        )}
                    </Box>
                )}
            </Box>
        </Box>
    );
}