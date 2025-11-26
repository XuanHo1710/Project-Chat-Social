"use client";
import React, { useState } from "react";
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
import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import SettingsIcon from "@mui/icons-material/Settings";
import { useAuthStore } from "@/stores/useAuthStore";
import { authService } from "@/services/auth.service";
import { toast } from "sonner";
import { useConversationByUserId } from "@/queries/useConversationQueries";
import AreaChatMessages from "@/components/area-chat-message";
import { formatTime } from "@/utils/formatDate";



interface SelectedConversation {
    _id: string;
    fullName: string;
    avatar: string;
    status: "online" | "offline";
    otherId: string;
}


export default function ChatPage() {
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedConversation, setSelectConversation] = useState<SelectedConversation | null>(null);

    const { data: listConversation, isLoading: isLoadingConversations } = useConversationByUserId(user?.id || "");


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
                                src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.username.charAt(0) || 'User'}&background=667eea&color=fff`}
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
                        {!isLoadingConversations && listConversation?.data.map((conversation, index) => {
                            if (conversation.type !== "DIRECT") return null;

                            // Đối tượng mình đang chat đó
                            const chatUser = conversation.participants.find(p => p.user._id !== user?.id)?.user;
                            return (
                                <ListItemButton
                                    key={index}
                                    selected={selectedConversation?._id === conversation?._id}
                                    onClick={() => {
                                        setSelectConversation({
                                            _id: conversation._id,
                                            fullName: `${chatUser?.firstName} ${chatUser?.lastName}`,
                                            avatar: chatUser?.avatar || `https://ui-avatars.com/api/?name=${(chatUser?.username?.[0] || 'U')}&background=667eea&color=fff`,
                                            status: "online",
                                            otherId: chatUser?._id || "",
                                        })
                                    }}
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
                                        {/* <Badge
                                        overlap="circular"
                                        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                                        variant={chatUser.status === "online" ? "dot" : undefined}
                                        color="success"
                                    > */}
                                        <Avatar
                                            src={
                                                user?.avatar
                                                || `https://ui-avatars.com/api/?name=${(chatUser?.username?.[0] || 'U')}&background=667eea&color=fff`
                                            }
                                            sx={{ width: 48, height: 48 }}
                                        />
                                        {/* </Badge> */}
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={
                                            <Typography noWrap fontWeight={600} fontSize={15} color="white">
                                                {chatUser?.firstName} {chatUser?.lastName}
                                            </Typography>
                                        }
                                        secondary={
                                            <Typography noWrap variant="caption" color="rgba(255,255,255,0.5)" component="span">
                                                {conversation.lastMessage ? conversation.lastMessage.content : "Vui lòng nhắn tin để bắt đầu cuộc trò chuyện"}
                                            </Typography>
                                        }
                                    />
                                    <Typography variant="caption" color="rgba(255,255,255,0.4)">
                                        {conversation.lastMessageAt ? formatTime(conversation.lastMessageAt) : ""}
                                    </Typography>
                                </ListItemButton>
                            );
                        })}
                    </List>
                </Box>
            </Paper>

            {/* Khu vực đổi chat detail nè */}
            {/* Main Chat Area */}
            {selectedConversation &&
                <AreaChatMessages selectedConversation={selectedConversation} userId={user?.id || ""} />
            }
        </Box>
    );
}