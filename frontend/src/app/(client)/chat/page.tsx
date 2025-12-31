"use client";
import React, { useState } from "react";
import { Box } from "@mui/material";
import { useAuthStore } from "@/stores/useAuthStore";
import { useConversationByUserId } from "@/queries/useConversationQueries";
import AreaChatMessages from "@/components/chats/AreaChatMessage";
import ChatSidebar from "@/components/chats/ChatSidebar";

interface SelectedConversation {
    _id: string;
    fullName: string;
    avatar: string;
    status: "online" | "offline";
    otherId: string;
    lastActive?: string;
}

export default function ChatPage() {
    const user = useAuthStore((state) => state.user);
    const [selectedConversation, setSelectConversation] = useState<SelectedConversation | null>(null);

    const { data: listConversation, isLoading: isLoadingConversations } = useConversationByUserId(user?.id || "");

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
                onSelectConversation={setSelectConversation}
            />

            {/* Main Chat Area */}
            {selectedConversation ? (
                <AreaChatMessages selectedConversation={selectedConversation} userId={user?.id || ""} />
            ) : (
                <Box
                    sx={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: "white",
                    }}
                >
                    <Box sx={{ textAlign: "center", color: "#65676b" }}>
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
            )}
        </Box>
    );
}
