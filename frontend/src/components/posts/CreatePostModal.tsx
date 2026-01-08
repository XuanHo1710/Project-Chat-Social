"use client";

import { useState, useEffect, useCallback } from "react";
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
    VideoLibrary as VideoIcon,
} from "@mui/icons-material";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCreatePost } from "@/queries/usePostQueries";
import { PostPrivacy, MediaItem, PostType } from "@/types/post";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import Image from "next/image";
import { useMediaUpload } from "@/contexts/MediaUploadContext";

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
    {
        id: "gradient1",
        color: "linear-gradient(135deg, #f5af19, #f12711)",
        preview: "linear-gradient(135deg, #f5af19, #f12711)",
    },
    {
        id: "gradient2",
        color: "linear-gradient(135deg, #667eea, #764ba2)",
        preview: "linear-gradient(135deg, #667eea, #764ba2)",
    },
    { id: "solid1", color: "#e91e63", preview: "#e91e63" },
    { id: "solid2", color: "#000000", preview: "#000000" },
    {
        id: "gradient3",
        color: "linear-gradient(135deg, #4facfe, #00f2fe)",
        preview: "linear-gradient(135deg, #4facfe, #00f2fe)",
    },
    {
        id: "gradient4",
        color: "linear-gradient(135deg, #fa709a, #fee140)",
        preview: "linear-gradient(135deg, #fa709a, #fee140)",
    },
    { id: "solid3", color: "#9c88ff", preview: "#9c88ff" },
    { id: "solid4", color: "#f0f2f5", preview: "#f0f2f5" },
];

interface CreatePostModalProps {
    open: boolean;
    onClose: () => void;
    onPostCreated?: (post: PostType) => void;
    groupId?: string; // For group posts
    groupName?: string; // Group name for display
}

export default function CreatePostModal({
    open,
    onClose,
    onPostCreated,
    groupId,
    groupName,
}: CreatePostModalProps) {
    const { user } = useAuthStore();
    const {
        pendingMedia,
        isUploading,
        uploadProgress,
        fileInputRef,
        handleFileSelect,
        handleRemovePendingMedia,
        uploadAllMedia,
        resetMedia,
        handleEmojiSelect,
    } = useMediaUpload();

    // States
    const [modalView, setModalView] = useState<"create" | "privacy">("create");
    const [postContent, setPostContent] = useState("");
    const [selectedPrivacy, setSelectedPrivacy] =
        useState<PostPrivacy>("PUBLIC");
    const [selectedBackground, setSelectedBackground] = useState("none");
    const [showBackgrounds, setShowBackgrounds] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isAnonymous, setIsAnonymous] = useState(false);

    // Post mutation
    const createPostMutation = useCreatePost();

    // Reset states when modal closes
    useEffect(() => {
        const initSetup = () => {
            if (!open) {
                setPostContent("");
                setSelectedPrivacy("PUBLIC");
                setSelectedBackground("none");
                setShowBackgrounds(false);
                setShowEmojiPicker(false);
                setIsAnonymous(false);
                resetMedia();
                setModalView("create");
            }
        }
        initSetup();
    }, [open, resetMedia]);

    // Wrapper for file select to disable background
    const onFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        handleFileSelect(event);
        setSelectedBackground("none"); // Disable background when adding media
    };

    // Handle post submission
    const handlePost = useCallback(async () => {
        if (!user?.id) return;
        if (!postContent.trim() && pendingMedia.length === 0) return;

        try {
            // Upload all pending media first
            let mediaToPost: MediaItem[] = [];
            if (pendingMedia.length > 0) {
                const uploadResults = await uploadAllMedia();
                mediaToPost = uploadResults.map((r) => ({
                    mediaType: r.mediaType,
                    url: r.url,
                    publicId: r.publicId,
                    width: r.width,
                    height: r.height,
                    duration: r.duration,
                }));
            }

            // Create post with all data ready
            const result = await createPostMutation.mutateAsync({
                userId: user.id,
                content: postContent.trim() || undefined,
                privacy: groupId ? "GROUP" : selectedPrivacy,
                media: mediaToPost.length > 0 ? mediaToPost : undefined,
                background:
                    selectedBackground !== "none" && mediaToPost.length === 0
                        ? backgroundColors.find((b) => b.id === selectedBackground)?.color
                        : null,
                groupId: groupId || undefined,
                isAnonymous: groupId ? isAnonymous : undefined,
            });

            // Call callback with new post if provided
            if (onPostCreated && result?.data) {
                onPostCreated(result.data);
            }

            onClose();
            // Reset states

        } catch (error) {
            console.error("Failed to create post:", error);
        }
    }, [
        user,
        postContent,
        pendingMedia,
        selectedPrivacy,
        selectedBackground,
        uploadAllMedia,
        groupId,
        isAnonymous,
        createPostMutation,
        onClose,
        onPostCreated,
    ]);

    // Wrapper for emoji picker
    const onEmojiSelect = (emoji: { native: string }) => {
        handleEmojiSelect(emoji, setPostContent);
    };

    // Get selected background
    const getSelectedBg = () =>
        backgroundColors.find((b) => b.id === selectedBackground)?.color ||
        "transparent";

    // Get privacy label
    const getPrivacyLabel = () =>
        privacyOptions.find((p) => p.id === selectedPrivacy)?.label || "Công khai";

    const PrivacyIcon =
        privacyOptions.find((p) => p.id === selectedPrivacy)?.icon || PublicIcon;

    // Check if can post
    const canPost =
        (postContent.trim() || pendingMedia.length > 0) &&
        !isUploading &&
        !createPostMutation.isPending;

    return (
        <Modal
            open={open}
            onClose={onClose}
            sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}
        >
            <Box
                sx={{
                    width: 800,
                    maxHeight: "90vh",
                    bgcolor: "white",
                    borderRadius: 2,
                    boxShadow: 24,
                    display: "flex",
                    flexDirection: "column",
                    position: "relative"
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
                        <IconButton
                            onClick={() => setModalView("create")}
                            sx={{ position: "absolute", left: 8 }}
                        >
                            <ArrowBackIcon />
                        </IconButton>
                    )}
                    <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#050505' }}>
                        {modalView === "create" ? (groupName ? `Đăng trong ${groupName}` : "Tạo bài viết") : "Đối tượng của bài viết"}
                    </Typography>
                    <IconButton onClick={onClose} sx={{ position: "absolute", right: 8 }}>
                        <CloseIcon />
                    </IconButton>
                </Box>

                {/* Content */}
                {modalView === "create" ? (
                    <Box sx={{ flex: 1, overflow: "auto" }}>
                        {/* User Info & Privacy */}
                        <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
                            <Avatar sx={{ width: 40, height: 40 }} src={isAnonymous ? undefined : user?.avatar}>
                                {isAnonymous ? '?' : undefined}
                            </Avatar>
                            <Box sx={{ flex: 1 }}>
                                <Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>
                                    {isAnonymous ? 'Ẩn danh' : (user?.fullName || user?.username)}
                                </Typography>
                                {!groupId ? (
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
                                ) : (
                                    <Button
                                        size="small"
                                        onClick={() => setIsAnonymous(!isAnonymous)}
                                        sx={{
                                            bgcolor: isAnonymous ? "#1877f2" : "#e4e6eb",
                                            color: isAnonymous ? "white" : "#050505",
                                            textTransform: "none",
                                            fontSize: 13,
                                            fontWeight: 600,
                                            px: 1.5,
                                            py: 0.25,
                                            minHeight: 0,
                                            borderRadius: 1,
                                            "&:hover": { bgcolor: isAnonymous ? "#166fe5" : "#d8dadf" },
                                        }}
                                    >
                                        {isAnonymous ? '✓ Ẩn danh' : 'Đăng ẩn danh?'}
                                    </Button>
                                )}
                            </Box>
                        </Box>

                        {/* Post Content Input */}
                        <Box
                            sx={{
                                px: 2,
                                pb: 2,
                                background:
                                    pendingMedia.length === 0 ? getSelectedBg() : "transparent",
                                minHeight: pendingMedia.length === 0 ? 150 : "auto",
                                display: "flex",
                                alignItems:
                                    selectedBackground !== "none" && pendingMedia.length === 0
                                        ? "center"
                                        : "flex-start",
                                justifyContent: "center",
                                borderRadius:
                                    selectedBackground !== "none" && pendingMedia.length === 0
                                        ? 2
                                        : 0,
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
                                    fontSize:
                                        selectedBackground !== "none" && pendingMedia.length === 0
                                            ? 24
                                            : 16,
                                    fontWeight:
                                        selectedBackground !== "none" && pendingMedia.length === 0
                                            ? 700
                                            : 400,
                                    color:
                                        selectedBackground !== "none" &&
                                            selectedBackground !== "solid4" &&
                                            pendingMedia.length === 0
                                            ? "white"
                                            : "#050505",
                                    textAlign:
                                        selectedBackground !== "none" && pendingMedia.length === 0
                                            ? "center"
                                            : "left",
                                    "& textarea": {
                                        textAlign:
                                            selectedBackground !== "none" && pendingMedia.length === 0
                                                ? "center"
                                                : "left",
                                    },
                                    "& ::placeholder": {
                                        color:
                                            selectedBackground !== "none" &&
                                                selectedBackground !== "solid4" &&
                                                pendingMedia.length === 0
                                                ? "rgba(255,255,255,0.7)"
                                                : "#65676b",
                                    },
                                }}
                            />
                        </Box>

                        {/* Media Preview */}
                        {pendingMedia.length > 0 && (
                            <Box sx={{ px: 2, pb: 2 }}>
                                <Box
                                    sx={{
                                        border: "1px solid #e4e6eb",
                                        borderRadius: 2,
                                        p: 1,
                                        position: "relative",
                                    }}
                                >
                                    {isUploading && (
                                        <Box sx={{ mb: 1 }}>
                                            <LinearProgress
                                                variant="determinate"
                                                value={uploadProgress}
                                            />
                                            <Typography
                                                sx={{
                                                    fontSize: 12,
                                                    color: "#65676b",
                                                    mt: 0.5,
                                                    textAlign: "center",
                                                }}
                                            >
                                                Đang tải lên... {uploadProgress}%
                                            </Typography>
                                        </Box>
                                    )}

                                    <ImageList
                                        cols={pendingMedia.length === 1 ? 1 : 2}
                                        gap={8}
                                        sx={{ m: 0 }}
                                    >
                                        {pendingMedia.map((media) => (
                                            <ImageListItem key={media.id} sx={{ position: "relative" }}>
                                                {media.mediaType === "VIDEO" ? (
                                                    <video
                                                        src={media.preview}
                                                        style={{
                                                            width: "100%",
                                                            height: pendingMedia.length === 1 ? 300 : 150,
                                                            objectFit: "cover",
                                                            borderRadius: 8,
                                                        }}
                                                    />
                                                ) : (
                                                    <Image
                                                        src={media.preview}
                                                        alt="Preview"
                                                        style={{
                                                            width: "100%",
                                                            height: pendingMedia.length === 1 ? 300 : 150,
                                                            objectFit: "cover",
                                                            borderRadius: 8,
                                                        }}
                                                        width={200}
                                                        height={200}
                                                    />
                                                )}

                                                {/* Status indicator */}
                                                {media.uploadStatus === "uploading" && (
                                                    <Box
                                                        sx={{
                                                            position: "absolute",
                                                            top: 0,
                                                            left: 0,
                                                            right: 0,
                                                            bottom: 0,
                                                            bgcolor: "rgba(0,0,0,0.5)",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            borderRadius: 2,
                                                        }}
                                                    >
                                                        <CircularProgress size={32} sx={{ color: "white" }} />
                                                    </Box>
                                                )}

                                                {media.uploadStatus === "uploaded" && (
                                                    <Box
                                                        sx={{
                                                            position: "absolute",
                                                            top: 8,
                                                            left: 8,
                                                            bgcolor: "rgba(0,255,0,0.8)",
                                                            borderRadius: "50%",
                                                            width: 24,
                                                            height: 24,
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                        }}
                                                    >
                                                        <Typography sx={{ color: "white", fontSize: 14 }}>
                                                            ✓
                                                        </Typography>
                                                    </Box>
                                                )}

                                                {/* Remove button */}
                                                <IconButton
                                                    onClick={() => handleRemovePendingMedia(media.id)}
                                                    disabled={isUploading}
                                                    sx={{
                                                        position: "absolute",
                                                        top: 8,
                                                        right: 8,
                                                        bgcolor: "rgba(0,0,0,0.6)",
                                                        color: "white",
                                                        width: 28,
                                                        height: 28,
                                                        "&:hover": { bgcolor: "rgba(0,0,0,0.8)" },
                                                    }}
                                                >
                                                    <CloseIcon sx={{ fontSize: 18 }} />
                                                </IconButton>

                                                {/* Video indicator */}
                                                {media.mediaType === "VIDEO" && (
                                                    <Box
                                                        sx={{
                                                            position: "absolute",
                                                            bottom: 8,
                                                            left: 8,
                                                            bgcolor: "rgba(0,0,0,0.6)",
                                                            borderRadius: 1,
                                                            px: 1,
                                                            py: 0.25,
                                                        }}
                                                    >
                                                        <VideoIcon sx={{ fontSize: 16, color: "white" }} />
                                                    </Box>
                                                )}
                                            </ImageListItem>
                                        ))}
                                    </ImageList>

                                    {/* Add more button */}
                                    <Button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploading}
                                        sx={{
                                            mt: 1,
                                            textTransform: "none",
                                            color: "#050505",
                                            bgcolor: "#f0f2f5",
                                            "&:hover": { bgcolor: "#e4e6eb" },
                                        }}
                                        startIcon={<PhotoIcon />}
                                    >
                                        Thêm ảnh/video
                                    </Button>
                                </Box>
                            </Box>
                        )}

                        {/* Background selector (only when no media) */}
                        {pendingMedia.length === 0 && (
                            <Box sx={{ px: 2, pb: 2 }}>
                                <Box
                                    sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
                                >
                                    <Button
                                        size="small"
                                        onClick={() => setShowBackgrounds(!showBackgrounds)}
                                        sx={{
                                            minWidth: 36,
                                            height: 36,
                                            p: 0,
                                            borderRadius: 2,
                                            background:
                                                "linear-gradient(135deg, #f5af19, #f12711, #667eea, #764ba2)",
                                            border: showBackgrounds
                                                ? "2px solid #1877f2"
                                                : "2px solid transparent",
                                        }}
                                    />
                                </Box>

                                {showBackgrounds && (
                                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                                        {backgroundColors.map((bg) => (
                                            <Box
                                                key={bg.id}
                                                onClick={() => setSelectedBackground(bg.id)}
                                                sx={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: 1,
                                                    background: bg.preview,
                                                    border:
                                                        bg.id === "none"
                                                            ? "2px dashed #ccc"
                                                            : selectedBackground === bg.id
                                                                ? "2px solid #1877f2"
                                                                : "2px solid transparent",
                                                    cursor: "pointer",
                                                    "&:hover": {
                                                        opacity: 0.8,
                                                    },
                                                }}
                                            />
                                        ))}
                                    </Box>
                                )}
                            </Box>
                        )}

                        {/* Add to Post Options */}
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
                                <IconButton
                                    onClick={() => fileInputRef.current?.click()}
                                    sx={{ color: "#45bd62" }}
                                >
                                    <PhotoIcon />
                                </IconButton>
                                <IconButton
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    sx={{ color: "#f7b928" }}
                                >
                                    <MoodIcon />
                                </IconButton>
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
                                    setModalView("create");
                                }}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 2,
                                    p: 2,
                                    borderRadius: 2,
                                    cursor: "pointer",
                                    bgcolor:
                                        selectedPrivacy === option.id ? "#e7f3ff" : "transparent",
                                    "&:hover": { bgcolor: "#f0f2f5" },
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: "50%",
                                        bgcolor: "#e4e6eb",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <option.icon sx={{ fontSize: 24, color: "#050505" }} />
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                    <Typography sx={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>
                                        {option.label}
                                    </Typography>
                                    <Typography sx={{ fontSize: 13, color: "#65676b" }}>
                                        {option.description}
                                    </Typography>
                                </Box>
                                <Box
                                    sx={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: "50%",
                                        border:
                                            selectedPrivacy === option.id
                                                ? "6px solid #1877f2"
                                                : "2px solid #65676b",
                                    }}
                                />
                            </Box>
                        ))}
                    </Box>
                )}

                {/* Post Button */}
                {modalView === "create" && (
                    <Box sx={{ p: 2, borderTop: "1px solid #e4e6eb" }}>
                        <Button
                            fullWidth
                            variant="contained"
                            disabled={!canPost}
                            onClick={handlePost}
                            sx={{
                                py: 1,
                                bgcolor: canPost ? "#1877f2" : "#e4e6eb",
                                color: canPost ? "white" : "#bcc0c4",
                                fontWeight: 600,
                                textTransform: "none",
                                fontSize: 15,
                                "&:hover": { bgcolor: canPost ? "#166fe5" : "#e4e6eb" },
                                "&.Mui-disabled": { bgcolor: "#e4e6eb", color: "#bcc0c4" },
                            }}
                        >
                            {createPostMutation.isPending || isUploading ? (
                                <CircularProgress size={24} sx={{ color: "white" }} />
                            ) : (
                                "Đăng"
                            )}
                        </Button>
                    </Box>
                )}

                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={onFileSelect}
                    style={{ display: "none" }}
                />

                {/* Emoji Picker - Floating */}
                {showEmojiPicker && (
                    <Box
                        sx={{
                            position: 'absolute',
                            right: "40%",
                            bottom: "35%",
                            mb: 1,
                            zIndex: 1500,
                            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                            borderRadius: 2,
                            width: 100,
                            height: 400,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Picker
                            data={data}
                            onEmojiSelect={onEmojiSelect}
                            theme="light"
                            locale="vi"
                            previewPosition="none"
                        />
                    </Box>
                )}
            </Box>


        </Modal>
    );
}
