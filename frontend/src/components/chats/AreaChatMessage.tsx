"use client";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
    Box,
    Avatar,
    Typography,
    IconButton,
    TextField,
    Badge,
    CircularProgress,
    List,
    ListItemAvatar,
    ListItemText,
    MenuItem,
    Popover,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import VideocamIcon from "@mui/icons-material/Videocam";
import CallIcon from "@mui/icons-material/Call";
import InfoIcon from "@mui/icons-material/Info";
import InsertPhotoIcon from "@mui/icons-material/InsertPhoto";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import CloseIcon from "@mui/icons-material/Close";
import { useChatByConversationId } from "@/queries/useChatQueries";
import { MessageResponse, SendMessagePayload } from "@/types/chat";
import { useSocket } from "@/contexts/SocketContext";
import { useQueryClient, InfiniteData } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/query-keys";
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { MessagesResponse } from "@/services/chat.service";
import { useOnlineStatusStore, formatLastActiveDetailed } from "@/stores/useOnlineStatusStore";
import MessageItem from "./MessageItem";
import ConversationInfo from "./ConversationInfo";
import { useConversationDetail } from "@/queries/useConversationQueries";
import { uploadChatMedia } from "@/services/cloudinary.service";
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

interface SelectedConversation {
    _id: string;
    fullName: string;
    avatar: string;
    status: "online" | "offline";
    otherId: string;
    lastActive?: string;
}

export default function AreaChatMessages({ selectedConversation, userId }: { selectedConversation: SelectedConversation, userId: string }) {
    const { socketChat } = useSocket();
    const queryClient = useQueryClient();
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showInfo, setShowInfo] = useState(false);

    // Get conversation detail for theme
    const { data: conversationDetail } = useConversationDetail(selectedConversation._id);
    const themeColor = conversationDetail?.data?.theme || '#0084ff';

    // Get real-time online status - just read from store
    const onlineUsers = useOnlineStatusStore(state => state.onlineUsers);

    const {
        data: chatData,
        fetchPreviousPage,
        hasPreviousPage,
        isFetchingPreviousPage,
        isLoading
    } = useChatByConversationId(selectedConversation._id);

    const [newMessage, setNewMessage] = useState("");
    const [replyMsg, setReplyMsg] = useState<MessageResponse | null>(null);
    const [mediaPreview, setMediaPreview] = useState<{ file: File; url: string; type: 'image' | 'video' }[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null);

    // Real-time status from store
    const otherUserStatus = useMemo(() => {
        const storeStatus = onlineUsers[selectedConversation.otherId];
        if (storeStatus) {
            return {
                isOnline: storeStatus.isOnline,
                lastActive: storeStatus.lastActive
            };
        }
        return {
            isOnline: selectedConversation.status === 'online',
            lastActive: selectedConversation.lastActive
        };
    }, [onlineUsers, selectedConversation.otherId, selectedConversation.status, selectedConversation.lastActive]);

    // Status display text
    const statusText = useMemo(() => {
        if (otherUserStatus.isOnline) {
            return 'Đang hoạt động';
        }
        return formatLastActiveDetailed(otherUserStatus.lastActive);
    }, [otherUserStatus]);

    // Flatten all pages into single array of messages
    const pages = chatData?.pages;
    const allMessages = useMemo(() => {
        if (!pages) return [];
        const messages: MessageResponse[] = [];
        pages.forEach(page => {
            messages.push(...page.data);
        });
        return messages;
    }, [pages]);

    // Calculate firstItemIndex based on total older messages
    const firstItemIndex = useMemo(() => {
        if (!pages || pages.length <= 1) return 10000;
        const totalOlderMessages = pages
            .slice(0, -1)
            .reduce((sum, page) => sum + page.data.length, 0);
        return 10000 - totalOlderMessages;
    }, [pages]);

    // Join conversation room
    useEffect(() => {
        if (!socketChat || !selectedConversation._id) return;

        socketChat.emit("room", { conversationId: selectedConversation._id });

        return () => {
            // No leave event in backend, just clean up
        };
    }, [socketChat, selectedConversation._id]);

    // Update message in cache helper
    const updateMessageInCache = useCallback((updatedMsg: MessageResponse) => {
        queryClient.setQueryData<InfiniteData<MessagesResponse>>(
            [QUERY_KEYS.CHATS, selectedConversation._id],
            (oldData) => {
                if (!oldData) return oldData;

                const newPages = oldData.pages.map(page => ({
                    ...page,
                    data: page.data.map(msg =>
                        msg._id === updatedMsg._id ? updatedMsg : msg
                    )
                }));

                return {
                    ...oldData,
                    pages: newPages,
                };
            }
        );
    }, [queryClient, selectedConversation._id]);

    // Listen for socket events
    useEffect(() => {
        if (!socketChat) return;

        const handleNewMessage = (msg: MessageResponse) => {
            queryClient.setQueryData<InfiniteData<MessagesResponse>>(
                [QUERY_KEYS.CHATS, selectedConversation._id],
                (oldData) => {
                    if (!oldData) {
                        return {
                            pages: [{ data: [msg], pagination: { page: 1, limit: 15, total: 1, hasMore: false } }],
                            pageParams: [undefined],
                        };
                    }
                    const newPages = [...oldData.pages];
                    const lastPageIndex = newPages.length - 1;
                    newPages[lastPageIndex] = {
                        ...newPages[lastPageIndex],
                        data: [...newPages[lastPageIndex].data, msg],
                    };
                    return {
                        ...oldData,
                        pages: newPages,
                    };
                }
            );
            // Scroll to bottom when new message
            setTimeout(() => {
                virtuosoRef.current?.scrollToIndex({
                    index: 'LAST',
                    behavior: 'smooth',
                });
            }, 100);
        };

        const handleMessageEdited = (msg: MessageResponse) => {
            updateMessageInCache(msg);
        };

        const handleMessageReaction = (msg: MessageResponse) => {
            updateMessageInCache(msg);
        };

        const handleMessageDeleted = (msg: MessageResponse) => {
            updateMessageInCache(msg);
        };

        const handleConversationUpdate = () => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATION_BY_USER] });
            queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATION_BY_USER, 'detail', selectedConversation._id] });
        };

        socketChat.on("message:new", handleNewMessage);
        socketChat.on("message:edited", handleMessageEdited);
        socketChat.on("message:reaction:updated", handleMessageReaction);
        socketChat.on("message:deleted", handleMessageDeleted);

        socketChat.on("conversation:updated", handleConversationUpdate);
        socketChat.on("conversation:nickname:updated", handleConversationUpdate);
        socketChat.on("conversation:name:updated", handleConversationUpdate);
        socketChat.on("conversation:avatar:updated", handleConversationUpdate);
        socketChat.on("conversation:quick-reaction:updated", handleConversationUpdate);
        socketChat.on("conversation:member:added", handleConversationUpdate);
        socketChat.on("conversation:member:removed", handleConversationUpdate);
        socketChat.on("conversation:admin:updated", handleConversationUpdate);

        return () => {
            socketChat.off("message:new", handleNewMessage);
            socketChat.off("message:edited", handleMessageEdited);
            socketChat.off("message:reaction:updated", handleMessageReaction);
            socketChat.off("message:deleted", handleMessageDeleted);
            socketChat.off("conversation:updated", handleConversationUpdate);
            socketChat.off("conversation:nickname:updated", handleConversationUpdate);
            socketChat.off("conversation:name:updated", handleConversationUpdate);
            socketChat.off("conversation:avatar:updated", handleConversationUpdate);
            socketChat.off("conversation:quick-reaction:updated", handleConversationUpdate);
            socketChat.off("conversation:member:added", handleConversationUpdate);
            socketChat.off("conversation:member:removed", handleConversationUpdate);
            socketChat.off("conversation:admin:updated", handleConversationUpdate);
        };
    }, [socketChat, selectedConversation._id, queryClient, updateMessageInCache]);

    const [showMentions, setShowMentions] = useState(false);
    const [mentionSearch, setMentionSearch] = useState("");

    const participants = conversationDetail?.data?.participants || [];

    const filteredParticipants = useMemo(() => {
        if (!mentionSearch) return participants;
        return participants.filter(p =>
            (p.nickname || `${p.user.firstName} ${p.user.lastName}`).toLowerCase().includes(mentionSearch.toLowerCase())
        );
    }, [participants, mentionSearch]);

    // Load more messages when scrolling to top
    const handleStartReached = useCallback(() => {
        if (hasPreviousPage && !isFetchingPreviousPage) {
            fetchPreviousPage();
        }
    }, [hasPreviousPage, isFetchingPreviousPage, fetchPreviousPage]);

    const handleReply = (message: MessageResponse) => {
        setReplyMsg(message);
    };

    const handleCancelReply = () => {
        setReplyMsg(null);
    };

    // Handle file selection
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const newPreviews: { file: File; url: string; type: 'image' | 'video' }[] = [];
        Array.from(files).forEach(file => {
            const isVideo = file.type.startsWith('video/');
            newPreviews.push({
                file,
                url: URL.createObjectURL(file),
                type: isVideo ? 'video' : 'image'
            });
        });
        setMediaPreview(prev => [...prev, ...newPreviews]);
        e.target.value = ''; // Reset input
    };

    const handleRemoveMedia = (index: number) => {
        setMediaPreview(prev => {
            URL.revokeObjectURL(prev[index].url);
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleSendMessage = async () => {
        if ((!newMessage.trim() && mediaPreview.length === 0) || !socketChat) return;

        setIsUploading(true);
        try {
            let attachments: string[] = [];

            // Upload media if any
            if (mediaPreview.length > 0) {
                const files = mediaPreview.map(m => m.file);
                const uploadResult = await uploadChatMedia(files);
                if (uploadResult.success) {
                    attachments = uploadResult.results.map(u => u.url);
                } else {
                    console.error("Upload failed");
                    setIsUploading(false);
                    return;
                }
            }

            const payload: SendMessagePayload = {
                conversationId: selectedConversation._id,
                senderId: userId,
                type: attachments.length > 0 ? (newMessage.trim() ? 'TEXT' : 'IMAGE') : 'TEXT',
                content: newMessage || '',
                attachments: attachments.length > 0 ? attachments : undefined,
                replyTo: replyMsg?._id,
            };

            socketChat.emit("message", payload);
            setNewMessage("");
            setReplyMsg(null);
            setMediaPreview([]);
            setShowMentions(false);
        } catch (err) {
            console.error("Failed to send message:", err);
        } finally {
            setIsUploading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setNewMessage(value);

        const lastAtIndex = value.lastIndexOf('@');
        if (lastAtIndex !== -1) {
            const afterAt = value.substring(lastAtIndex + 1);
            if (!afterAt.includes(' ')) {
                setShowMentions(true);
                setMentionSearch(afterAt);
            } else {
                setShowMentions(false);
            }
        } else {
            setShowMentions(false);
        }
    };

    const handleSelectMention = (participant: any) => {
        const lastAtIndex = newMessage.lastIndexOf('@');
        const beforeAt = newMessage.substring(0, lastAtIndex);
        const inserted = participant.user._id === 'all' ? '@all ' : `@${participant.user._id} `;
        setNewMessage(beforeAt + inserted);
        setShowMentions(false);
    };

    const handleEmojiClick = (emoji: { native: string }) => {
        setNewMessage(prev => prev + emoji.native);
        setEmojiAnchor(null);
    };

    // Header component showing loading when fetching older messages
    const Header = () => {
        if (isFetchingPreviousPage) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                    <CircularProgress size={24} />
                </Box>
            );
        }
        if (!hasPreviousPage && allMessages.length > 0) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        Đã hiển thị tất cả tin nhắn
                    </Typography>
                </Box>
            );
        }
        return null;
    };


    return (
        <Box
            sx={{
                flex: 1,
                display: "flex",
                flexDirection: "row",
                bgcolor: "white",
                height: "100vh",
                overflow: "hidden"
            }}
        >
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                {/* Chat Header */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        p: 2,
                        borderBottom: "1px solid #e4e6eb",
                        bgcolor: "white",
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Badge
                            overlap="circular"
                            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                            variant="dot"
                            sx={{
                                "& .MuiBadge-badge": {
                                    backgroundColor: otherUserStatus.isOnline ? "#31a24c" : "none",
                                    border: "2px solid white",
                                    display: otherUserStatus.isOnline ? "block" : "none",
                                    width: 15,
                                    borderRadius: '50%',
                                    height: 15,
                                },
                            }}
                        >
                            <Avatar src={selectedConversation.avatar} sx={{ width: 40, height: 40 }} />
                        </Badge>
                        <Box>
                            <Typography fontWeight={600} fontSize={15} color="#050505">
                                {selectedConversation.fullName}
                            </Typography>
                            <Typography
                                variant="body2"
                                fontSize={12}
                                color={otherUserStatus.isOnline ? "#31a24c" : "#65676b"}
                            >
                                {statusText}
                            </Typography>
                        </Box>
                    </Box>
                    <Box sx={{ display: "flex", gap: 1 }}>
                        <IconButton
                            size="small"
                            sx={{
                                color: "#1877f2",
                                bgcolor: "#f0f2f5",
                                "&:hover": { bgcolor: "#e4e6eb" },
                            }}
                        >
                            <CallIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                            size="small"
                            sx={{
                                color: "#1877f2",
                                bgcolor: "#f0f2f5",
                                "&:hover": { bgcolor: "#e4e6eb" },
                            }}
                        >
                            <VideocamIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                            onClick={() => setShowInfo(!showInfo)}
                            size="small"
                            sx={{
                                color: showInfo ? "white" : "#1877f2",
                                bgcolor: showInfo ? "#1877f2" : "#f0f2f5",
                                "&:hover": { bgcolor: showInfo ? "#166fe5" : "#e4e6eb" },
                            }}
                        >
                            <InfoIcon fontSize="small" />
                        </IconButton>
                    </Box>
                </Box>

                {/* Messages Area with Virtuoso */}
                <Box sx={{ flex: 1, overflow: "hidden", bgcolor: "white" }}>
                    {isLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <Virtuoso
                            key={selectedConversation._id}
                            ref={virtuosoRef}
                            style={{ height: '100%' }}
                            data={allMessages}
                            firstItemIndex={firstItemIndex}
                            initialTopMostItemIndex={allMessages.length - 1}
                            followOutput="smooth"
                            startReached={handleStartReached}
                            components={{
                                Header,
                            }}
                            itemContent={(index, message) => {
                                const actualIndex = index - firstItemIndex;
                                const isOwn = message.senderId.toString() === userId;
                                const showAvatar = actualIndex === 0 || (allMessages[actualIndex - 1]?.senderId !== message.senderId);

                                return (
                                    <MessageItem
                                        key={message._id}
                                        message={message}
                                        isOwn={isOwn}
                                        showAvatar={showAvatar}
                                        avatar={selectedConversation.avatar}
                                        conversationId={selectedConversation._id}
                                        socket={socketChat}
                                        userId={userId}
                                        onReply={handleReply}
                                        themeColor={themeColor}
                                    />
                                );
                            }}
                        />
                    )}
                </Box>

                {/* Input Area */}
                <Box
                    sx={{
                        p: 2,
                        bgcolor: "white",
                        borderTop: "1px solid #e4e6eb",
                        position: 'relative'
                    }}
                >
                    {/* Mentions List */}
                    {showMentions && filteredParticipants.length > 0 && (
                        <Box
                            sx={{
                                position: 'absolute',
                                bottom: '100%',
                                left: 16,
                                right: 16,
                                bgcolor: 'white',
                                boxShadow: 3,
                                borderRadius: 2,
                                mb: 1,
                                maxHeight: 200,
                                overflowY: 'auto',
                                zIndex: 10
                            }}
                        >
                            <List dense>
                                {filteredParticipants.map((p: any) => (
                                    <MenuItem key={p.user._id} onClick={() => handleSelectMention(p)}>
                                        <ListItemAvatar>
                                            <Avatar src={p.user.avatar} sx={{ width: 24, height: 24 }} />
                                        </ListItemAvatar>
                                        <ListItemText primary={p.nickname || `${p.user.firstName} ${p.user.lastName}`} />
                                    </MenuItem>
                                ))}
                            </List>
                        </Box>
                    )}

                    {/* Reply Preview UI */}
                    {replyMsg && (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                bgcolor: "#f0f2f5",
                                p: 1,
                                px: 2,
                                borderRadius: 2,
                                mb: 1,
                            }}
                        >
                            <Box sx={{ minWidth: 0 }}>
                                <Typography fontSize={12} color="#65676b">
                                    Đang trả lời <strong>{replyMsg.senderId === userId ? "chính mình" : "một tin nhắn"}</strong>
                                </Typography>
                                <Typography fontSize={13} color="#050505" noWrap sx={{ opacity: 0.8 }}>
                                    {replyMsg.content}
                                </Typography>
                            </Box>
                            <IconButton size="small" onClick={handleCancelReply}>
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    )}

                    {/* Media Preview - Premium Style */}
                    {mediaPreview.length > 0 && (
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: mediaPreview.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(100px, 1fr))',
                                gap: 1,
                                mb: 1.5,
                                p: 1.5,
                                bgcolor: '#f0f2f5',
                                borderRadius: 3,
                                maxHeight: 300,
                                overflowY: 'auto'
                            }}
                        >
                            {mediaPreview.map((media, index) => (
                                <Box
                                    key={index}
                                    sx={{
                                        position: 'relative',
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                        aspectRatio: mediaPreview.length === 1 ? 'auto' : '1',
                                        bgcolor: '#000',
                                    }}
                                >
                                    {media.type === 'video' ? (
                                        <>
                                            <video
                                                src={media.url}
                                                style={{
                                                    width: '100%',
                                                    height: mediaPreview.length === 1 ? 'auto' : '100%',
                                                    maxHeight: mediaPreview.length === 1 ? 200 : '100%',
                                                    objectFit: 'cover'
                                                }}
                                            />
                                            <Box sx={{
                                                position: 'absolute',
                                                top: '50%',
                                                left: '50%',
                                                transform: 'translate(-50%, -50%)',
                                                bgcolor: 'rgba(0,0,0,0.6)',
                                                borderRadius: '50%',
                                                width: 40,
                                                height: 40,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <Typography color="white" fontSize={20}>▶</Typography>
                                            </Box>
                                        </>
                                    ) : (
                                        <Box
                                            component="img"
                                            src={media.url}
                                            sx={{
                                                width: '100%',
                                                height: mediaPreview.length === 1 ? 'auto' : '100%',
                                                maxHeight: mediaPreview.length === 1 ? 200 : '100%',
                                                objectFit: 'cover'
                                            }}
                                        />
                                    )}
                                    <IconButton
                                        size="small"
                                        onClick={() => handleRemoveMedia(index)}
                                        sx={{
                                            position: 'absolute',
                                            top: 4,
                                            right: 4,
                                            bgcolor: 'rgba(0,0,0,0.6)',
                                            color: 'white',
                                            p: 0.5,
                                            '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' }
                                        }}
                                    >
                                        <CloseIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </Box>
                            ))}
                        </Box>
                    )}

                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            bgcolor: "#f0f2f5",
                            borderRadius: 5,
                            px: 2,
                            py: 1,
                        }}
                    >
                        <IconButton size="small" sx={{ color: "#0084ff" }}>
                            <AddCircleIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" sx={{ color: "#0084ff" }} onClick={() => fileInputRef.current?.click()}>
                            <InsertPhotoIcon fontSize="small" />
                        </IconButton>
                        <input
                            type="file"
                            ref={fileInputRef}
                            hidden
                            multiple
                            accept="image/*,video/*"
                            onChange={handleFileSelect}
                        />
                        <TextField
                            fullWidth
                            multiline
                            maxRows={4}
                            placeholder="Aa"
                            value={newMessage}
                            onChange={handleInputChange}
                            onKeyPress={handleKeyPress}
                            variant="standard"
                            InputProps={{
                                disableUnderline: true,
                                sx: {
                                    color: "#050505",
                                    fontSize: "15px",
                                    "& .MuiInputBase-input": {
                                        py: 0.5,
                                    },
                                    "&::placeholder": {
                                        color: "#65676b",
                                        opacity: 1,
                                    },
                                },
                            }}
                        />
                        <IconButton size="small" sx={{ color: "#0084ff" }} onClick={(e) => setEmojiAnchor(e.currentTarget)}>
                            <EmojiEmotionsIcon fontSize="small" />
                        </IconButton>
                        {(newMessage.trim() || mediaPreview.length > 0) && (
                            <IconButton onClick={handleSendMessage} size="small" sx={{ color: "#0084ff" }} disabled={isUploading}>
                                {isUploading ? <CircularProgress size={18} /> : <SendIcon fontSize="small" />}
                            </IconButton>
                        )}
                    </Box>
                </Box>
            </Box>


            {/* Emoji Picker Popover */}
            <Popover
                open={Boolean(emojiAnchor)}
                anchorEl={emojiAnchor}
                onClose={() => setEmojiAnchor(null)}
                anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                slotProps={{
                    paper: {
                        sx: {
                            bgcolor: 'transparent',
                            boxShadow: 'none',
                            overflow: 'visible',
                            border: 'none',
                        }
                    }
                }}
            >
                <Picker
                    data={data}
                    onEmojiSelect={handleEmojiClick}
                    theme="light"
                    locale="vi"
                    previewPosition="none"
                    skinTonePosition="none"
                    perLine={8}
                    maxFrequentRows={2}
                />
            </Popover>

            {/* Conversation Info Sidebar */}
            {showInfo && (
                <ConversationInfo
                    conversationId={selectedConversation._id}
                    userId={userId}
                    onClose={() => setShowInfo(false)}
                />
            )}
        </Box>
    );
}
