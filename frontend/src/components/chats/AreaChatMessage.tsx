"use client";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
    Box,
    Paper,
    Avatar,
    Typography,
    IconButton,
    TextField,
    Badge,
    CircularProgress,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import VideocamIcon from "@mui/icons-material/Videocam";
import CallIcon from "@mui/icons-material/Call";
import InfoIcon from "@mui/icons-material/Info";
import InsertPhotoIcon from "@mui/icons-material/InsertPhoto";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import { useChatByConversationId } from "@/queries/useChatQueries";
import { MessageResponse, SendMessagePayload } from "@/types/chat";
import { formatTime } from "@/utils/formatDate";
import { useSocket } from "@/contexts/SocketContext";
import { useQueryClient, InfiniteData } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/query-keys";
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { MessagesResponse } from "@/services/chat.service";


interface SelectedConversation {
    _id: string;
    fullName: string;
    avatar: string;
    status: "online" | "offline";
    otherId: string;
}



export default function AreaChatMessages({ selectedConversation, userId }: { selectedConversation: SelectedConversation, userId: string }) {
    const { socket } = useSocket();
    const queryClient = useQueryClient();
    const virtuosoRef = useRef<VirtuosoHandle>(null);

    const {
        data: chatData,
        fetchPreviousPage,
        hasPreviousPage,
        isFetchingPreviousPage,
        isLoading
    } = useChatByConversationId(selectedConversation._id);

    const [newMessage, setNewMessage] = useState("");

    // Flatten all pages into single array of messages
    // When fetchPreviousPage is called, new (older) pages are PREPENDED to pages array
    // So pages[0] = oldest page, pages[last] = initial page (newest)
    // Each page.data is already sorted oldest->newest from backend
    const pages = chatData?.pages;
    const allMessages = useMemo(() => {
        if (!pages) return [];
        const messages: MessageResponse[] = [];
        // pages are already in correct order: [oldest_page, ..., newest_page]
        // Just concat them directly
        pages.forEach(page => {
            messages.push(...page.data);
        });
        return messages;
    }, [pages]);

    // Calculate firstItemIndex based on total older messages
    const firstItemIndex = useMemo(() => {
        if (!pages || pages.length <= 1) return 10000;
        // pages[0..n-1] are older pages, pages[n] is the initial (newest) page
        const totalOlderMessages = pages
            .slice(0, -1) // All except the last (initial) page
            .reduce((sum, page) => sum + page.data.length, 0);
        return 10000 - totalOlderMessages;
    }, [pages]);

    // Join conversation room
    useEffect(() => {
        if (!socket || !selectedConversation._id) return;

        socket.emit("room", { conversationId: selectedConversation._id });

        return () => {
            // No leave event in backend, just clean up
        };
    }, [socket, selectedConversation._id]);

    // Listen for new messages
    useEffect(() => {
        if (!socket) return;

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
                    // Thêm message mới vào page đầu tiên (page mới nhất)
                    const newPages = [...oldData.pages];
                    newPages[0] = {
                        ...newPages[0],
                        data: [...newPages[0].data, msg],
                    };
                    return {
                        ...oldData,
                        pages: newPages,
                    };
                }
            );
            // Scroll to bottom khi có tin nhắn mới
            setTimeout(() => {
                virtuosoRef.current?.scrollToIndex({
                    index: 'LAST',
                    behavior: 'smooth',
                });
            }, 100);
        };

        socket.on("message:new", handleNewMessage);

        return () => {
            socket.off("message:new", handleNewMessage);
        };
    }, [socket, selectedConversation._id, queryClient]);

    // Load more messages when scrolling to top
    const handleStartReached = useCallback(() => {
        if (hasPreviousPage && !isFetchingPreviousPage) {
            fetchPreviousPage();
        }
    }, [hasPreviousPage, isFetchingPreviousPage, fetchPreviousPage]);

    const handleSendMessage = () => {
        if (newMessage.trim() && socket) {
            const payload: SendMessagePayload = {
                conversationId: selectedConversation._id,
                senderId: userId,
                type: 'TEXT',
                content: newMessage,
            };
            socket.emit("message", payload);
            setNewMessage("");
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
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
                flexDirection: "column",
                bgcolor: "white",
                height: "100vh",
            }}
        >
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
                                backgroundColor: selectedConversation.status === "online" ? "#31a24c" : "#8a8d91",
                                border: "2px solid white",
                                width: 12,
                                height: 12,
                            },
                        }}
                    >
                        <Avatar src={selectedConversation.avatar} sx={{ width: 40, height: 40 }} />
                    </Badge>
                    <Box>
                        <Typography fontWeight={600} fontSize={15} color="#050505">
                            {selectedConversation.fullName}
                        </Typography>
                        <Typography variant="body2" fontSize={12} color="#65676b">
                            {selectedConversation.status === "online" ? "Đang hoạt động" : "Offline"}
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
                        size="small"
                        sx={{
                            color: "#1877f2",
                            bgcolor: "#f0f2f5",
                            "&:hover": { bgcolor: "#e4e6eb" },
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
                            const isOwn = message.senderId === userId;
                            const showAvatar = actualIndex === 0 || (allMessages[actualIndex - 1]?.senderId !== message.senderId);

                            return (
                                <Box
                                    key={message._id}
                                    sx={{
                                        display: "flex",
                                        justifyContent: isOwn ? "flex-end" : "flex-start",
                                        alignItems: "center",
                                        px: 2,
                                        py: 0.5,
                                        gap: 1,
                                    }}
                                >
                                    {!isOwn && (
                                        <Avatar
                                            src={selectedConversation.avatar}
                                            sx={{
                                                width: 28,
                                                height: 28,
                                                visibility: showAvatar ? "visible" : "hidden",
                                            }}
                                        />
                                    )}
                                    <Box
                                        sx={{
                                            maxWidth: "60%",
                                            display: "flex",
                                            flexDirection: "row",
                                            alignItems: "center",
                                        }}
                                    >
                                        {isOwn &&
                                            <Typography
                                                variant="caption"
                                                color="#65676b"
                                                fontSize={11}
                                                sx={{ mt: 0.5, px: 1 }}
                                            >
                                                {formatTime(message.createdAt)}
                                            </Typography>
                                        }
                                        <Paper
                                            sx={{
                                                p: 1.5,
                                                bgcolor: isOwn ? "#1877f2" : "#f0f2f5",
                                                color: isOwn ? "white" : "#050505",
                                                borderRadius: 4,
                                                wordBreak: "break-word",
                                                boxShadow: "none",
                                            }}
                                        >
                                            <Typography fontSize={15}>{message.content}</Typography>
                                        </Paper>
                                        {!isOwn &&
                                            <Typography
                                                variant="caption"
                                                color="#65676b"
                                                fontSize={11}
                                                sx={{ mt: 0.5, px: 1 }}
                                            >
                                                {formatTime(message.createdAt)}
                                            </Typography>
                                        }
                                    </Box>
                                </Box>
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
                }}
            >
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
                    <IconButton size="small" sx={{ color: "#1877f2" }}>
                        <AddCircleIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" sx={{ color: "#1877f2" }}>
                        <InsertPhotoIcon fontSize="small" />
                    </IconButton>
                    <TextField
                        fullWidth
                        multiline
                        maxRows={4}
                        placeholder="Aa"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
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
                    <IconButton size="small" sx={{ color: "#1877f2" }}>
                        <EmojiEmotionsIcon fontSize="small" />
                    </IconButton>
                    {newMessage.trim() ? (
                        <IconButton onClick={handleSendMessage} size="small" sx={{ color: "#1877f2" }}>
                            <SendIcon fontSize="small" />
                        </IconButton>
                    ) : null}
                </Box>
            </Box>
        </Box>
    );
}
