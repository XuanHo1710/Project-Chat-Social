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
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import DescriptionIcon from "@mui/icons-material/Description";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import BlockIcon from "@mui/icons-material/Block";
import { useChatByConversationId } from "@/queries/useChatQueries";
import { MessageResponse, SendMessagePayload, AttachmentData } from "@/types/chat";
import { useSocket } from "@/contexts/SocketContext";
import { useQueryClient, InfiniteData } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/query-keys";
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { MessagesResponse } from "@/services/chat.service";
import { useOnlineStatusStore, formatLastActiveDetailed } from "@/stores/useOnlineStatusStore";
import { useMessageCacheStore } from "@/stores/useMessageCacheStore";
import MessageItem from "./MessageItem";
import ConversationInfo from "./ConversationInfo";
import { useConversationDetail } from "@/queries/useConversationQueries";
import { uploadChatMedia } from "@/services/cloudinary.service";
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { ConversationParticipant, ConversationResponseData } from "@/types/conversation";
import { toast } from 'sonner';
import { relationshipService } from "@/services/relationship.service";

interface SelectedConversation {
    _id: string;
    fullName: string;
    avatar: string;
    status: "online" | "offline";
    otherId: string;
    lastActive?: string;
    type?: "DIRECT" | "GROUP";
}

export default function AreaChatMessages({ selectedConversation, userId }: { selectedConversation: SelectedConversation, userId: string }) {
    const { socketChat, socketRelationship } = useSocket();
    const queryClient = useQueryClient();
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showInfo, setShowInfo] = useState(false);

    // Get conversation detail for theme
    const { data: conversationDetail } = useConversationDetail(selectedConversation._id);
    const conversation = conversationDetail?.data;
    const themeColor = conversation?.theme || '#0084ff';
    const quickReaction = conversation?.quickReaction || '👍';

    // Check if group is deleted or user was kicked
    const isGroupConversation = conversation?.type === 'GROUP';
    const isGroupDeleted = isGroupConversation && conversation?.isDeleted;
    const currentUserParticipant = conversation?.participants?.find(p => p.user._id === userId);
    const wasKicked = currentUserParticipant?.kickedAt;
    const isAdmin = currentUserParticipant?.isAdmin ?? false;
    const isLeft = currentUserParticipant?.leftAt === undefined ? false : currentUserParticipant?.leftAt !== null;

    // Check if only admin can chat
    const onlyAdminCanChat = isGroupConversation && (conversation?.settings?.onlyAdminCanChat ?? false);
    const canChatBasedOnSettings = !onlyAdminCanChat || isAdmin;

    // Check if current user has blocked the other user (DIRECT only)
    const blockedByMe = !isGroupConversation && conversation?.blockedByMe;
    const [isUnblocking, setIsUnblocking] = useState(false);

    // User can chat if: not deleted, not kicked, not blocked, and (not onlyAdminCanChat OR is admin)
    const canChat = !isGroupDeleted && !wasKicked && canChatBasedOnSettings && !isLeft && !blockedByMe;

    // Handle unblock user
    const handleUnblockUser = async () => {
        if (isUnblocking) return;
        setIsUnblocking(true);
        try {
            // Use socket for real-time update
            if (socketRelationship) {
                socketRelationship.emit('user:unblock', { targetUserId: selectedConversation.otherId }, (response: { success: boolean; error?: string }) => {
                    if (response.success) {
                        toast.success('Đã bỏ chặn người dùng');
                        // Refetch conversation detail to update blockedByMe status
                        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATION_BY_USER, 'detail', selectedConversation._id] });
                        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATIONS] });
                    } else {
                        toast.error(response.error || 'Không thể bỏ chặn người dùng');
                    }
                    setIsUnblocking(false);
                });
            } else {
                // Fallback to REST API
                await relationshipService.unblockUser(selectedConversation.otherId);
                toast.success('Đã bỏ chặn người dùng');
                queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATION_DETAIL, selectedConversation._id] });
                queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATIONS] });
                setIsUnblocking(false);
            }
        } catch (error) {
            console.error('Failed to unblock user:', error);
            toast.error('Không thể bỏ chặn người dùng');
            setIsUnblocking(false);
        }
    };

    // Message for restricted chat
    const getChatRestrictionMessage = () => {
        if (isGroupDeleted) return 'Nhóm đã bị giải tán';
        if (wasKicked) return 'Bạn đã bị mời ra khỏi nhóm';
        if (!canChatBasedOnSettings) return 'Chỉ quản trị viên mới có thể gửi tin nhắn trong nhóm này';
        if (isLeft) return 'Bạn đã rời khỏi nhóm này';
        return '';
    };

    // Generate gradient from theme color
    const getGradientBg = (color: string) => {
        // Darken the color slightly for gradient end
        return `linear-gradient(180deg, ${color}15 0%, ${color}08 50%, #ffffff 100%)`;
    };

    // Get real-time online status - just read from store
    const onlineUsers = useOnlineStatusStore(state => state.onlineUsers);

    const {
        data: chatData,
        fetchPreviousPage,
        hasPreviousPage,
        isFetchingPreviousPage,
        isLoading,
    } = useChatByConversationId(selectedConversation._id);


    const [newMessage, setNewMessage] = useState("");
    const [displayMessage, setDisplayMessage] = useState("");
    const [replyMsg, setReplyMsg] = useState<MessageResponse | null>(null);
    const [mediaPreview, setMediaPreview] = useState<{ file: File; url: string; type: 'image' | 'video' }[]>([]);
    const [filePreview, setFilePreview] = useState<{ file: File; name: string; size: number; type: string }[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null);
    const fileDocInputRef = useRef<HTMLInputElement>(null);

    const [mentionStartIndex, setMentionStartIndex] = useState(-1);


    // Typing indicator states
    const [isOtherTyping, setIsOtherTyping] = useState(false);
    const [usersTyping, setUsersTyping] = useState<ConversationParticipant[]>([]);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastTypingEmitRef = useRef<number>(0);

    // Check if this is a group conversation
    const isGroup = selectedConversation.type === 'GROUP';

    // Real-time status from store (only for DIRECT)
    const otherUserStatus = useMemo(() => {
        if (isGroup) {
            return { isOnline: false, lastActive: undefined };
        }
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
    }, [isGroup, onlineUsers, selectedConversation.otherId, selectedConversation.status, selectedConversation.lastActive]);

    // Status display text
    const statusText = useMemo(() => {
        if (isGroup) {
            // Show member count for groups
            const activeMembers = conversationDetail?.data?.participants.filter(p => !p.kickedAt && !p.leftAt).length || 0;
            return `${activeMembers} thành viên`;
        }
        if (otherUserStatus.isOnline) {
            return 'Đang hoạt động';
        }
        return formatLastActiveDetailed(otherUserStatus.lastActive);
    }, [isGroup, otherUserStatus, conversationDetail]);

    // Flatten all pages into single array of messages
    const pages = chatData?.pages;
    const allMessages = useMemo(() => {
        if (!pages) return [];
        const messages: MessageResponse[] = [];
        pages.forEach(page => {
            messages.push(...page.data);
        });

        // Note: Message filtering by kickedAt/leftAt is handled on backend for security

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

    // Consume pending messages when opening conversation
    useEffect(() => {
        const pendingMessages = useMessageCacheStore.getState().consumePendingMessages(selectedConversation._id);

        if (pendingMessages.length > 0) {
            queryClient.setQueryData<InfiniteData<MessagesResponse>>(
                [QUERY_KEYS.CHATS, selectedConversation._id],
                (oldData) => {
                    if (!oldData) {
                        return {
                            pages: [{ data: pendingMessages, pagination: { page: 1, limit: 15, total: pendingMessages.length, hasMore: false } }],
                            pageParams: [undefined],
                        };
                    }

                    // Merge pending messages into cache, avoiding duplicates
                    const existingIds = new Set(oldData.pages.flatMap(p => p.data.map(m => m._id)));
                    const newMessages = pendingMessages.filter(m => !existingIds.has(m._id));

                    if (newMessages.length === 0) {
                        // Just update existing messages (for edits, reactions, read status)
                        const newPages = oldData.pages.map(page => ({
                            ...page,
                            data: page.data.map(msg => {
                                const updated = pendingMessages.find(p => p._id === msg._id);
                                return updated || msg;
                            })
                        }));
                        return { ...oldData, pages: newPages };
                    }

                    // Add new messages to the last page
                    const newPages = [...oldData.pages];
                    const lastPageIndex = newPages.length - 1;
                    newPages[lastPageIndex] = {
                        ...newPages[lastPageIndex],
                        data: [...newPages[lastPageIndex].data, ...newMessages],
                    };
                    return { ...oldData, pages: newPages };
                }
            );
        }
    }, [selectedConversation._id, queryClient]);

    // Join conversation room and mark as read
    useEffect(() => {
        if (!socketChat || !selectedConversation._id) return;
        socketChat.emit("room", { conversationId: selectedConversation._id });

        // OPTIMISTIC UPDATE: Reset unread count immediately in local cache
        queryClient.setQueryData<{ data: ConversationResponseData[] }>(
            [QUERY_KEYS.CONVERSATION_BY_USER, userId],
            (oldData) => {
                if (!oldData?.data) return oldData;
                return {
                    ...oldData,
                    data: oldData.data.map(conv => {
                        if (conv._id === selectedConversation._id && conv.unreadCount) {
                            return {
                                ...conv,
                                unreadCount: {
                                    ...conv.unreadCount,
                                    [userId]: 0
                                }
                            };
                        }
                        return conv;
                    })
                };
            }
        );

        // Then emit to server (background sync)
        socketChat.emit("message:read", { conversationId: selectedConversation._id });

        // Query online status of the other user when opening chat (only for DIRECT)
        if (selectedConversation.type !== 'GROUP' && selectedConversation.otherId) {
            socketChat.emit("user:status", { userId: selectedConversation.otherId }, (response: { userId: string; isOnline: boolean; status: string; lastActive?: string }) => {
                if (response) {
                    const store = useOnlineStatusStore.getState();
                    if (response.status === 'HIDDEN') {
                        // User has hidden activity status - show as offline without lastActive
                        store.setUserOffline(response.userId, undefined);
                    } else if (response.isOnline) {
                        store.setUserOnline(response.userId);
                    } else {
                        store.setUserOffline(response.userId, response.lastActive);
                    }
                }
            });
        }

        return () => {
            // No leave event in backend, just clean up
        }
    }, [socketChat, selectedConversation._id, userId, selectedConversation.otherId, selectedConversation.type, queryClient]);

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
            // IMPORTANT: Only add message if it belongs to current conversation
            if (msg.conversationId !== selectedConversation._id) {
                return;
            }

            // Clear this message from pending cache since we're handling it here
            useMessageCacheStore.getState().clearPending(selectedConversation._id);

            queryClient.setQueryData<InfiniteData<MessagesResponse>>(
                [QUERY_KEYS.CHATS, selectedConversation._id],
                (oldData) => {
                    if (!oldData) {
                        return {
                            pages: [{ data: [msg], pagination: { page: 1, limit: 15, total: 1, hasMore: false } }],
                            pageParams: [undefined],
                        };
                    }

                    // Check if message already exists (avoid duplicates)
                    const exists = oldData.pages.some(p => p.data.some(m => m._id === msg._id));
                    if (exists) {
                        return oldData;
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

            // If message is from other user and we're viewing this conversation, mark as read immediately
            if (msg.senderId?._id !== userId) {
                socketChat.emit("message:read", { conversationId: selectedConversation._id });
            }

            // Scroll to bottom when new message
            setTimeout(() => {
                virtuosoRef.current?.scrollToIndex({
                    index: 'LAST',
                    behavior: 'smooth',
                });
            }, 100);
        };

        const handleMessageEdited = (msg: MessageResponse) => {
            if (msg.conversationId !== selectedConversation._id) {
                return;
            }
            updateMessageInCache(msg);
        };

        const handleMessageReaction = (msg: MessageResponse) => {
            if (msg.conversationId !== selectedConversation._id) {
                return;
            }
            updateMessageInCache(msg);
        };

        const handleMessageDeleted = (msg: MessageResponse) => {
            if (msg.conversationId !== selectedConversation._id) {
                return;
            }
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
        socketChat.on("conversation:created", handleConversationUpdate);
        socketChat.on("conversation:nickname:updated", handleConversationUpdate);
        socketChat.on("conversation:name:updated", handleConversationUpdate);
        socketChat.on("conversation:avatar:updated", handleConversationUpdate);
        socketChat.on("conversation:quick-reaction:updated", handleConversationUpdate);
        socketChat.on("conversation:member:added", handleConversationUpdate);
        socketChat.on("conversation:member:removed", handleConversationUpdate);
        socketChat.on("conversation:member:left", handleConversationUpdate);
        socketChat.on("conversation:kicked", handleConversationUpdate);
        socketChat.on("conversation:admin:updated", handleConversationUpdate);
        socketChat.on("conversation:settings:updated", handleConversationUpdate);

        // Handle message read updates
        const handleMessageReadUpdate = (data: {
            conversationId: string;
            readBy: { _id: string; firstName: string; lastName: string; avatar?: string } | null;
            readByUserId: string;
            modifiedCount: number;
        }) => {
            if (data.conversationId === selectedConversation._id && data.readBy) {
                // Skip if reader is current user (don't mark my messages as read by myself)
                if (data.readByUserId === userId) {
                    return;
                }
                // Mark all my messages as read in cache
                queryClient.setQueryData<InfiniteData<MessagesResponse>>(
                    [QUERY_KEYS.CHATS, selectedConversation._id],
                    (oldData) => {
                        if (!oldData) return oldData;
                        const newPages = oldData.pages.map(page => ({
                            ...page,
                            data: page.data.map(msg => {
                                // Check if this is my message (handle both object and string senderId)
                                const senderId = typeof msg.senderId === 'object' ? msg.senderId._id : msg.senderId;
                                const isMyMessage = senderId === userId || senderId?.toString() === userId;

                                if (isMyMessage) {
                                    // Check if this user already exists in readBy array
                                    const alreadyRead = msg.readBy?.some(r => r._id === data.readBy!._id);
                                    if (alreadyRead) {
                                        return msg;
                                    }
                                    // Add new reader to readBy array and update status
                                    return {
                                        ...msg,
                                        status: 'READ' as const,
                                        readBy: [...(msg.readBy || []), data.readBy!]
                                    };
                                }
                                return msg;
                            })
                        }));
                        return { ...oldData, pages: newPages };
                    }
                );
            }
        };

        socketChat.on("message:read:updated", handleMessageReadUpdate);

        // Handle unread count updates - OPTIMISTIC UPDATE in local cache
        const handleUnreadUpdate = (data?: { conversationId?: string; userId?: string }) => {
            // If it's a reset for current user viewing this conversation, update cache immediately
            if (data?.conversationId && data?.userId) {
                queryClient.setQueryData<{ data: ConversationResponseData[] }>(
                    [QUERY_KEYS.CONVERSATION_BY_USER, userId],
                    (oldData) => {
                        if (!oldData?.data) return oldData;
                        return {
                            ...oldData,
                            data: oldData.data.map(conv => {
                                if (conv._id === data.conversationId && conv.unreadCount) {
                                    return {
                                        ...conv,
                                        unreadCount: {
                                            ...conv.unreadCount,
                                            [data.userId!]: 0
                                        }
                                    };
                                }
                                return conv;
                            })
                        };
                    }
                );
            }
        };

        // Handle unread increment when someone sends a message
        const handleUnreadIncrement = (data?: { conversationId?: string; senderId?: string }) => {
            // If message is NOT from current user, increment unread for current user
            if (data?.conversationId && data?.senderId !== userId) {
                // Only increment if NOT viewing this conversation
                if (data.conversationId !== selectedConversation._id) {
                    queryClient.setQueryData<{ data: ConversationResponseData[] }>(
                        [QUERY_KEYS.CONVERSATION_BY_USER, userId],
                        (oldData) => {
                            if (!oldData?.data) return oldData;
                            return {
                                ...oldData,
                                data: oldData.data.map(conv => {
                                    if (conv._id === data.conversationId) {
                                        const currentCount = conv.unreadCount?.[userId] || 0;
                                        return {
                                            ...conv,
                                            unreadCount: {
                                                ...conv.unreadCount,
                                                [userId]: currentCount + 1
                                            }
                                        };
                                    }
                                    return conv;
                                })
                            };
                        }
                    );
                }
            }
        };

        socketChat.on("conversation:unread:updated", handleUnreadIncrement);
        socketChat.on("conversation:unread:reset", handleUnreadUpdate);

        return () => {
            socketChat.off("message:new", handleNewMessage);
            socketChat.off("message:edited", handleMessageEdited);
            socketChat.off("message:reaction:updated", handleMessageReaction);
            socketChat.off("message:deleted", handleMessageDeleted);
            socketChat.off("conversation:updated", handleConversationUpdate);
            socketChat.off("conversation:created", handleConversationUpdate);
            socketChat.off("conversation:nickname:updated", handleConversationUpdate);
            socketChat.off("conversation:name:updated", handleConversationUpdate);
            socketChat.off("conversation:avatar:updated", handleConversationUpdate);
            socketChat.off("conversation:quick-reaction:updated", handleConversationUpdate);
            socketChat.off("conversation:member:added", handleConversationUpdate);
            socketChat.off("conversation:member:removed", handleConversationUpdate);
            socketChat.off("conversation:member:left", handleConversationUpdate);
            socketChat.off("conversation:kicked", handleConversationUpdate);
            socketChat.off("conversation:admin:updated", handleConversationUpdate);
            socketChat.off("conversation:settings:updated", handleConversationUpdate);
            socketChat.off("message:read:updated", handleMessageReadUpdate);
            socketChat.off("conversation:unread:updated", handleUnreadIncrement);
            socketChat.off("conversation:unread:reset", handleUnreadUpdate);
        };
    }, [socketChat, selectedConversation._id, queryClient, updateMessageInCache, userId]);

    // Typing indicator listener
    useEffect(() => {
        if (!socketChat) return;

        const handleTypingStart = (data: { conversationId: string; userId: string }) => {
            if (data.conversationId === selectedConversation._id && data.userId !== userId) {
                setIsOtherTyping(true);
                const userTyping = conversation?.participants.find(p => p.user._id === data.userId);
                if (!userTyping) return;
                const newUserTypings = usersTyping.filter(u => u.user._id !== userTyping.user._id)
                setUsersTyping([...newUserTypings, userTyping]);
                // Clear existing timeout
                if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                }

                // Auto-hide after 3 seconds
                typingTimeoutRef.current = setTimeout(() => {
                    setIsOtherTyping(false);
                }, 3000);
            }
        };

        const handleTypingStop = (data: { conversationId: string; userId: string }) => {
            if (data.conversationId === selectedConversation._id && data.userId !== userId) {
                const userTypingsLeft = usersTyping.filter(u => u.user._id !== data.userId);
                setUsersTyping([...userTypingsLeft]);
                if (userTypingsLeft.length === 0)
                    setIsOtherTyping(false);
                if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                }
            }
        };

        // Also hide typing when new message arrives
        const handleNewMessageTyping = (msg: MessageResponse) => {
            if (msg.conversationId === selectedConversation._id && msg.senderId._id !== userId) {
                const userTypingsLeft = usersTyping.filter(u => u.user._id !== msg.senderId._id);
                setUsersTyping([...userTypingsLeft]);
                setIsOtherTyping(false);
                if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                }
            }
        };

        socketChat.on("typing:start", handleTypingStart);
        socketChat.on("typing:stop", handleTypingStop);
        socketChat.on("message:new", handleNewMessageTyping);

        return () => {
            socketChat.off("typing:start", handleTypingStart);
            socketChat.off("typing:stop", handleTypingStop);
            socketChat.off("message:new", handleNewMessageTyping);
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, [socketChat, selectedConversation._id, userId, setUsersTyping, usersTyping, conversation]);


    const [showMentions, setShowMentions] = useState(false);
    const [mentionSearch, setMentionSearch] = useState("");

    // Keep track of the mention map from the original value
    const mentionMapRef = useRef<Map<string, string>>(new Map());


    const filteredParticipants = useMemo(() => {
        if (!mentionSearch) return conversationDetail?.data?.participants || [];
        return (conversationDetail?.data?.participants || []).filter(p =>
            (p.nickname || `${p.user.firstName} ${p.user.lastName}`).toLowerCase().includes(mentionSearch.toLowerCase())
        );
    }, [conversationDetail, mentionSearch]);

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

    // Handle document file selection
    const handleDocFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const newFiles: { file: File; name: string; size: number; type: string }[] = [];
        Array.from(files).forEach(file => {
            newFiles.push({
                file,
                name: file.name,
                size: file.size,
                type: file.type || 'application/octet-stream'
            });
        });
        setFilePreview(prev => [...prev, ...newFiles]);
        e.target.value = '';
    };

    const handleRemoveFile = (index: number) => {
        setFilePreview(prev => prev.filter((_, i) => i !== index));
    };

    // Helper to format file size
    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    // Get file icon based on type
    const getFileIcon = (type: string) => {
        if (type.includes('pdf')) return <PictureAsPdfIcon sx={{ color: '#e74c3c' }} />;
        if (type.includes('word') || type.includes('document')) return <DescriptionIcon sx={{ color: '#2b5797' }} />;
        if (type.includes('sheet') || type.includes('excel')) return <DescriptionIcon sx={{ color: '#1d6f42' }} />;
        return <InsertDriveFileIcon sx={{ color: '#65676b' }} />;
    };

    const handleSendMessage = async () => {
        if ((!newMessage.trim() && mediaPreview.length === 0 && filePreview.length === 0) || !socketChat) return;

        setIsUploading(true);
        try {
            let attachments: AttachmentData[] = [];
            let messageType: 'TEXT' | 'IMAGE' | 'FILE' = 'TEXT';

            // Upload media if any
            if (mediaPreview.length > 0) {
                const files = mediaPreview.map(m => m.file);
                const uploadResult = await uploadChatMedia(files);
                if (uploadResult.success) {
                    attachments = uploadResult.results.map(u => ({
                        url: u.url,
                        fileName: u.fileName,
                        fileSize: u.fileSize,
                        mediaType: u.mediaType
                    }));
                    messageType = newMessage.trim() ? 'TEXT' : 'IMAGE';
                } else {
                    console.error("Upload failed");
                    setIsUploading(false);
                    return;
                }
            }

            // Upload document files if any
            if (filePreview.length > 0) {
                const files = filePreview.map(f => f.file);
                const uploadResult = await uploadChatMedia(files);
                if (uploadResult.success) {
                    const docAttachments = uploadResult.results.map(u => ({
                        url: u.url,
                        fileName: u.fileName,
                        fileSize: u.fileSize,
                        mediaType: u.mediaType
                    }));
                    attachments = [...attachments, ...docAttachments];
                    messageType = newMessage.trim() ? 'TEXT' : 'FILE';
                } else {
                    console.error("File upload failed");
                    setIsUploading(false);
                    return;
                }
            }

            const payload: SendMessagePayload = {
                conversationId: selectedConversation._id,
                senderId: userId,
                type: messageType,
                content: newMessage || '',
                attachments: attachments.length > 0 ? attachments : undefined,
                replyTo: replyMsg?._id,
            };

            // Stop typing indicator before sending
            socketChat.emit("typing:stop", { conversationId: selectedConversation._id });

            // Send message with callback to handle errors
            socketChat.emit("message", payload, (response: { success: boolean; error?: string }) => {
                if (response && !response.success) {
                    toast.error(response.error || 'Không thể gửi tin nhắn');
                }
            });
            setNewMessage("");
            setDisplayMessage("");
            setReplyMsg(null);
            setMediaPreview([]);
            setFilePreview([]);
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

    // Emit typing indicator (throttled to avoid spam)
    const emitTyping = useCallback(() => {
        if (!socketChat) return;

        const now = Date.now();
        // Only emit every 2 seconds to avoid spamming
        if (now - lastTypingEmitRef.current > 2000) {
            socketChat.emit("typing:start", { conversationId: selectedConversation._id });
            lastTypingEmitRef.current = now;
        }
    }, [socketChat, selectedConversation._id]);


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const cursorPos = e.target.selectionStart ?? value.length;

        setDisplayMessage(value);


        // Emit typing indicator when user types
        if (value.length > 0) {
            emitTyping();
        } else {
            // Stop typing when input is empty
            socketChat?.emit("typing:stop", { conversationId: selectedConversation._id });
        }


        // Detect @ symbol for suggestions
        let isDetectingMention = false;

        // ---- DETECT MENTION ----
        const textBeforeCursor = value.slice(0, cursorPos);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        if (lastAtIndex !== -1) {
            const charBeforeAt =
                lastAtIndex === 0 ? ' ' : textBeforeCursor[lastAtIndex - 1];

            if (charBeforeAt === ' ' || charBeforeAt === '\n') {
                const query = textBeforeCursor.slice(lastAtIndex + 1);

                if (!query.includes(' ')) {
                    setShowMentions(true);
                    setMentionSearch(query);
                    setMentionStartIndex(lastAtIndex);
                    isDetectingMention = true;
                }
            }
        }

        if (!isDetectingMention) {
            setShowMentions(false);
            setMentionSearch('');
            setMentionStartIndex(-1);
        }

        // ---- BUILD RAW (LUÔN CHẠY) ----
        const raw = buildRawFromDisplay(value, mentionMapRef.current);
        setNewMessage(raw);
    };



    function buildRawFromDisplay(
        display: string,
        map: Map<string, string>
    ): string {
        let raw = display;

        map.forEach((rawMention, displayMention) => {
            const escaped = displayMention.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            raw = raw.replace(new RegExp(escaped, 'g'), rawMention);
        });

        return raw;
    }


    const handleSelectMention = (participant: ConversationParticipant) => {
        const displayName =
            participant.nickname ||
            `${participant.user.firstName} ${participant.user.lastName}`;

        const displayMention = `@${displayName}`;
        const rawMention = `@[${participant.user.username}:${displayName}]`;

        // ✅ SET MAP TRƯỚC
        mentionMapRef.current.set(displayMention, rawMention);

        const before = displayMessage.slice(0, mentionStartIndex);
        const after = displayMessage.slice(
            mentionStartIndex + mentionSearch.length + 1
        );

        const newDisplay = `${before}${displayMention} ${after}`;
        setDisplayMessage(newDisplay);

        const newRaw = buildRawFromDisplay(newDisplay, mentionMapRef.current);
        setNewMessage(newRaw);

        setShowMentions(false);
        setMentionSearch('');
        setMentionStartIndex(-1);
    };



    const handleEmojiClick = (emoji: { native: string }) => {
        setNewMessage(prev => prev + emoji.native);
        setEmojiAnchor(null);
    };

    // Send quick reaction as a message
    const handleSendQuickReaction = () => {
        if (!socketChat) return;

        const payload: SendMessagePayload = {
            conversationId: selectedConversation._id,
            senderId: userId,
            type: 'TEXT',
            content: quickReaction,
        };

        socketChat.emit("message", payload);
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
                <Box sx={{ flex: 1, overflow: "hidden", background: getGradientBg(themeColor) }}>
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
                                const isOwn = message.senderId._id?.toString() === userId || message.senderId.toString() === userId;
                                const showAvatar = actualIndex === 0 || (allMessages[actualIndex - 1]?.senderId !== message.senderId);
                                // Find last own message for showing read avatar
                                const lastOwnMessageIndex = allMessages.map((m, i) =>
                                    (m.senderId._id?.toString() === userId || m.senderId.toString() === userId) ? i : -1
                                ).filter(i => i !== -1).pop();
                                const isLastOwnMessage = actualIndex === lastOwnMessageIndex;

                                // Get avatars of users who read the message, excluding the sender
                                const senderId = message.senderId._id?.toString() || message.senderId.toString();
                                const otherAvatarsNotRead = message.readBy
                                    ?.filter(r => r._id !== senderId && r._id !== userId) // Exclude sender and current user
                                    .map(r => r.avatar)
                                    .filter(avatar => avatar !== undefined) || [];

                                return (
                                    conversationDetail?.data &&
                                    <MessageItem
                                        key={message._id}
                                        message={message}
                                        isOwn={isOwn}
                                        showAvatar={showAvatar}
                                        avatar={message.senderId.avatar}
                                        conversation={conversationDetail?.data}
                                        socket={socketChat}
                                        userId={userId}
                                        onReply={handleReply}
                                        themeColor={themeColor}
                                        isLastOwnMessage={isLastOwnMessage}
                                        otherAvatarsNotRead={otherAvatarsNotRead}
                                    />
                                );
                            }}
                        />
                    )}
                </Box>

                {/* Typing Indicator */}
                {isOtherTyping && usersTyping.length > 0 && usersTyping.map((userTyping) => (
                    <Box
                        key={userTyping.user._id}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            px: 2,
                            py: 1,
                            bgcolor: 'white',
                        }}
                    >
                        <Avatar
                            src={userTyping.user.avatar || ""}
                            sx={{ width: 28, height: 28 }}
                        />
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                bgcolor: '#e4e6eb',
                                borderRadius: '18px',
                                px: 1.5,
                                py: 1,
                            }}
                        >
                            <Box
                                sx={{
                                    display: 'flex',
                                    gap: '4px',
                                    alignItems: 'center',
                                }}
                            >
                                {[0, 1, 2].map((i) => (
                                    <Box
                                        key={i}
                                        sx={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: '50%',
                                            bgcolor: '#65676b',
                                            animation: 'typingBounce 1.4s infinite ease-in-out',
                                            animationDelay: `${i * 0.2}s`,
                                            '@keyframes typingBounce': {
                                                '0%, 80%, 100%': {
                                                    transform: 'scale(0.6)',
                                                    opacity: 0.5,
                                                },
                                                '40%': {
                                                    transform: 'scale(1)',
                                                    opacity: 1,
                                                },
                                            },
                                        }}
                                    />
                                ))}
                            </Box>
                        </Box>
                        <Typography fontSize={14} color="#65676b">
                            {userTyping.nickname || `${userTyping.user.firstName} ${userTyping.user.lastName}`} đang nhập...
                        </Typography>
                    </Box>
                ))}

                {/* Group Deleted or Kicked or Restricted Notice */}
                {!canChat && !blockedByMe && (
                    <Box
                        sx={{
                            p: 3,
                            bgcolor: isGroupDeleted || wasKicked ? '#fff3cd' : '#e3f2fd',
                            borderTop: isGroupDeleted || wasKicked ? '1px solid #ffc107' : '1px solid #2196f3',
                            textAlign: 'center'
                        }}
                    >
                        <Typography color={isGroupDeleted || wasKicked ? '#856404' : '#1565c0'} fontWeight={500}>
                            {isGroupDeleted}{getChatRestrictionMessage()}
                        </Typography>
                    </Box>
                )}

                {/* Blocked User Notice */}
                {blockedByMe && (
                    <Box
                        sx={{
                            p: 2,
                            bgcolor: '#fef2f2',
                            borderTop: '1px solid #fecaca',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 2
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <BlockIcon sx={{ color: '#dc2626', fontSize: 20 }} />
                            <Typography color="#dc2626" fontWeight={500} fontSize={14}>
                                Bạn đã chặn người dùng này
                            </Typography>
                        </Box>
                        <Box
                            component="button"
                            onClick={handleUnblockUser}
                            disabled={isUnblocking}
                            sx={{
                                bgcolor: '#dc2626',
                                color: 'white',
                                border: 'none',
                                borderRadius: 2,
                                px: 2,
                                py: 0.75,
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: isUnblocking ? 'not-allowed' : 'pointer',
                                opacity: isUnblocking ? 0.7 : 1,
                                transition: 'all 0.2s',
                                '&:hover': {
                                    bgcolor: isUnblocking ? '#dc2626' : '#b91c1c',
                                }
                            }}
                        >
                            {isUnblocking ? 'Đang xử lý...' : 'Bỏ chặn'}
                        </Box>
                    </Box>
                )}

                {/* Input Area - Only show if can chat */}
                {canChat && (
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
                                    {filteredParticipants.map((p: ConversationParticipant) => (
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
                                        Đang trả lời <strong>{replyMsg?.senderId._id === userId ? "chính mình" : replyMsg.senderId.firstName + " " + replyMsg.senderId.lastName}</strong>
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

                        {/* Media Preview - Messenger Style */}
                        {mediaPreview.length > 0 && (
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    mb: 1.5,
                                    p: 1.5,
                                    bgcolor: 'white',
                                    borderRadius: 1,
                                    overflowX: 'auto',
                                }}
                            >
                                {/* Add media button */}
                                <Box
                                    sx={{
                                        width: 80,
                                        height: 80,
                                        borderRadius: 2,
                                        border: '2px dashed #555',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        flexShrink: 0,
                                        '&:hover': { borderColor: '#777' }
                                    }}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <AddCircleIcon sx={{ color: '#aaa', fontSize: 28 }} />
                                </Box>
                                {mediaPreview.map((media, index) => (
                                    <Box
                                        key={index}
                                        sx={{
                                            position: 'relative',
                                            width: 80,
                                            height: 80,
                                            borderRadius: 2,
                                            overflow: 'hidden',
                                            flexShrink: 0,
                                            bgcolor: '#242526',
                                            border: '1px solid #444',
                                        }}
                                    >
                                        {media.type === 'video' ? (
                                            <>
                                                <video
                                                    src={media.url}
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
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
                                                    width: 24,
                                                    height: 24,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <Typography color="white" fontSize={12}>▶</Typography>
                                                </Box>
                                            </>
                                        ) : (
                                            <Box
                                                component="img"
                                                src={media.url}
                                                sx={{
                                                    width: '100%',
                                                    height: '100%',
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
                                                bgcolor: '#242526',
                                                color: 'white',
                                                p: 0.3,
                                                border: '1px solid #3a3b3c',
                                                '&:hover': { bgcolor: '#555' }
                                            }}
                                        >
                                            <CloseIcon sx={{ fontSize: 12 }} />
                                        </IconButton>
                                    </Box>
                                ))}
                            </Box>
                        )}

                        {/* File Preview */}
                        {filePreview.length > 0 && (
                            <Box sx={{ mb: 1.5 }}>
                                {filePreview.map((file, index) => (
                                    <Box
                                        key={index}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1.5,
                                            p: 1.5,
                                            bgcolor: '#f0f2f5',
                                            borderRadius: 2,
                                            mb: 0.5,
                                        }}
                                    >
                                        {getFileIcon(file.type)}
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography
                                                fontSize={13}
                                                fontWeight={500}
                                                noWrap
                                                sx={{ color: '#050505' }}
                                            >
                                                {file.name}
                                            </Typography>
                                            <Typography fontSize={12} color="#65676b">
                                                {formatFileSize(file.size)}
                                            </Typography>
                                        </Box>
                                        <IconButton size="small" onClick={() => handleRemoveFile(index)}>
                                            <CloseIcon fontSize="small" />
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
                            <IconButton
                                size="small"
                                sx={{ color: "#0084ff" }}
                                onClick={() => fileDocInputRef.current?.click()}
                                title="Đính kèm file"
                            >
                                <AddCircleIcon fontSize="small" />
                            </IconButton>
                            <input
                                type="file"
                                ref={fileDocInputRef}
                                hidden
                                multiple
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                                onChange={handleDocFileSelect}
                            />
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
                                value={displayMessage}
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
                            {(newMessage.trim() || mediaPreview.length > 0) ? (
                                <IconButton onClick={handleSendMessage} size="small" sx={{ color: themeColor }} disabled={isUploading}>
                                    {isUploading ? <CircularProgress size={18} /> : <SendIcon fontSize="small" />}
                                </IconButton>
                            ) : (
                                <IconButton
                                    onClick={handleSendQuickReaction}
                                    size="small"
                                    sx={{
                                        fontSize: 20,
                                        transition: 'transform 0.15s',
                                        '&:hover': { transform: 'scale(1.2)', bgcolor: 'transparent' }
                                    }}
                                >
                                    {quickReaction}
                                </IconButton>
                            )}
                        </Box>
                    </Box>
                )}
            </Box>


            {/* Emoji Picker Popover */}
            <Popover
                open={Boolean(emojiAnchor)}
                anchorEl={emojiAnchor}
                onClose={() => setEmojiAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
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
