"use client";
import React, { useState, useRef, useEffect } from "react";
import {
    Box,
    Stack,
    Paper,
    Avatar,
    Typography,
    IconButton,
    TextField,
    InputAdornment,
    Badge,
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
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/query-keys";
import { APIResponse } from "@/types/common";
import { Virtuoso } from 'react-virtuoso';


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

    const { data: chatData, isLoading: isLoadingChats } = useChatByConversationId(selectedConversation._id);




    const [newMessage, setNewMessage] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);


    // Auto scroll to bottom when new message added
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };


    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (msg: MessageResponse) => {
            queryClient.setQueryData<APIResponse<MessageResponse[]>>(
                [QUERY_KEYS.CHATS, selectedConversation._id],
                (oldData) => {
                    if (!oldData) {
                        // nếu chưa có dữ liệu, tạo mới
                        return { data: [msg] };
                    }
                    // trả về object mới, data là mảng mới
                    return { ...oldData, data: [...oldData.data, msg] };
                }
            );
        };

        socket.on("message:new", handleNewMessage);

        return () => {
            socket.off("message:new", handleNewMessage);
        };
    }, [socket, queryClient, selectedConversation._id]);

    console.log("Chat Data:", chatData);



    useEffect(() => {
        scrollToBottom();
    }, [chatData]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();

        if (!newMessage.trim()) {
            return;
        }

        const message: SendMessagePayload = {
            conversationId: selectedConversation._id,
            senderId: userId,
            type: "TEXT",
            content: newMessage,
        };

        if (socket) {
            socket.emit("message", message);
        }
        setNewMessage("");
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(e);
        }
    };

    const fetchMoreMessages = () => {

    }

    return (
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            {/* Chat Header */}
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{
                    height: 64,
                    px: 3,
                    borderBottom: "1px solid rgba(255,255,255,0.1)",
                    bgcolor: "#1c1c1e"
                }}
            >
                <Stack direction="row" spacing={2} alignItems="center">
                    <Badge
                        overlap="circular"
                        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                        variant="dot"
                        color="success"
                    >
                        <Avatar src={selectedConversation?.avatar} sx={{ width: 40, height: 40 }} />
                    </Badge>
                    <Box>
                        <Typography fontWeight={700} fontSize={17} color="white">
                            {selectedConversation?.fullName}
                        </Typography>
                        <Typography variant="caption" color="rgba(255,255,255,0.6)">
                            {selectedConversation.status === "online" ? "Đang hoạt động" : "Không hoạt động"}
                        </Typography>
                    </Box>
                </Stack>
                <Stack direction="row" spacing={1}>
                    <IconButton sx={{ color: "rgba(255,255,255,0.7)" }}>
                        <CallIcon />
                    </IconButton>
                    <IconButton sx={{ color: "rgba(255,255,255,0.7)" }}>
                        <VideocamIcon />
                    </IconButton>
                    <IconButton sx={{ color: "rgba(255,255,255,0.7)" }}>
                        <InfoIcon />
                    </IconButton>
                </Stack>
            </Stack>

            {/* Messages Area */}

            {
                !isLoadingChats &&
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Virtuoso
                        data={chatData?.data || []}
                        className="container-chat w-full!"

                        itemContent={(index, msg) =>
                            <Stack
                                key={index}
                                direction="row"
                                padding={"10px"}
                                spacing={1}
                                justifyContent={msg.senderId === userId ? "flex-end" : "flex-start"}
                                alignItems="center"

                            >
                                {msg.senderId === userId && (
                                    <Typography
                                        variant="caption"
                                        color="rgba(255,255,255,0.4)"
                                        sx={{ mt: 0.5, ml: 1, display: "block" }}
                                        textAlign={"right"}
                                        margin={"0 10 0 0"}
                                        suppressHydrationWarning
                                    >
                                        {formatTime(msg?.createdAt)}
                                    </Typography>
                                )}

                                {msg.senderId !== "me" && (
                                    <Avatar src={selectedConversation.avatar} sx={{ width: 32, height: 32 }} />
                                )}
                                <Box sx={{ maxWidth: "70%" }}>
                                    <Paper
                                        sx={{
                                            px: 2,
                                            py: 1.5,
                                            borderRadius: 3,
                                            bgcolor: msg.senderId === "me"
                                                ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                                                : "#2c2c2e",
                                            color: "white",
                                            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                                            background: msg.senderId === "me"
                                                ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                                                : "#2c2c2e"
                                        }}
                                    >
                                        <Typography variant="body1">{msg.content}</Typography>
                                    </Paper>
                                </Box>
                                {msg.senderId !== userId && (
                                    <Typography
                                        variant="caption"
                                        color="rgba(255,255,255,0.4)"
                                        sx={{ mt: 0.5, ml: 1, display: "block" }}
                                        textAlign={"right"}
                                        margin={"0 10 0 0"}
                                        suppressHydrationWarning
                                    >
                                        {formatTime(msg?.createdAt)}
                                    </Typography>
                                )}
                            </Stack>
                        }
                        initialTopMostItemIndex={chatData?.data?.length ? chatData.data.length - 1 : 0} // scroll xuống cuối
                        firstItemIndex={0} // mặc định 0
                        startReached={() => {
                            // scroll lên đầu → load thêm
                            fetchMoreMessages();
                        }}
                        followOutput="smooth" // tự scroll xuống dưới khi có tin nhắn mới
                    />
                </Box>
            }
            {/* <Box
                ref={chatContainerRef}
                sx={{
                    flex: 1,
                    overflow: "auto",
                    p: 3,
                    bgcolor: "#0a0a0a",
                    backgroundImage: "radial-gradient(circle at 1px 1px, rgba(102, 126, 234, 0.05) 1px, transparent 0)",
                    backgroundSize: "40px 40px",
                    "&::-webkit-scrollbar": {
                        width: "8px"
                    },
                    "&::-webkit-scrollbar-track": {
                        background: "transparent"
                    },
                    "&::-webkit-scrollbar-thumb": {
                        background: "rgba(255,255,255,0.2)",
                        borderRadius: "4px",
                        "&:hover": {
                            background: "rgba(255,255,255,0.3)"
                        }
                    }
                }}
            >
                <Stack spacing={2}>
                    {!isLoadingChats && chatData?.data.map((msg, index) => (
                        <Stack
                            key={index}
                            direction="row"
                            spacing={1}
                            justifyContent={msg.senderId === userId ? "flex-end" : "flex-start"}
                            alignItems="center"
                        >
                            {msg.senderId === userId && (
                                <Typography
                                    variant="caption"
                                    color="rgba(255,255,255,0.4)"
                                    sx={{ mt: 0.5, ml: 1, display: "block" }}
                                    textAlign={"right"}
                                    margin={"0 10 0 0"}
                                    suppressHydrationWarning
                                >
                                    {formatTime(msg?.createdAt)}
                                </Typography>
                            )}

                            {msg.senderId !== "me" && (
                                <Avatar src={selectedConversation.avatar} sx={{ width: 32, height: 32 }} />
                            )}
                            <Box sx={{ maxWidth: "70%" }}>
                                <Paper
                                    sx={{
                                        px: 2,
                                        py: 1.5,
                                        borderRadius: 3,
                                        bgcolor: msg.senderId === "me"
                                            ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                                            : "#2c2c2e",
                                        color: "white",
                                        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                                        background: msg.senderId === "me"
                                            ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                                            : "#2c2c2e"
                                    }}
                                >
                                    <Typography variant="body1">{msg.content}</Typography>
                                </Paper>
                            </Box>
                            {msg.senderId !== userId && (
                                <Typography
                                    variant="caption"
                                    color="rgba(255,255,255,0.4)"
                                    sx={{ mt: 0.5, ml: 1, display: "block" }}
                                    textAlign={"right"}
                                    margin={"0 10 0 0"}
                                    suppressHydrationWarning
                                >
                                    {formatTime(msg?.createdAt)}
                                </Typography>
                            )}
                        </Stack>
                    ))}
                    <div ref={messagesEndRef} />
                </Stack>
            </Box> */}

            {/* Message Input */}
            <Box
                component="form"
                onSubmit={handleSendMessage}
                sx={{
                    p: 2,
                    borderTop: "1px solid rgba(255,255,255,0.1)",
                    bgcolor: "#1c1c1e"
                }}
            >
                <Stack direction="row" alignItems="center" spacing={1}>
                    <IconButton
                        sx={{
                            color: "#667eea",
                            transition: "all 0.2s",
                            "&:hover": {
                                transform: "scale(1.1)",
                                bgcolor: "rgba(102, 126, 234, 0.1)"
                            }
                        }}
                    >
                        <AddCircleIcon />
                    </IconButton>
                    <IconButton
                        sx={{
                            color: "#667eea",
                            transition: "all 0.2s",
                            "&:hover": {
                                transform: "scale(1.1)",
                                bgcolor: "rgba(102, 126, 234, 0.1)"
                            }
                        }}
                    >
                        <InsertPhotoIcon />
                    </IconButton>
                    <TextField
                        fullWidth
                        placeholder="Nhập tin nhắn của bạn..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        multiline
                        maxRows={4}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        edge="end"
                                        sx={{
                                            color: "#667eea",
                                            transition: "all 0.2s",
                                            "&:hover": {
                                                transform: "rotate(15deg) scale(1.1)"
                                            }
                                        }}
                                    >
                                        <EmojiEmotionsIcon />
                                    </IconButton>
                                </InputAdornment>
                            ),
                            sx: {
                                borderRadius: 5,
                                bgcolor: "rgba(255,255,255,0.05)",
                                color: "white",
                                transition: "all 0.3s",
                                "& .MuiOutlinedInput-notchedOutline": {
                                    borderColor: "transparent"
                                },
                                "&:hover": {
                                    bgcolor: "rgba(255,255,255,0.08)",
                                    boxShadow: "0 2px 8px rgba(102, 126, 234, 0.15)"
                                },
                                "&.Mui-focused": {
                                    bgcolor: "rgba(255,255,255,0.08)",
                                    boxShadow: "0 4px 12px rgba(102, 126, 234, 0.25)",
                                    "& .MuiOutlinedInput-notchedOutline": {
                                        borderColor: "#667eea"
                                    }
                                }
                            }
                        }}
                    />
                    <IconButton
                        type="submit"
                        disabled={!newMessage.trim()}
                        sx={{
                            bgcolor: newMessage.trim() ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : "rgba(255,255,255,0.1)",
                            background: newMessage.trim() ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : "rgba(255,255,255,0.1)",
                            color: "white",
                            transition: "all 0.2s",
                            "&:hover": {
                                transform: newMessage.trim() ? "scale(1.1)" : "none",
                                background: newMessage.trim() ? "linear-gradient(135deg, #764ba2 0%, #667eea 100%)" : "rgba(255,255,255,0.1)"
                            },
                            "&.Mui-disabled": {
                                color: "rgba(255,255,255,0.3)"
                            }
                        }}
                    >
                        <SendIcon />
                    </IconButton>
                </Stack>
            </Box>
        </Box>
    );
}