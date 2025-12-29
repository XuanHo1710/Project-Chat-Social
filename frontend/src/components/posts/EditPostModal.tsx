"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
    Box,
    Modal,
    Typography,
    IconButton,
    Avatar,
    Button,
    InputBase,
    CircularProgress,
    LinearProgress,
    ImageList,
    ImageListItem,
} from "@mui/material";
import {
    Close as CloseIcon,
    PhotoLibrary as PhotoIcon,
    Mood as MoodIcon,
    Public as PublicIcon,
    Lock as LockIcon,
    People as PeopleIcon,
    KeyboardArrowDown as ArrowDownIcon,
    ArrowBack as ArrowBackIcon,
} from "@mui/icons-material";
import { useAuthStore } from "@/stores/useAuthStore";
import { useUpdatePost } from "@/queries/usePostQueries";
import { UploadMediaFiles } from "@/utils/uploadImage";
import { deleteCloudinaryMedia } from "@/services/cloudinary.service";
import { PostType, PendingMediaItem, PostPrivacy, MediaItem } from "@/types/post";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

// Privacy options
const privacyOptions = [
    {
        id: "PUBLIC" as PostPrivacy,
        icon: PublicIcon,
        label: "Công khai",
        description: "Bất kỳ ai trên mạng xã hội",
    },
    {
        id: "FRIEND" as PostPrivacy,
        icon: PeopleIcon,
        label: "Bạn bè",
        description: "Bạn bè của bạn",
    },
    {
        id: "PRIVATE" as PostPrivacy,
        icon: LockIcon,
        label: "Chỉ mình tôi",
        description: "Chỉ mình bạn",
    },
];

// Background colors for text-only posts
const backgroundColors = [
    { id: "none", color: "transparent", preview: "white" },
    { id: "gradient1", color: "linear-gradient(135deg, #f5af19, #f12711)", preview: "linear-gradient(135deg, #f5af19, #f12711)" },
    { id: "gradient2", color: "linear-gradient(135deg, #667eea, #764ba2)", preview: "linear-gradient(135deg, #667eea, #764ba2)" },
    { id: "solid1", color: "#e91e63", preview: "#e91e63" },
    { id: "solid2", color: "#000000", preview: "#000000" },
    { id: "gradient3", color: "linear-gradient(135deg, #4facfe, #00f2fe)", preview: "linear-gradient(135deg, #4facfe, #00f2fe)" },
    { id: "gradient4", color: "linear-gradient(135deg, #fa709a, #fee140)", preview: "linear-gradient(135deg, #fa709a, #fee140)" },
    { id: "solid3", color: "#9c88ff", preview: "#9c88ff" },
    { id: "solid4", color: "#f0f2f5", preview: "#f0f2f5" },
];

interface EditPostModalProps {
    open: boolean;
    onClose: () => void;
    post: PostType;
}

export default function EditPostModal({ open, onClose, post }: EditPostModalProps) {
    const { user } = useAuthStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const updatePostMutation = useUpdatePost();

    // Form state
    const [postContent, setPostContent] = useState(post.content || "");
    const [selectedPrivacy, setSelectedPrivacy] = useState<PostPrivacy>(post.privacy || "PUBLIC");
    const [selectedBackground, setSelectedBackground] = useState(
        backgroundColors.find(b => b.color === post.background)?.id || "none"
    );
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Media state
    const [existingMedia, setExistingMedia] = useState<MediaItem[]>(post.media || []);
    const [pendingMedia, setPendingMedia] = useState<PendingMediaItem[]>([]);
    const [deletedMediaIds, setDeletedMediaIds] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Modal view state
    const [modalView, setModalView] = useState<"edit" | "privacy">("edit");

    // Reset state when modal opens with new post
    useEffect(() => {
        if (open && post) {
            setPostContent(post.content || "");
            setSelectedPrivacy(post.privacy || "PUBLIC");
            setSelectedBackground(backgroundColors.find(b => b.color === post.background)?.id || "none");
            setExistingMedia(post.media || []);
            setPendingMedia([]);
            setDeletedMediaIds([]);
            setModalView("edit");
            setShowEmojiPicker(false);
        }
    }, [open, post]);

    // Handle file selection
    const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        const newMedia: PendingMediaItem[] = [];

        Array.from(files).forEach((file) => {
            const isVideo = file.type.startsWith("video/");
            const preview = URL.createObjectURL(file);

            newMedia.push({
                id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                file,
                preview,
                mediaType: isVideo ? "VIDEO" : "IMAGE",
                uploadStatus: "pending",
            });
        });

        setPendingMedia((prev) => [...prev, ...newMedia]);

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, []);

    // Remove existing media
    const handleRemoveExistingMedia = (publicId: string) => {
        setExistingMedia((prev) => prev.filter((m) => m.publicId !== publicId));
        setDeletedMediaIds((prev) => [...prev, publicId]);
    };

    // Remove pending media
    const handleRemovePendingMedia = (id: string) => {
        setPendingMedia((prev) => {
            const item = prev.find((m) => m.id === id);
            if (item?.preview) {
                URL.revokeObjectURL(item.preview);
            }
            return prev.filter((m) => m.id !== id);
        });
    };

    // Upload pending media
    const uploadPendingMedia = async (): Promise<MediaItem[]> => {
        const pendingFiles = pendingMedia.filter((m) => m.uploadStatus === "pending");
        if (pendingFiles.length === 0) return [];

        setIsUploading(true);
        setUploadProgress(0);

        try {
            const results = await UploadMediaFiles(
                pendingFiles.map((m) => m.file),
                (progress) => setUploadProgress(progress)
            );

            return results.map((result, index) => ({
                mediaType: pendingFiles[index].mediaType,
                url: result.url,
                publicId: result.publicId,
                width: result.width,
                height: result.height,
                duration: result.duration,
            }));
        } catch (error) {
            console.error("Upload error:", error);
            throw error;
        } finally {
            setIsUploading(false);
        }
    };

    // Handle save
    const handleSave = async () => {
        try {
            // 1. Delete removed media from Cloudinary via backend API
            if (deletedMediaIds.length > 0) {
                const deletedMedia = post.media?.filter(m => deletedMediaIds.includes(m.publicId)) || [];
                const mediaToDelete = deletedMedia.map(m => ({
                    publicId: m.publicId,
                    mediaType: m.mediaType
                }));
                if (mediaToDelete.length > 0) {
                    await deleteCloudinaryMedia(mediaToDelete);
                }
            }

            // 2. Upload new media
            let newUploadedMedia: MediaItem[] = [];
            if (pendingMedia.length > 0) {
                newUploadedMedia = await uploadPendingMedia();
            }

            // 3. Combine existing + new media
            const finalMedia = [...existingMedia, ...newUploadedMedia];

            // 4. Get background
            const background = selectedBackground === "none" || finalMedia.length > 0
                ? null
                : backgroundColors.find((b) => b.id === selectedBackground)?.color || null;

            // 5. Update post
            await updatePostMutation.mutateAsync({
                postId: post._id,
                data: {
                    content: postContent,
                    privacy: selectedPrivacy,
                    media: finalMedia,
                    background,
                },
            });

            // 6. Clean up previews
            pendingMedia.forEach((m) => {
                if (m.preview) URL.revokeObjectURL(m.preview);
            });

            onClose();
        } catch (error) {
            console.error("Error updating post:", error);
        }
    };

    const handleEmojiSelect = (emoji: { native: string }) => {
        setPostContent((prev) => prev + emoji.native);
    };

    const getSelectedBg = () =>
        backgroundColors.find((b) => b.id === selectedBackground)?.color || "transparent";

    const getPrivacyLabel = () =>
        privacyOptions.find((p) => p.id === selectedPrivacy)?.label || "Công khai";

    const PrivacyIcon = privacyOptions.find((p) => p.id === selectedPrivacy)?.icon || PublicIcon;

    const totalMedia = existingMedia.length + pendingMedia.length;
    const canSave = (postContent.trim() || totalMedia > 0) && !isUploading && !updatePostMutation.isPending;

    return (
        <Modal
            open={open}
            onClose={onClose}
            sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}
        >
            <Box
                sx={{
                    width: 500,
                    maxHeight: "90vh",
                    bgcolor: "white",
                    borderRadius: 2,
                    boxShadow: 24,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {/* Header */}
                <Box
                    sx={{
                        p: 2,
                        borderBottom: "1px solid #e4e6eb",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                    }}
                >
                    {modalView === "privacy" && (
                        <IconButton onClick={() => setModalView("edit")} sx={{ position: "absolute", left: 8 }}>
                            <ArrowBackIcon />
                        </IconButton>
                    )}
                    <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#050505' }}>
                        {modalView === "edit" ? "Chỉnh sửa bài viết" : "Đối tượng của bài viết"}
                    </Typography>
                    <IconButton onClick={onClose} sx={{ position: "absolute", right: 8 }}>
                        <CloseIcon />
                    </IconButton>
                </Box>

                {/* Content */}
                {modalView === "edit" ? (
                    <Box sx={{ flex: 1, overflow: "auto" }}>
                        {/* User Info & Privacy */}
                        <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
                            <Avatar sx={{ width: 40, height: 40 }} src={user?.avatar} />
                            <Box>
                                <Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>
                                    {user?.fullName || user?.username}
                                </Typography>
                                <Button
                                    size="small"
                                    onClick={() => setModalView("privacy")}
                                    sx={{
                                        bgcolor: "#e4e6eb",
                                        color: "#050505",
                                        textTransform: "none",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        px: 1,
                                        py: 0.25,
                                        minHeight: 0,
                                        borderRadius: 1,
                                        "&:hover": { bgcolor: "#d8dadf" },
                                    }}
                                    startIcon={<PrivacyIcon sx={{ fontSize: 14 }} />}
                                    endIcon={<ArrowDownIcon sx={{ fontSize: 16 }} />}
                                >
                                    {getPrivacyLabel()}
                                </Button>
                            </Box>
                        </Box>

                        {/* Post Content Input */}
                        <Box
                            sx={{
                                px: 2,
                                pb: 2,
                                background: totalMedia === 0 ? getSelectedBg() : "transparent",
                                minHeight: totalMedia === 0 ? 150 : "auto",
                                display: "flex",
                                alignItems: selectedBackground !== "none" && totalMedia === 0 ? "center" : "flex-start",
                                justifyContent: "center",
                                borderRadius: selectedBackground !== "none" && totalMedia === 0 ? 2 : 0,
                                mx: selectedBackground !== "none" ? 2 : 0,
                            }}
                        >
                            <InputBase
                                multiline
                                fullWidth
                                placeholder={`${user?.fullName || user?.username || "Bạn"} ơi, bạn đang nghĩ gì thế?`}
                                value={postContent}
                                onChange={(e) => setPostContent(e.target.value)}
                                sx={{
                                    fontSize: selectedBackground !== "none" && totalMedia === 0 ? 24 : 16,
                                    fontWeight: selectedBackground !== "none" && totalMedia === 0 ? 700 : 400,
                                    color: selectedBackground !== "none" && selectedBackground !== "solid4" && totalMedia === 0 ? "white" : "#050505",
                                    textAlign: selectedBackground !== "none" && totalMedia === 0 ? "center" : "left",
                                    "& textarea": {
                                        textAlign: selectedBackground !== "none" && totalMedia === 0 ? "center" : "left",
                                    },
                                    "& ::placeholder": {
                                        color: selectedBackground !== "none" && selectedBackground !== "solid4" && totalMedia === 0 ? "rgba(255,255,255,0.7)" : "#65676b",
                                    },
                                }}
                            />
                        </Box>

                        {/* Existing Media Preview */}
                        {existingMedia.length > 0 && (
                            <Box sx={{ px: 2, pb: 2 }}>
                                <Typography sx={{ fontSize: 14, fontWeight: 600, mb: 1, color: '#050505' }}>
                                    Ảnh/Video hiện tại
                                </Typography>
                                <ImageList cols={existingMedia.length === 1 ? 1 : 2} gap={8} sx={{ m: 0 }}>
                                    {existingMedia.map((media) => (
                                        <ImageListItem key={media.publicId} sx={{ position: "relative" }}>
                                            {media.mediaType === "VIDEO" ? (
                                                <video
                                                    src={media.url}
                                                    style={{
                                                        width: "100%",
                                                        height: existingMedia.length === 1 ? 200 : 120,
                                                        objectFit: "cover",
                                                        borderRadius: 8,
                                                    }}
                                                />
                                            ) : (
                                                <img
                                                    src={media.url}
                                                    alt="Media"
                                                    style={{
                                                        width: "100%",
                                                        height: existingMedia.length === 1 ? 200 : 120,
                                                        objectFit: "cover",
                                                        borderRadius: 8,
                                                    }}
                                                />
                                            )}
                                            <IconButton
                                                onClick={() => handleRemoveExistingMedia(media.publicId)}
                                                sx={{
                                                    position: "absolute",
                                                    top: 4,
                                                    right: 4,
                                                    bgcolor: "rgba(0,0,0,0.6)",
                                                    color: "white",
                                                    width: 28,
                                                    height: 28,
                                                    "&:hover": { bgcolor: "rgba(0,0,0,0.8)" },
                                                }}
                                            >
                                                <CloseIcon sx={{ fontSize: 18 }} />
                                            </IconButton>
                                        </ImageListItem>
                                    ))}
                                </ImageList>
                            </Box>
                        )}

                        {/* Pending Media Preview */}
                        {pendingMedia.length > 0 && (
                            <Box sx={{ px: 2, pb: 2 }}>
                                <Typography sx={{ fontSize: 14, fontWeight: 600, mb: 1, color: '#050505' }}>
                                    Ảnh/Video mới
                                </Typography>
                                {isUploading && (
                                    <Box sx={{ mb: 1 }}>
                                        <LinearProgress variant="determinate" value={uploadProgress} />
                                        <Typography sx={{ fontSize: 12, color: "#65676b", mt: 0.5, textAlign: "center" }}>
                                            Đang tải lên... {uploadProgress}%
                                        </Typography>
                                    </Box>
                                )}
                                <ImageList cols={pendingMedia.length === 1 ? 1 : 2} gap={8} sx={{ m: 0 }}>
                                    {pendingMedia.map((media) => (
                                        <ImageListItem key={media.id} sx={{ position: "relative" }}>
                                            {media.mediaType === "VIDEO" ? (
                                                <video
                                                    src={media.preview}
                                                    style={{
                                                        width: "100%",
                                                        height: pendingMedia.length === 1 ? 200 : 120,
                                                        objectFit: "cover",
                                                        borderRadius: 8,
                                                    }}
                                                />
                                            ) : (
                                                <img
                                                    src={media.preview}
                                                    alt="Preview"
                                                    style={{
                                                        width: "100%",
                                                        height: pendingMedia.length === 1 ? 200 : 120,
                                                        objectFit: "cover",
                                                        borderRadius: 8,
                                                    }}
                                                />
                                            )}
                                            <IconButton
                                                onClick={() => handleRemovePendingMedia(media.id)}
                                                sx={{
                                                    position: "absolute",
                                                    top: 4,
                                                    right: 4,
                                                    bgcolor: "rgba(0,0,0,0.6)",
                                                    color: "white",
                                                    width: 28,
                                                    height: 28,
                                                    "&:hover": { bgcolor: "rgba(0,0,0,0.8)" },
                                                }}
                                            >
                                                <CloseIcon sx={{ fontSize: 18 }} />
                                            </IconButton>
                                        </ImageListItem>
                                    ))}
                                </ImageList>
                            </Box>
                        )}

                        {/* Background Selection */}
                        {totalMedia === 0 && (
                            <Box sx={{ px: 2, pb: 2 }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    <Typography sx={{ fontSize: 14, color: "#65676b" }}>Phông nền:</Typography>
                                    <Box sx={{ display: "flex", gap: 0.5 }}>
                                        {backgroundColors.map((bg) => (
                                            <Box
                                                key={bg.id}
                                                onClick={() => setSelectedBackground(bg.id)}
                                                sx={{
                                                    width: 28,
                                                    height: 28,
                                                    borderRadius: 1,
                                                    cursor: "pointer",
                                                    background: bg.preview,
                                                    border: selectedBackground === bg.id ? "2px solid #1877f2" : "1px solid #e4e6eb",
                                                }}
                                            />
                                        ))}
                                    </Box>
                                </Box>
                            </Box>
                        )}

                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,video/*"
                            multiple
                            hidden
                            onChange={handleFileSelect}
                        />

                        {/* Add to post section */}
                        <Box
                            sx={{
                                mx: 2,
                                mb: 2,
                                p: 1.5,
                                border: "1px solid #e4e6eb",
                                borderRadius: 2,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                position: 'relative',
                            }}
                        >
                            <Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>
                                Thêm vào bài viết của bạn
                            </Typography>
                            <Box sx={{ display: "flex", gap: 0.5, position: 'relative' }}>
                                <IconButton onClick={() => fileInputRef.current?.click()} sx={{ color: "#45bd62" }}>
                                    <PhotoIcon />
                                </IconButton>
                                <IconButton onClick={() => setShowEmojiPicker(!showEmojiPicker)} sx={{ color: "#f7b928" }}>
                                    <MoodIcon />
                                </IconButton>

                                {/* Emoji Picker - Floating */}
                                {showEmojiPicker && (
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            bottom: '100%',
                                            right: 0,
                                            mb: 1,
                                            zIndex: 1300,
                                            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
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
                                )}
                            </Box>
                        </Box>
                    </Box>
                ) : (
                    /* Privacy Selection View */
                    <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
                        <Typography sx={{ mb: 2, color: "#65676b", fontSize: 14 }}>
                            Ai có thể xem bài viết của bạn?
                        </Typography>
                        {privacyOptions.map((option) => (
                            <Box
                                key={option.id}
                                onClick={() => {
                                    setSelectedPrivacy(option.id);
                                    setModalView("edit");
                                }}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 2,
                                    p: 1.5,
                                    borderRadius: 2,
                                    cursor: "pointer",
                                    bgcolor: selectedPrivacy === option.id ? "#e7f3ff" : "transparent",
                                    "&:hover": { bgcolor: selectedPrivacy === option.id ? "#e7f3ff" : "#f0f2f5" },
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: "50%",
                                        bgcolor: selectedPrivacy === option.id ? "#1877f2" : "#e4e6eb",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <option.icon sx={{ color: selectedPrivacy === option.id ? "white" : "#050505" }} />
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                    <Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>
                                        {option.label}
                                    </Typography>
                                    <Typography sx={{ fontSize: 13, color: "#65676b" }}>
                                        {option.description}
                                    </Typography>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                )}

                {/* Footer - Save Button */}
                {modalView === "edit" && (
                    <Box sx={{ p: 2, borderTop: "1px solid #e4e6eb" }}>
                        <Button
                            fullWidth
                            variant="contained"
                            disabled={!canSave}
                            onClick={handleSave}
                            sx={{
                                bgcolor: canSave ? "#1877f2" : "#e4e6eb",
                                color: canSave ? "white" : "#bcc0c4",
                                textTransform: "none",
                                fontWeight: 700,
                                fontSize: 15,
                                py: 1,
                                "&:hover": { bgcolor: canSave ? "#166fe5" : "#e4e6eb" },
                                "&.Mui-disabled": { bgcolor: "#e4e6eb", color: "#bcc0c4" },
                            }}
                        >
                            {updatePostMutation.isPending ? (
                                <CircularProgress size={24} sx={{ color: "white" }} />
                            ) : (
                                "Lưu"
                            )}
                        </Button>
                    </Box>
                )}
            </Box>
        </Modal>
    );
}
