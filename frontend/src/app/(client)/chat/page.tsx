"use client";
import React, { useState, useEffect } from "react";
import { Box, useMediaQuery, useTheme } from "@mui/material";
import { useAuthStore } from "@/stores/useAuthStore";
import { useConversationByUserId } from "@/queries/useConversationQueries";
import AreaChatMessages from "@/components/chats/AreaChatMessage";
import ChatSidebar from "@/components/chats/ChatSidebar";
import { useSocket } from "@/contexts/SocketContext";
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/query-keys";
import { ConversationResponseData } from "@/types/conversation";
import { MessageResponse } from "@/types/chat";
import { useRouter } from "next/navigation";
import { CLIENT_PATH } from "@/constants/paths";

interface SelectedConversation {
    _id: string;
    fullName: string;
    avatar: string;
    status: "online" | "offline";
    otherId: string;
    lastActive?: string;
    type?: "DIRECT" | "GROUP";
}

export default function ChatPage() {
    const user = useAuthStore((state) => state.user);
    const [selectedConversation, setSelectConversation] = useState<SelectedConversation | null>(null);
    const { socketChat } = useSocket();
    const queryClient = useQueryClient();
    const router = useRouter();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const { data: listConversation, isLoading: isLoadingConversations } = useConversationByUserId(user?.id || "");

    // Handle select conversation - navigate to /chat/:id
    const handleSelectConversation = (conv: SelectedConversation) => {
        router.push(CLIENT_PATH.CHAT_BY_ID(conv._id));
    };

    // Listen for global message events - OPTIMISTIC UPDATE for lastMessage
    useEffect(() => {
        if (!socketChat || !user?.id) return;

        const handleGlobalMessageNew = (msg: MessageResponse) => {
            // OPTIMISTIC UPDATE: Update lastMessage immediately in cache
            queryClient.setQueryData<{ data: ConversationResponseData[] }>(
                [QUERY_KEYS.CONVERSATION_BY_USER, user.id],
                (oldData) => {
                    if (!oldData?.data) return oldData;

                    return {
                        ...oldData,
                        data: oldData.data.map(conv => {
                            if (conv._id === msg.conversationId) {
                                return {
                                    ...conv,
                                    lastMessage: {
                                        _id: msg._id,
                                        type: msg.type,
                                        content: msg.content || '',
                                        createdAt: new Date(msg.createdAt),
                                        senderId: typeof msg.senderId === 'object' ? msg.senderId._id : msg.senderId,
                                        attachments: msg.attachments?.map(a => typeof a === 'string' ? a : a.url),
                                    },
                                    lastMessageAt: new Date(msg.createdAt),
                                };
                            }
                            return conv;
                        }).sort((a, b) => {
                            // Sort by lastMessageAt descending
                            const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
                            const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
                            return timeB - timeA;
                        })
                    };
                }
            );
        };

        socketChat.on("message:new", handleGlobalMessageNew);

        // Listen for conversation updates to refresh sidebar
        const handleConversationUpdate = () => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATION_BY_USER, user.id] });
        };

        socketChat.on("conversation:member:added", handleConversationUpdate);
        socketChat.on("conversation:member:removed", handleConversationUpdate);
        socketChat.on("conversation:member:left", handleConversationUpdate);
        socketChat.on("conversation:kicked", handleConversationUpdate);
        socketChat.on("conversation:avatar:updated", handleConversationUpdate);
        socketChat.on("conversation:name:updated", handleConversationUpdate);
        socketChat.on("conversation:nickname:updated", handleConversationUpdate);
        socketChat.on("conversation:settings:updated", handleConversationUpdate);
        socketChat.on("conversation:created", handleConversationUpdate);

        return () => {
            socketChat.off("message:new", handleGlobalMessageNew);
            socketChat.off("conversation:member:added", handleConversationUpdate);
            socketChat.off("conversation:member:removed", handleConversationUpdate);
            socketChat.off("conversation:member:left", handleConversationUpdate);
            socketChat.off("conversation:kicked", handleConversationUpdate);
            socketChat.off("conversation:avatar:updated", handleConversationUpdate);
            socketChat.off("conversation:name:updated", handleConversationUpdate);
            socketChat.off("conversation:nickname:updated", handleConversationUpdate);
            socketChat.off("conversation:settings:updated", handleConversationUpdate);
            socketChat.off("conversation:created", handleConversationUpdate);
        };
    }, [socketChat, queryClient, user?.id]);

    return (
        <Box
            suppressHydrationWarning
            className="chat-container"
            sx={{
                display: "flex",
                height: "100vh",
                width: "100vw",
                bgcolor: "#f0f2f5",
                overflow: "hidden",
                position: "relative",
            }}
        >
            {/* Sidebar - Always visible on main chat page */}
            <ChatSidebar
                conversations={listConversation?.data || []}
                isLoading={isLoadingConversations}
                selectedConversationId={selectedConversation?._id}
                onSelectConversation={handleSelectConversation}
                isMobileVisible={true}
                onMobileClose={() => {}}
            />

            {/* Main Chat Area - Show placeholder on /chat page (hidden on mobile) */}
            <Box
                sx={{
                    flex: 1,
                    display: { xs: "none", md: "flex" },
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "white",
                }}
            >
                <Box sx={{ textAlign: "center", color: "#65676b", p: 3 }}>
                    <svg
                        width="100"
                        height="100"
                        viewBox="0 0 100 100"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{ margin: "0 auto 20px" }}
                    >
                        <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="3" />
                        <path
                            d="M30 60 Q35 45, 50 50 T70 60"
                            stroke="currentColor"
                            strokeWidth="3"
                            fill="none"
                        />
                        <circle cx="35" cy="40" r="3" fill="currentColor" />
                        <circle cx="65" cy="40" r="3" fill="currentColor" />
                    </svg>
                    <p style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px", color: "#050505" }}>
                        Chọn một cuộc trò chuyện
                    </p>
                    <p style={{ fontSize: "14px", color: "#65676b" }}>
                        Chọn một người từ danh sách để bắt đầu trò chuyện
                    </p>
                </Box>
            </Box>
        </Box>
    );
}
