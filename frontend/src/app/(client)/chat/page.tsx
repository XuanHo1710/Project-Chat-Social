"use client";
import React, { useState, useRef, useEffect } from "react";
import {
    Box,
    Stack,
    Paper,
    List,
    ListItemButton,
    ListItemAvatar,
    Avatar,
    ListItemText,
    Typography,
    IconButton,
    TextField,
    InputAdornment,
    Badge,
    Menu,
    MenuItem,
    Divider,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import SendIcon from "@mui/icons-material/Send";
import VideocamIcon from "@mui/icons-material/Videocam";
import CallIcon from "@mui/icons-material/Call";
import InfoIcon from "@mui/icons-material/Info";
import InsertPhotoIcon from "@mui/icons-material/InsertPhoto";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import SettingsIcon from "@mui/icons-material/Settings";
import { useAuthStore } from "@/stores/useAuthStore";
import { authService } from "@/services/auth.service";
import { toast } from "sonner";

interface Message {
    id: number;
    senderId: number | string;
    text: string;
    type: "text" | "image";
    imageUrl?: string;
    timestamp: Date;
}

interface ChatUser {
    id: number;
    name: string;
    avatar: string;
    status: "online" | "offline";
    lastMsg: string;
    time: string;
}

const INITIAL_USERS: ChatUser[] = [
    { id: 1, name: "Công nương nemchuazabeth", avatar: "https://i.pravatar.cc/150?u=1", status: "online", lastMsg: "Chào bạn!", time: "31 phút" },
    { id: 2, name: "To Ki", avatar: "https://i.pravatar.cc/150?u=2", status: "offline", lastMsg: "Bạn: I love you too 🥰", time: "1 giờ" },
    { id: 3, name: "Trường Giang", avatar: "https://i.pravatar.cc/150?u=3", status: "online", lastMsg: "Bạn: Cảm giác tự tay làm nó đã", time: "1 giờ" },
];

const INITIAL_MESSAGES: Message[] = [
    { id: 1, senderId: 1, text: "Chào bạn! Bạn khỏe không?", type: "text", timestamp: new Date("2024-01-01T10:00:00") },
    { id: 2, senderId: "me", text: "Mình khỏe, cảm ơn bạn!", type: "text", timestamp: new Date("2024-01-01T10:05:00") },
    { id: 3, senderId: 1, text: "Hôm nay có gì vui không?", type: "text", timestamp: new Date("2024-01-01T10:10:00") },
];

export default function ChatPage() {
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedChat, setSelectedChat] = useState<ChatUser>(INITIAL_USERS[0]);
    const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
    const [newMessage, setNewMessage] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Auto scroll to bottom when new message added
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();

        if (!newMessage.trim()) {
            return;
        }

        const message: Message = {
            id: messages.length + 1,
            senderId: "me",
            text: newMessage,
            type: "text",
            timestamp: new Date(),
        };

        setMessages([...messages, message]);
        setNewMessage("");
        toast.success("Tin nhắn đã được gửi!");
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(e as any);
        }
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = async () => {
        handleMenuClose();
        await authService.logout();
        logout();
        toast.success("Đã đăng xuất thành công!");
        window.location.href = "/auth/login";
    };

    return (
        <Box
            suppressHydrationWarning
            sx={{
                display: "flex",
                height: "100vh",
                bgcolor: "#0a0a0a",
                overflow: "hidden"
            }}
        >
            {/* Sidebar - User List */}
            <Paper
                elevation={0}
                sx={{
                    width: 360,
                    display: "flex",
                    flexDirection: "column",
                    bgcolor: "#1c1c1e",
                    borderRight: "1px solid rgba(255,255,255,0.1)"
                }}
            >
                {/* Sidebar Header */}
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{
                        p: 2,
                        borderBottom: "1px solid rgba(255,255,255,0.05)"
                    }}
                >
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Badge
                            overlap="circular"
                            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                            variant="dot"
                            color="success"
                        >
                            <Avatar
                                src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.username || 'User'}&background=667eea&color=fff`}
                                sx={{ width: 40, height: 40, cursor: "pointer" }}
                                onClick={handleMenuOpen}
                            />
                        </Badge>
                        <Box>
                            <Typography variant="subtitle2" fontWeight={700} color="white">
                                Đoạn chat
                            </Typography>
                            <Typography variant="caption" color="rgba(255,255,255,0.6)">
                                {user?.username || 'User'}
                            </Typography>
                        </Box>
                    </Stack>
                    <IconButton size="small" sx={{ color: "rgba(255,255,255,0.7)" }}>
                        <MoreVertIcon />
                    </IconButton>
                </Stack>

                {/* User Menu */}
                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleMenuClose}
                    transformOrigin={{ horizontal: "left", vertical: "top" }}
                    anchorOrigin={{ horizontal: "left", vertical: "bottom" }}
                    PaperProps={{
                        sx: {
                            mt: 1,
                            minWidth: 220,
                            borderRadius: 2,
                            bgcolor: "#2c2c2e",
                            color: "white",
                            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                        }
                    }}
                >
                    <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <Avatar
                                src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.username || 'User'}&background=667eea&color=fff`}
                                sx={{ width: 48, height: 48 }}
                            />
                            <Box>
                                <Typography variant="subtitle2" fontWeight={700}>
                                    {user?.fullName || user?.username}
                                </Typography>
                                <Typography variant="caption" color="rgba(255,255,255,0.6)">
                                    {user?.email || 'user@example.com'}
                                </Typography>
                            </Box>
                        </Stack>
                    </Box>
                    <MenuItem onClick={handleMenuClose} sx={{ py: 1.5, color: "white" }}>
                        <PersonIcon sx={{ mr: 1.5, fontSize: 20 }} />
                        <Typography variant="body2">Hồ sơ của tôi</Typography>
                    </MenuItem>
                    <MenuItem onClick={handleMenuClose} sx={{ py: 1.5, color: "white" }}>
                        <SettingsIcon sx={{ mr: 1.5, fontSize: 20 }} />
                        <Typography variant="body2">Cài đặt</Typography>
                    </MenuItem>
                    <Divider sx={{ borderColor: "rgba(255,255,255,0.1)" }} />
                    <MenuItem onClick={handleLogout} sx={{ py: 1.5, color: "#ff453a" }}>
                        <LogoutIcon sx={{ mr: 1.5, fontSize: 20 }} />
                        <Typography variant="body2">Đăng xuất</Typography>
                    </MenuItem>
                </Menu>

                {/* Search */}
                <Box sx={{ px: 2, py: 2 }}>
                    <TextField
                        fullWidth
                        placeholder="Tìm kiếm trên Messenger"
                        size="small"
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon sx={{ color: "rgba(255,255,255,0.5)" }} />
                                </InputAdornment>
                            ),
                            sx: {
                                borderRadius: 3,
                                bgcolor: "rgba(255,255,255,0.05)",
                                color: "white",
                                "& .MuiOutlinedInput-notchedOutline": {
                                    border: "none"
                                },
                                "&:hover": {
                                    bgcolor: "rgba(255,255,255,0.08)"
                                }
                            }
                        }}
                    />
                </Box>

                {/* User List */}
                <Box sx={{ flex: 1, overflow: "auto" }}>
                    <List disablePadding>
                        {INITIAL_USERS.map((chatUser) => (
                            <ListItemButton
                                key={chatUser.id}
                                selected={selectedChat.id === chatUser.id}
                                onClick={() => setSelectedChat(chatUser)}
                                sx={{
                                    py: 1.5,
                                    "&.Mui-selected": {
                                        bgcolor: "rgba(102, 126, 234, 0.2)",
                                        "&:hover": {
                                            bgcolor: "rgba(102, 126, 234, 0.3)"
                                        }
                                    },
                                    "&:hover": {
                                        bgcolor: "rgba(255,255,255,0.05)"
                                    }
                                }}
                            >
                                <ListItemAvatar>
                                    <Badge
                                        overlap="circular"
                                        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                                        variant={chatUser.status === "online" ? "dot" : undefined}
                                        color="success"
                                    >
                                        <Avatar src={chatUser.avatar} sx={{ width: 48, height: 48 }} />
                                    </Badge>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={
                                        <Typography noWrap fontWeight={600} fontSize={15} color="white">
                                            {chatUser.name}
                                        </Typography>
                                    }
                                    secondary={
                                        <Typography noWrap variant="caption" color="rgba(255,255,255,0.5)" component="span">
                                            {chatUser.lastMsg}
                                        </Typography>
                                    }
                                />
                                <Typography variant="caption" color="rgba(255,255,255,0.4)">
                                    {chatUser.time}
                                </Typography>
                            </ListItemButton>
                        ))}
                    </List>
                </Box>
            </Paper>

            {/* Main Chat Area */}
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
                            <Avatar src={selectedChat.avatar} sx={{ width: 40, height: 40 }} />
                        </Badge>
                        <Box>
                            <Typography fontWeight={700} fontSize={17} color="white">
                                {selectedChat.name}
                            </Typography>
                            <Typography variant="caption" color="rgba(255,255,255,0.6)">
                                {selectedChat.status === "online" ? "Đang hoạt động" : "Không hoạt động"}
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
                <Box
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
                        {messages.map((msg) => (
                                <Stack
                                    key={msg.id}
                                    direction="row"
                                    spacing={1}
                                    justifyContent={msg.senderId === "me" ? "flex-end" : "flex-start"}
                                    alignItems="center"
                                >
                                    {msg.senderId === "me" && (
                                        <Typography
                                            variant="caption"
                                            color="rgba(255,255,255,0.4)"
                                            sx={{ mt: 0.5, ml: 1, display: "block" }}
                                            textAlign={"right"}
                                            margin={"0 10 0 0"}
                                            suppressHydrationWarning
                                        >
                                            {formatTime(msg.timestamp)}
                                        </Typography>
                                    )}

                                    {msg.senderId !== "me" && (
                                        <Avatar src={selectedChat.avatar} sx={{ width: 32, height: 32 }} />
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
                                            <Typography variant="body1">{msg.text}</Typography>
                                        </Paper>
                                    </Box>
                                    {msg.senderId !== "me" && (
                                        <Typography
                                            variant="caption"
                                            color="rgba(255,255,255,0.4)"
                                            sx={{ mt: 0.5, ml: 1, display: "block" }}
                                            textAlign={"right"}
                                            margin={"0 10 0 0"}
                                            suppressHydrationWarning
                                        >
                                            {formatTime(msg.timestamp)}
                                        </Typography>
                                    )}
                                </Stack>
                        ))}
                        <div ref={messagesEndRef} />
                    </Stack>
                </Box>

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
        </Box>
    );
}