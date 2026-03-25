"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, CircularProgress, Typography, useMediaQuery, useTheme } from "@mui/material";
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
import { useTranslation } from 'react-i18next';

interface SelectedConversation {
    _id: string;
    fullName: string;
    avatar: string;
    status: "online" | "offline";
    otherId: string;
    lastActive?: string;
    type?: "DIRECT" | "GROUP" | "CHATBOT";
}

export default function ChatDetailPage() {
    const params = useParams();
    const router = useRouter();
    const conversationId = params.id as string;
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const { t } = useTranslation();

    // Mobile sidebar visibility state
    const [showMobileSidebar, setShowMobileSidebar] = useState(false);

    const user = useAuthStore((state) => state.user);
    const { socketChat, socketRelationship } = useSocket();
    const queryClient = useQueryClient();

    // Dynamic tab title for unread messages
    const unreadMsgCount = useRef(0);
    const originalTitle = useRef("Social Chat - Mạng xã hội kết nối bạn bè");

    const updateTabTitle = useCallback((senderName: string) => {
        unreadMsgCount.current += 1;
        document.title = `${senderName} đã gửi ${unreadMsgCount.current} tin nhắn đến bạn`;
    }, []);

    // Reset title when user focuses the tab
    useEffect(() => {
        const title = originalTitle.current;
        const handleFocus = () => {
            unreadMsgCount.current = 0;
            document.title = title;
        };
        window.addEventListener("focus", handleFocus);
        return () => {
            window.removeEventListener("focus", handleFocus);
            document.title = title;
        };
    }, []);

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
        } else if (conv.type === "CHATBOT") {
            const botParticipant = conv.participants.find(p => p.user._id !== userId);
            return {
                _id: conv._id,
                fullName: "BOT AI",
                avatar: botParticipant?.user.avatar || `https://cdn-icons-png.flaticon.com/512/4712/4712027.png`,
                status: 'online',
                otherId: botParticipant?.user._id || '',
                type: "CHATBOT",
            };
        } else {
            // GROUP conversation
            return {
                _id: conv._id,
                fullName: conv.nickname || t('chat.group_chat_default'),
                avatar: conv.avatar || `https://ui-avatars.com/api/?name=G&background=1877f2&color=fff`,
                status: 'online',
                otherId: '',
                type: "GROUP",
            };
        }
    }, [conversationDetail, userId, t]);

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
            // Update tab title if message is from someone else and tab is not focused
            const senderId = typeof msg.senderId === 'object' ? msg.senderId._id : msg.senderId;
            if (senderId !== user.id && !document.hasFocus()) {
                const senderName = typeof msg.senderId === 'object'
                    ? `${msg.senderId.firstName} ${msg.senderId.lastName}`.trim()
                    : 'Ai đó';
                updateTabTitle(senderName);
            }

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
                                    unreadCount: conv.unreadCount,
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

        // Listen for conversation updates to refresh sidebar
        const handleConversationUpdate = () => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATION_BY_USER, user.id] });
        };

        // Handle when current user is added to a group - join room and load messages
        const handleMemberAdded = (data: { conversation: ConversationResponseData; newUserId: string }) => {
            if (data.newUserId === user.id) {
                // Current user was added - join room
                socketChat.emit('room', { conversationId: data.conversation._id });
                // Invalidate conversation list to show new group
                queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATION_BY_USER, user.id] });
                // If viewing this conversation, reload detail and messages
                if (conversationId === data.conversation._id) {
                    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATION_BY_USER, "detail", conversationId] });
                    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CHATS, conversationId] });
                }
            } else {
                // Someone else was added - just refresh conversation list
                handleConversationUpdate();
            }
        };


        // Handle mute toggle update - update mutedBy in conversation cache
        const handleMuteUpdated = (data: { conversationId: string; userId: string; isMuted: boolean }) => {
            queryClient.setQueryData<{ data: ConversationResponseData[] }>(
                [QUERY_KEYS.CONVERSATION_BY_USER, user.id],
                (oldData) => {
                    if (!oldData?.data) return oldData;

                    return {
                        ...oldData,
                        data: oldData.data.map(conv => {
                            if (conv._id === data.conversationId) {
                                const currentMutedBy = conv.mutedBy || [];
                                let newMutedBy: string[];

                                if (data.isMuted) {
                                    newMutedBy = currentMutedBy.includes(data.userId)
                                        ? currentMutedBy
                                        : [...currentMutedBy, data.userId];
                                } else {
                                    newMutedBy = currentMutedBy.filter(id => id !== data.userId);
                                }

                                return { ...conv, mutedBy: newMutedBy };
                            }
                            return conv;
                        })
                    };
                }
            );
        };

        socketChat.on("conversation:member:added", handleMemberAdded);
        socketChat.on("conversation:member:removed", handleConversationUpdate);
        socketChat.on("conversation:member:left", handleConversationUpdate);
        socketChat.on("conversation:kicked", handleConversationUpdate);
        socketChat.on("conversation:avatar:updated", handleConversationUpdate);
        socketChat.on("conversation:name:updated", handleConversationUpdate);
        socketChat.on("conversation:nickname:updated", handleConversationUpdate);
        socketChat.on("conversation:settings:updated", handleConversationUpdate);
        socketChat.on("conversation:created", handleConversationUpdate);
        socketChat.on("conversation:mute:updated", handleMuteUpdated);

        return () => {
            socketChat.off("message:new", handleGlobalMessageNew);
            socketChat.off("conversation:member:added", handleMemberAdded);
            socketChat.off("conversation:member:removed", handleConversationUpdate);
            socketChat.off("conversation:member:left", handleConversationUpdate);
            socketChat.off("conversation:kicked", handleConversationUpdate);
            socketChat.off("conversation:avatar:updated", handleConversationUpdate);
            socketChat.off("conversation:name:updated", handleConversationUpdate);
            socketChat.off("conversation:nickname:updated", handleConversationUpdate);
            socketChat.off("conversation:settings:updated", handleConversationUpdate);
            socketChat.off("conversation:created", handleConversationUpdate);
            socketChat.off("conversation:mute:updated", handleMuteUpdated);
        };
    }, [socketChat, queryClient, user?.id, conversationId, updateTabTitle]);

    // Handle real-time restriction/unrestriction
    useEffect(() => {
        if (!socketRelationship || !user?.id) return;

        const handleConversationHidden = (data: { conversationId: string }) => {
            queryClient.setQueryData<{ data: ConversationResponseData[] }>(
                [QUERY_KEYS.CONVERSATION_BY_USER, user.id],
                (oldData) => {
                    if (!oldData?.data) return oldData;
                    return {
                        ...oldData,
                        data: oldData.data.filter(conv => conv._id !== data.conversationId)
                    };
                }
            );
        };

        const handleUnrestricted = () => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATION_BY_USER, user.id] });
        };

        socketRelationship.on("conversation:hidden", handleConversationHidden);
        socketRelationship.on("user:unrestricted", handleUnrestricted);

        return () => {
            socketRelationship.off("conversation:hidden", handleConversationHidden);
            socketRelationship.off("user:unrestricted", handleUnrestricted);
        };
    }, [socketRelationship, queryClient, user?.id]);

    // Handle select conversation from sidebar
    const handleSelectConversation = (conv: SelectedConversation) => {
        router.push(CLIENT_PATH.CHAT_BY_ID(conv._id));
    };

    // Loading state
    if (isLoadingDetail) {
        return (
            <Box sx={{ display: "flex", height: "100vh", width: "100vw", bgcolor: theme.palette.background.default, position: "relative", overflow: "hidden" }}>
                <ChatSidebar
                    conversations={listConversation?.data || []}
                    isLoading={isLoadingConversations}
                    selectedConversationId={conversationId}
                    onSelectConversation={handleSelectConversation}
                    isMobileVisible={isMobile ? showMobileSidebar : true}
                    onMobileClose={() => setShowMobileSidebar(false)}
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
            <Box sx={{ display: "flex", height: "100vh", width: "100vw", bgcolor: "#f0f2f5", position: "relative", overflow: "hidden" }}>
                <ChatSidebar
                    conversations={listConversation?.data || []}
                    isLoading={isLoadingConversations}
                    selectedConversationId={undefined}
                    onSelectConversation={handleSelectConversation}
                    isMobileVisible={isMobile ? showMobileSidebar : true}
                    onMobileClose={() => setShowMobileSidebar(false)}
                />
                <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: theme.palette.background.default, flexDirection: "column", gap: 2, p: 2 }}>
                    <Typography variant="h6" color="error" textAlign="center">
                        {t('chat.conversation_not_found')}
                    </Typography>
                    <Typography
                        sx={{ color: "#1877f2", cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                        onClick={() => router.push(CLIENT_PATH.CHAT)}
                    >
                        {t('chat.back_to_chat')}
                    </Typography>
                </Box>
            </Box>
        );
    }

    // Handle mobile back button
    const handleMobileBack = () => {
        if (isMobile) {
            setShowMobileSidebar(true);
            router.push(CLIENT_PATH.CHAT);
        }
    };

    return (
        <Box
            suppressHydrationWarning
            className="chat-container"
            sx={{
                display: "flex",
                height: { xs: "100dvh", md: "100vh" },
                width: "100vw",
                bgcolor: "#f0f2f5",
                overflow: "hidden",
                position: "relative",
            }}
        >
            {/* Sidebar - Hidden on mobile when viewing chat */}
            <ChatSidebar
                conversations={listConversation?.data || []}
                isLoading={isLoadingConversations}
                selectedConversationId={selectedConversation?._id}
                onSelectConversation={handleSelectConversation}
                isMobileVisible={isMobile ? showMobileSidebar : true}
                onMobileClose={() => setShowMobileSidebar(false)}
            />

            {/* Main Chat Area */}
            <Box
                className="chat-main"
                sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                    width: { xs: '100%', md: 'auto' },
                    height: { xs: '100dvh', md: '100vh' },
                }}
            >
                {selectedConversation ? (
                    <AreaChatMessages
                        key={selectedConversation._id}
                        selectedConversation={selectedConversation}
                        userId={user?.id || ""}
                        onMobileBack={handleMobileBack}
                        isMobile={isMobile}
                    />
                ) : (
                    <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "white" }}>
                        <CircularProgress />
                    </Box>
                )}
            </Box>
        </Box>
    );
}
