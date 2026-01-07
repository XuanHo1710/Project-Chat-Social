"use client";

import React, { useEffect, useMemo } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useAuthStore } from "@/stores/useAuthStore";
import { useConversationByUserId, useConversationDetail } from "@/queries/useConversationQueries";
import AreaChatMessages from "@/components/chats/AreaChatMessage";
import ChatSidebar from "@/components/chats/ChatSidebar";
import { useSocket } from "@/contexts/SocketContext";
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/query-keys";
import { ConversationResponseData } from "@/types/conversation";
import { MessageResponse } from "@/types/chat";
import { useParams, useRouter } from "next/navigation";
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

export default function ChatDetailPage() {
    const params = useParams();
    const router = useRouter();
    const conversationId = params.id as string;

    const user = useAuthStore((state) => state.user);
    const { socketChat } = useSocket();
    const queryClient = useQueryClient();

    // Fetch all conversations for sidebar
    const { data: listConversation, isLoading: isLoadingConversations } = useConversationByUserId(user?.id || "");

    // Fetch specific conversation detail
    const { data: conversationDetail, isLoading: isLoadingDetail, error: detailError } = useConversationDetail(conversationId);

    // Compute selected conversation from data using useMemo
    const userId = user?.id;
    const selectedConversation = useMemo<SelectedConversation | null>(() => {
        if (!conversationDetail?.data || !userId) return null;

        const conv = conversationDetail.data;

        // Kiểm tra xem user có trong participants không
        const currentParticipant = conv.participants.find(p => p.user._id === userId);
        if (!currentParticipant) {
            return null; // Will handle redirect in useEffect
        }

        if (conv.type === "DIRECT") {
            const otherParticipant = conv.participants.find(p => p.user._id !== userId);
            const chatUser = otherParticipant?.user;
            const nickname = otherParticipant?.nickname;
            const fullName = (!nickname || nickname === "")
                ? `${chatUser?.firstName || ''} ${chatUser?.lastName || ''}`
                : nickname;

            return {
                _id: conv._id,
                fullName,
                avatar: chatUser?.avatar || `https://ui-avatars.com/api/?name=${chatUser?.username?.[0] || 'U'}&background=1877f2&color=fff`,
                status: chatUser?.status === 'ACTIVE' ? 'online' : 'offline',
                otherId: chatUser?._id || '',
                lastActive: chatUser?.lastActive,
                type: "DIRECT",
            };
        } else {
            // GROUP conversation
            return {
                _id: conv._id,
                fullName: conv.nickname || "Nhóm chat",
                avatar: conv.avatar || `https://ui-avatars.com/api/?name=G&background=1877f2&color=fff`,
                status: 'online',
                otherId: '',
                type: "GROUP",
            };
        }
    }, [conversationDetail, userId]);

    // Redirect nếu user không có quyền truy cập
    useEffect(() => {
        if (conversationDetail?.data && userId) {
            const currentParticipant = conversationDetail.data.participants.find(p => p.user._id === userId);
            if (!currentParticipant) {
                router.push(CLIENT_PATH.CHAT);
            }
        }
    }, [conversationDetail, userId, router]);

    // Listen for global message events - OPTIMISTIC UPDATE for lastMessage
    useEffect(() => {
        if (!socketChat || !user?.id) return;

        const handleGlobalMessageNew = (msg: MessageResponse) => {
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
                            const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
                            const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
                            return timeB - timeA;
                        })
                    };
                }
            );
        };

        socketChat.on("message:new", handleGlobalMessageNew);

        return () => {
            socketChat.off("message:new", handleGlobalMessageNew);
        };
    }, [socketChat, queryClient, user?.id]);

    // Handle select conversation from sidebar
    const handleSelectConversation = (conv: SelectedConversation) => {
        router.push(CLIENT_PATH.CHAT_BY_ID(conv._id));
    };

    // Loading state
    if (isLoadingDetail) {
        return (
            <Box sx={{ display: "flex", height: "100vh", bgcolor: "#f0f2f5" }}>
                <ChatSidebar
                    conversations={listConversation?.data || []}
                    isLoading={isLoadingConversations}
                    selectedConversationId={conversationId}
                    onSelectConversation={handleSelectConversation}
                />
                <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "white" }}>
                    <CircularProgress />
                </Box>
            </Box>
        );
    }

    // Error state - conversation not found or access denied
    if (detailError || !conversationDetail?.data) {
        return (
            <Box sx={{ display: "flex", height: "100vh", bgcolor: "#f0f2f5" }}>
                <ChatSidebar
                    conversations={listConversation?.data || []}
                    isLoading={isLoadingConversations}
                    selectedConversationId={undefined}
                    onSelectConversation={handleSelectConversation}
                />
                <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "white", flexDirection: "column", gap: 2 }}>
                    <Typography variant="h6" color="error">
                        Cuộc trò chuyện không tồn tại hoặc bạn không có quyền truy cập
                    </Typography>
                    <Typography
                        sx={{ color: "#1877f2", cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                        onClick={() => router.push(CLIENT_PATH.CHAT)}
                    >
                        Quay lại trang chat
                    </Typography>
                </Box>
            </Box>
        );
    }

    return (
        <Box
            suppressHydrationWarning
            sx={{
                display: "flex",
                height: "100vh",
                bgcolor: "#f0f2f5",
                overflow: "hidden"
            }}
        >
            {/* Sidebar */}
            <ChatSidebar
                conversations={listConversation?.data || []}
                isLoading={isLoadingConversations}
                selectedConversationId={selectedConversation?._id}
                onSelectConversation={handleSelectConversation}
            />

            {/* Main Chat Area */}
            {selectedConversation ? (
                <AreaChatMessages
                    key={selectedConversation._id}
                    selectedConversation={selectedConversation}
                    userId={user?.id || ""}
                />
            ) : (
                <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "white" }}>
                    <CircularProgress />
                </Box>
            )}
        </Box>
    );
}
