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
    useMediaQuery,
    useTheme,
    alpha,
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
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useChatByConversationId } from "@/queries/useChatQueries";
import { MessageResponse, SendMessagePayload, AttachmentData } from "@/types/chat";
import { useSocket } from "@/contexts/SocketContext";
import { useQueryClient, InfiniteData } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants/query-keys";
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { MessagesResponse, MessageReadStatus } from "@/services/chat.service";
import { useOnlineStatusStore, formatLastActiveDetailed } from "@/stores/useOnlineStatusStore";
import { useMessageCacheStore } from "@/stores/useMessageCacheStore";
import MessageItem from "./MessageItem";
import ConversationInfo from "./ConversationInfo";
import { useConversationDetail } from "@/queries/useConversationQueries";
import { uploadChatMedia } from "@/services/cloudinary.service";
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { ConversationParticipant, ConversationParticipantUser, ConversationResponseData } from "@/types/conversation";
import { toast } from 'sonner';
import { relationshipService } from "@/services/relationship.service";
import { useCall } from "@/contexts/CallContext";
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

interface AreaChatMessagesProps {
    selectedConversation: SelectedConversation;
    userId: string;
    onMobileBack?: () => void;
    isMobile?: boolean;
}

export default function AreaChatMessages({ selectedConversation, userId, onMobileBack }: AreaChatMessagesProps) {
    const { socketChat, socketRelationship } = useSocket();
    const queryClient = useQueryClient();
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showInfo, setShowInfo] = useState(false);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const { callUser, startGroupCall } = useCall();
    const { t } = useTranslation();

    // Get conversation detail for theme
    const { data: conversationDetail } = useConversationDetail(selectedConversation._id);
    const conversation = conversationDetail?.data;

    // ========== STABILIZE UNREAD COUNT (Debounce to prevent jittering) ==========
    // Socket events can fire rapidly, causing avatar to jump around
    // We stabilize by only updating after a short delay
    const [stableUnreadCount, setStableUnreadCount] = useState<Record<string, number>>(
        conversation?.unreadCount || {}
    );
    const unreadDebounceRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!conversation?.unreadCount) return;

        // Clear previous debounce
        if (unreadDebounceRef.current) {
            clearTimeout(unreadDebounceRef.current);
        }

        // Debounce update (500ms)
        unreadDebounceRef.current = setTimeout(() => {
            setStableUnreadCount(conversation.unreadCount || {});
        }, 500);

        return () => {
            if (unreadDebounceRef.current) {
                clearTimeout(unreadDebounceRef.current);
            }
        };
    }, [conversation?.unreadCount]);

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
    const canChat = !isGroupDeleted && !wasKicked && canChatBasedOnSettings && !isLeft && !blockedByMe && !conversation?.chatBlocked;

    // Handle unblock user
    const handleUnblockUser = async () => {
        if (isUnblocking) return;
        setIsUnblocking(true);
        try {
            // Use socket for real-time update
            if (socketRelationship) {
                socketRelationship.emit('user:unblock', { targetUserId: selectedConversation.otherId }, (response: { success: boolean; error?: string }) => {
                    if (response.success) {
                        toast.success(t('chat.user_unblocked'));
                        // Refetch conversation detail to update blockedByMe status
                        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATION_BY_USER, 'detail', selectedConversation._id] });
                        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATIONS] });
                    } else {
                        toast.error(response.error || t('chat.unblock_failed'));
                    }
                    setIsUnblocking(false);
                });
            } else {
                // Fallback to REST API
                await relationshipService.unblockUser(selectedConversation.otherId);
                toast.success(t('chat.user_unblocked'));
                queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATION_DETAIL, selectedConversation._id] });
                queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATIONS] });
                setIsUnblocking(false);
            }
        } catch (error) {
            console.error('Failed to unblock user:', error);
            toast.error(t('chat.unblock_failed'));
            setIsUnblocking(false);
        }
    };

    // Message for restricted chat
    const getChatRestrictionMessage = () => {
        if (conversation?.chatBlocked) return t('chat.blocked_by_user');
        if (isGroupDeleted) return t('chat.group_dissolved');
        if (wasKicked) return t('chat.kicked_from_group');
        if (!canChatBasedOnSettings) return t('chat.only_admin_can_chat');
        if (isLeft) return t('chat.left_group');
        return '';
    };

    // Generate gradient from theme color
    const getGradientBg = (color: string) => {
        const isDark = theme.palette.mode === 'dark';
        const endColor = isDark ? theme.palette.background.default : '#ffffff';
        // Darken the color slightly for gradient end
        return `linear-gradient(180deg, ${color}${isDark ? '20' : '15'} 0%, ${color}${isDark ? '10' : '08'} 50%, ${endColor} 100%)`;
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


    const newMessageRef = useRef("");
    const [displayMessage, setDisplayMessage] = useState("");
    const [replyMsg, setReplyMsg] = useState<MessageResponse | null>(null);
    const [mediaPreview, setMediaPreview] = useState<{ file: File; url: string; type: 'image' | 'video' }[]>([]);
    const [filePreview, setFilePreview] = useState<{ file: File; name: string; size: number; type: string }[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null);
    const fileDocInputRef = useRef<HTMLInputElement>(null);
    const MAX_CHAT_UPLOAD_SIZE_MB = 5;
    const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

    const validateFileSize = (files: File[]): File[] => {
        const validFiles: File[] = [];
        const oversizedNames: string[] = [];

        files.forEach((file) => {
            if (file.size > MAX_UPLOAD_SIZE_BYTES) {
                oversizedNames.push(file.name);
                return;
            }
            validFiles.push(file);
        });

        if (oversizedNames.length > 0) {
            const fileList = oversizedNames.slice(0, 3).join(', ');
            const suffix = oversizedNames.length > 3 ? '...' : '';
            toast.error(t('chat.upload_limit_exceeded', {
                maxSize: MAX_CHAT_UPLOAD_SIZE_MB,
                fileNames: `${fileList}${suffix}`
            }));
        }

        return validFiles;
    };

    // Track current cursor (lastReadMessageId) for optimization
    const currentCursorRef = useRef<string | null>(null);
    const cursorUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    // Track which conversation has been marked as read (to prevent duplicate emits)
    const markedAsReadConvRef = useRef<string | null>(null);

    const [mentionStartIndex, setMentionStartIndex] = useState(-1);


    // Typing indicator states
    const [isOtherTyping, setIsOtherTyping] = useState(false);
    const [usersTyping, setUsersTyping] = useState<ConversationParticipant[]>([]);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastTypingEmitRef = useRef<number>(0);

    // Chatbot typing indicator state
    const [isChatbotTyping, setIsChatbotTyping] = useState(false);
    const chatbotTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // AI streaming state: tracks which messageId is currently streaming and accumulated text
    const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
    const streamingTextRef = useRef<string>('');

    // Check if this is a group conversation
    const isGroup = selectedConversation.type === 'GROUP';
    const isChatbot = selectedConversation.type === 'CHATBOT';

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
            return t('chat.members_count', { count: activeMembers });
        }
        if (otherUserStatus.isOnline || isChatbot) {
            return t('common.active');
        }
        return formatLastActiveDetailed(otherUserStatus.lastActive);
    }, [isGroup, otherUserStatus, conversationDetail, isChatbot, t]);

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

    // ========== PRE-CALCULATE SEEN POSITIONS (Facebook-style) ==========
    // Calculate once, use for all messages - prevents jittering from expensive calculations
    // Uses stableUnreadCount (debounced) to prevent avatar jumping
    const seenAvatarsMap = useMemo(() => {
        if (!conversation?.participants || !allMessages.length || !userId) {
            return new Map<number, { userId: string; user: ConversationParticipantUser; seenIndex: number }[]>();
        }

        const lastMessageIndex = allMessages.length - 1;

        // Get other participants' seen info - USE STABLE UNREAD COUNT
        const otherParticipantsSeenInfo = conversation.participants
            .filter(p => p.user._id.toString() !== userId.toString())
            .map(p => {
                const uid = p.user._id.toString();
                const unread = stableUnreadCount[uid]; // Use stable version
                const unreadCount = typeof unread === 'number' ? unread : 0;
                const seenIndex = unreadCount > lastMessageIndex ? -1 : lastMessageIndex - unreadCount;
                return { userId: uid, seenIndex, user: p.user };
            })
            .filter(s => s.seenIndex >= 0);

        // For each participant, find which message should show their avatar
        // Logic: Avatar shows at the LAST OWN MESSAGE that they have seen
        const resultMap = new Map<number, { userId: string; user: ConversationParticipantUser; seenIndex: number }[]>();

        otherParticipantsSeenInfo.forEach(participant => {
            // Find all own messages
            const ownMessageIndices = allMessages
                .map((m, i) => (m.senderId._id === userId.toString() && m.type !== 'CHATBOT') ? i : -1)
                .filter(i => i !== -1);

            // Find the last own message that this participant has seen
            const lastSeenOwnMsgIndex = ownMessageIndices
                .filter(i => i <= participant.seenIndex)
                .pop();

            if (lastSeenOwnMsgIndex !== undefined) {
                const existing = resultMap.get(lastSeenOwnMsgIndex) || [];
                existing.push({ userId: participant.userId, user: participant.user, seenIndex: participant.seenIndex });
                resultMap.set(lastSeenOwnMsgIndex, existing);
            }
        });

        return resultMap;
    }, [conversation?.participants, stableUnreadCount, allMessages, userId]);

    // Pre-calculate last own message index to avoid O(n) scan in itemContent
    const lastOwnMessageIndex = useMemo(() => {
        if (!userId || !allMessages.length) return -1;
        for (let i = allMessages.length - 1; i >= 0; i--) {
            const msg = allMessages[i];
            if (msg.type !== 'CHATBOT' && msg.senderId?._id === userId.toString()) {
                return i;
            }
        }
        return -1;
    }, [allMessages, userId]);

    // Sync readStatuses from chatData and fetch from socket when opening conversation
    // Sync readStatuses from chatData and fetch from socket when opening conversation
    useEffect(() => {
        // Initialize cursor to latest message when messages load
        if (allMessages.length > 0) {
            const latestMsg = allMessages[allMessages.length - 1];
            const latestMsgId = typeof latestMsg._id === 'string' ? latestMsg._id : String(latestMsg._id);
            currentCursorRef.current = latestMsgId;
        }


    }, [chatData, allMessages, socketChat, selectedConversation._id, userId]);

    // Optimized cursor update function with debounce - ONLY via socket
    const updateCursor = useCallback((messageId: string | undefined) => {
        // Validate messageId
        if (!messageId || typeof messageId !== 'string' || messageId.trim() === '') {
            return;
        }

        // Validate MongoDB ObjectId format (24 hex characters)
        if (!/^[a-fA-F0-9]{24}$/.test(messageId)) {
            return;
        }

        // Verify message exists in current messages list (to avoid race conditions)
        const messageExists = allMessages.some(m => {
            const msgId = typeof m._id === 'string' ? m._id : String(m._id);
            return msgId === messageId && !m.isDeleted;
        });

        if (!messageExists) {
            return;
        }

        // Only update if cursor actually changed
        if (currentCursorRef.current === messageId) return;

        // Clear existing timeout
        if (cursorUpdateTimeoutRef.current) {
            clearTimeout(cursorUpdateTimeoutRef.current);
        }

        // Debounce cursor updates (300ms for faster response)
        cursorUpdateTimeoutRef.current = setTimeout(() => {
            // Double check after debounce (cursor might have changed)
            if (currentCursorRef.current !== messageId && socketChat && messageId) {
                // Update cursor ref immediately to prevent duplicate emits
                currentCursorRef.current = messageId;

                // Update cursor via socket ONLY (no API call for smoother UX)
                socketChat.emit("message:read", {
                    conversationId: selectedConversation._id,
                    messageId
                });

            }
        }, 300);
    }, [socketChat, selectedConversation._id, allMessages]);

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

        // Also update conversation detail cache
        queryClient.setQueryData<{ data: ConversationResponseData }>(
            [QUERY_KEYS.CONVERSATION_BY_USER, "detail", selectedConversation._id],
            (oldData) => {
                if (!oldData?.data) return oldData;
                return {
                    ...oldData,
                    data: {
                        ...oldData.data,
                        unreadCount: {
                            ...oldData.data.unreadCount,
                            [userId]: 0
                        }
                    }
                };
            }
        );

        // EMIT socket event to mark as read on backend and broadcast to other users
        // Only emit once per conversation (prevent duplicate emits causing lag)
        if (markedAsReadConvRef.current !== selectedConversation._id) {
            markedAsReadConvRef.current = selectedConversation._id;
            socketChat.emit("message:read", {
                conversationId: selectedConversation._id
            });
        }

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
            // Clean up cursor update timeout
            if (cursorUpdateTimeoutRef.current) {
                clearTimeout(cursorUpdateTimeoutRef.current);
            }
            // Reset cursor when leaving conversation
            currentCursorRef.current = null;
            // Reset marked as read ref to allow re-emit when opening again
            markedAsReadConvRef.current = null;
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

        const handleNewMessage = (msg: MessageResponse & { _unreadCount?: Record<string, number> }) => {
            // IMPORTANT: Only add message if it belongs to current conversation
            if (msg.conversationId !== selectedConversation._id) {
                return;
            }

            // CRITICAL: Update unread count immediately if provided in message payload
            // This syncs the seen avatars logic with the new message arrival
            if (msg._unreadCount) {
                const newUnreadCount = msg._unreadCount;
                setStableUnreadCount(newUnreadCount);

                // Also update query cache for conversation detail
                queryClient.setQueryData<{ data: ConversationResponseData }>(
                    [QUERY_KEYS.CONVERSATION_BY_USER, "detail", selectedConversation._id],
                    (oldData) => {
                        if (!oldData?.data) return oldData;
                        return {
                            ...oldData,
                            data: {
                                ...oldData.data,
                                unreadCount: newUnreadCount
                            }
                        };
                    }
                );
            }

            // Clear this message from pending cache since we're handling it here
            useMessageCacheStore.getState().clearPending(selectedConversation._id);

            // Determine if this is our own message (for optimistic reconciliation)
            const msgSenderId = typeof msg.senderId === 'object' ? msg.senderId._id : msg.senderId;
            const isOwnMessage = msgSenderId === userId;

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

                    // If this is our own message, find and replace the optimistic placeholder
                    if (isOwnMessage) {
                        // Find the oldest optimistic message matching this content/type
                        // Also check createdAt proximity (within 60s) to avoid mismatching
                        let optimisticFound = false;
                        const msgTime = new Date(msg.createdAt).getTime();
                        const newPages = oldData.pages.map(page => ({
                            ...page,
                            data: page.data.map(m => {
                                if (!optimisticFound && m._isOptimistic && m._tempId?.startsWith('_optimistic_')) {
                                    const timeClose = Math.abs(new Date(m.createdAt).getTime() - msgTime) < 60000;
                                    const contentMatch = m.content === msg.content;
                                    const typeMatch = m.type === msg.type;
                                    // Primary: exact content + type match within time window
                                    // Fallback: content match only within time window (type may differ e.g. TEXT→IMAGE after upload)
                                    if (timeClose && (contentMatch && typeMatch || contentMatch)) {
                                        optimisticFound = true;
                                        // Revoke local blob URLs to prevent memory leaks
                                        if (m._localMediaPreviews) {
                                            m._localMediaPreviews.forEach(url => {
                                                try { URL.revokeObjectURL(url); } catch (_) { }
                                            });
                                        }
                                        // Replace optimistic with real message
                                        return { ...msg };
                                    }
                                }
                                return m;
                            })
                        }));

                        if (optimisticFound) {
                            return { ...oldData, pages: newPages };
                        }
                    }

                    // No optimistic match - append normally
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

            // If message is from other user and we're viewing this conversation, mark as read immediately via socket
            // If message is new (from anyone), we are viewing it right now, so update our cursor to this message.
            // This is critical so that if WE send a message, our "seen" cursor moves to it, 
            // alerting others that we are active up to this point.
            // Only send for real server IDs (not optimistic temp IDs)
            if (socketChat && selectedConversation._id && msg._id && /^[a-fA-F0-9]{24}$/.test(msg._id)) {
                socketChat.emit("message:read", {
                    conversationId: selectedConversation._id,
                    messageId: msg._id // Use the new message as cursor
                });
            }

            // Scroll to bottom when new message
            setTimeout(() => {
                virtuosoRef.current?.scrollToIndex({
                    index: 'LAST',
                    behavior: 'auto',
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

        // Handle unread count updates (from backend increment/reset)
        // Handle unread count updates (from backend increment/reset)
        const handleUnreadUpdate = (data: { conversationId: string; unreadCount: Record<string, number> }) => {
            // Validate data
            if (!data?.conversationId || !data?.unreadCount || typeof data.unreadCount !== 'object') return;

            // 1. Always update global conversation list cache (for sidebar unread badges)
            // This ensures the left sidebar updates immediately when unread counts change
            queryClient.setQueryData<{ data: ConversationResponseData[] }>(
                [QUERY_KEYS.CONVERSATION_BY_USER, userId],
                (oldData) => {
                    if (!oldData?.data) return oldData;
                    return {
                        ...oldData,
                        data: oldData.data.map(conv => {
                            if (conv._id === data.conversationId) {
                                return { ...conv, unreadCount: data.unreadCount };
                            }
                            return conv;
                        })
                    };
                }
            );

            // 2. If this is the active conversation, update local state + detail cache
            // This ensures the main chat area (and seen avatars) updates immediately
            if (data.conversationId === selectedConversation._id) {
                setStableUnreadCount(data.unreadCount);

                queryClient.setQueryData<{ data: ConversationResponseData }>(
                    [QUERY_KEYS.CONVERSATION_BY_USER, "detail", selectedConversation._id],
                    (oldData) => {
                        if (!oldData?.data) return oldData;
                        return {
                            ...oldData,
                            data: {
                                ...oldData.data,
                                unreadCount: data.unreadCount
                            }
                        };
                    }
                );
            }
        };

        socketChat.on("conversation:unread:updated", handleUnreadUpdate);
        socketChat.on("conversation:unread:reset", handleUnreadUpdate);

        // Handle message read updates
        const handleMessageReadUpdate = (data: {
            conversationId: string;
            readBy: { _id: string; firstName: string; lastName: string; avatar?: string } | null;
            readByUserId: string;
            modifiedCount: number;
            lastReadMessageId?: string | { _id: string; createdAt: string };
            readStatus?: MessageReadStatus;
        }) => {
            if (data.conversationId === selectedConversation._id && data.readStatus) {
                // Helper to safely get ID string
                const getId = (id: unknown): string => {
                    if (!id) return '';
                    if (typeof id === 'string') return id;
                    if (typeof id === 'object' && id !== null && '_id' in id) {
                        const objId = (id as { _id: unknown })._id;
                        if (typeof objId === 'string') return objId;
                        if (objId && typeof objId === 'object' && '_id' in objId) {
                            return String((objId as { _id: unknown })._id);
                        }
                        return String(objId);
                    }
                    if (typeof id === 'object' && id !== null && 'toString' in id && typeof id.toString === 'function') {
                        return id.toString();
                    }
                    return '';
                };

                const rawStatus = data.readStatus;

                // Normalize the incoming status to ensure it matches our state shape
                let normalizedLastReadMessageId: { _id: string; createdAt: string } | null = null;

                if (rawStatus.lastReadMessageId) {
                    if (typeof rawStatus.lastReadMessageId === 'object' && rawStatus.lastReadMessageId !== null) {
                        const msgId = getId((rawStatus.lastReadMessageId as { _id: unknown })._id);
                        const createdAt = (rawStatus.lastReadMessageId as { createdAt?: string }).createdAt || '';
                        if (msgId) {
                            normalizedLastReadMessageId = {
                                _id: msgId,
                                createdAt
                            };
                        }
                    } else if (typeof rawStatus.lastReadMessageId === 'string') {
                        // If it's just a string ID, we need to fetch createdAt from message
                        // For now, assume it's valid if string
                        normalizedLastReadMessageId = {
                            _id: rawStatus.lastReadMessageId,
                            createdAt: ''
                        };
                    } else if (rawStatus.lastReadMessageId) {
                        // Fallback for any other truthy value
                        try {
                            const idStr = getId(rawStatus.lastReadMessageId);
                            if (idStr) {
                                normalizedLastReadMessageId = {
                                    _id: idStr,
                                    createdAt: ''
                                }
                            }
                        } catch {
                            console.warn("Invalid lastReadMessageId format", rawStatus.lastReadMessageId);
                        }
                    }
                }

                const normalizedStatus: MessageReadStatus = {
                    ...rawStatus,
                    _id: getId(rawStatus._id),
                    conversationId: getId(rawStatus.conversationId),
                    userId: {
                        ...rawStatus.userId,
                        _id: getId(rawStatus.userId?._id)
                    },
                    lastReadMessageId: normalizedLastReadMessageId || null
                };

                const incomingUserId = getId(normalizedStatus.userId._id);
                const currentUserIdStr = getId(userId);

                // If this is our own cursor update, sync currentCursorRef but DON'T add to readStatuses
                if (incomingUserId.toString().trim() === currentUserIdStr.toString().trim() && normalizedStatus.lastReadMessageId) {
                    const cursorMsgId = normalizedStatus.lastReadMessageId._id;
                    if (cursorMsgId) {
                        currentCursorRef.current = cursorMsgId;
                    }
                    return; // CRITICAL: Don't add current user's read status to readStatuses
                }

                // CRITICAL: Update React Query Cache to persist between tab switches
                // This updates the 'chatData' for the NEXT mount
                queryClient.setQueryData<InfiniteData<MessagesResponse>>(
                    [QUERY_KEYS.CHATS, selectedConversation._id],
                    (oldData: InfiniteData<MessagesResponse> | undefined) => {
                        if (!oldData || !oldData.pages) return oldData;

                        return {
                            ...oldData,
                            pages: oldData.pages.map((page: MessagesResponse, index: number) => {
                                // Only update readStatuses in the first page (usually where metadata lives)
                                if (index === 0) {
                                    const currentStatuses: MessageReadStatus[] = page.readStatuses || [];
                                    const existsIndex = currentStatuses.findIndex((s: MessageReadStatus) =>
                                        getId(s.userId?._id || s.userId) === incomingUserId
                                    );

                                    const newStatuses = [...currentStatuses];
                                    if (existsIndex !== -1) {
                                        newStatuses[existsIndex] = normalizedStatus;
                                    } else {
                                        newStatuses.push(normalizedStatus);
                                    }

                                    return {
                                        ...page,
                                        readStatuses: newStatuses
                                    };
                                }
                                return page;
                            })
                        };
                    }
                );
            }
        };

        socketChat.on("message:read:updated", handleMessageReadUpdate);


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
            socketChat.off("conversation:unread:updated", handleUnreadUpdate);
            socketChat.off("conversation:unread:reset", handleUnreadUpdate);
        };
    }, [socketChat, selectedConversation._id, queryClient, updateMessageInCache, userId, conversation]);

    // Typing indicator listener
    useEffect(() => {
        if (!socketChat) return;

        const handleTypingStart = (data: { conversationId: string; userId: string }) => {
            if (data.conversationId === selectedConversation._id) {
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
            if (data.conversationId === selectedConversation._id) {
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
            if (msg.conversationId === selectedConversation._id) {
                const userTypingsLeft = usersTyping.filter(u => u.user._id !== msg.senderId?._id);
                setUsersTyping([...userTypingsLeft]);
                setIsOtherTyping(false);
                if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                }
            }
        };

        // Handle chatbot typing indicator
        const handleChatbotTyping = (data: { conversationId: string; isTyping: boolean }) => {
            if (data.conversationId === selectedConversation._id) {
                setIsChatbotTyping(data.isTyping);
                if (!data.isTyping && chatbotTypingTimeoutRef.current) {
                    clearTimeout(chatbotTypingTimeoutRef.current);
                }
            }
        };

        socketChat.on("typing:start", handleTypingStart);
        socketChat.on("typing:stop", handleTypingStop);
        socketChat.on("message:new", handleNewMessageTyping);
        socketChat.on("chatbot:typing", handleChatbotTyping);

        return () => {
            socketChat.off("typing:start", handleTypingStart);
            socketChat.off("typing:stop", handleTypingStop);
            socketChat.off("message:new", handleNewMessageTyping);
            socketChat.off("chatbot:typing", handleChatbotTyping);
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, [socketChat, selectedConversation._id, userId, setUsersTyping, usersTyping, conversation]);

    // === AI Streaming Socket Events ===
    useEffect(() => {
        if (!socketChat) return;

        // Stream started — insert a placeholder CHATBOT message in the cache
        const handleStreamStart = (data: { conversationId: string; messageId: string; senderId: string }) => {
            if (data.conversationId !== selectedConversation._id) return;

            setStreamingMessageId(data.messageId);
            streamingTextRef.current = '';
            // Don't clear typing yet — we keep it until first token arrives

            // Insert placeholder message into query cache
            queryClient.setQueryData<InfiniteData<MessagesResponse>>(
                [QUERY_KEYS.CHATS, selectedConversation._id],
                (oldData) => {
                    if (!oldData) {
                        return {
                            pages: [{
                                data: [{
                                    _id: data.messageId,
                                    conversationId: data.conversationId,
                                    senderId: { _id: data.senderId } as any,
                                    type: 'CHATBOT' as any,
                                    content: '',
                                    createdAt: new Date().toISOString(),
                                    status: 'SENT',
                                    isDeleted: false,
                                    isEdited: false,
                                    _isStreaming: true,
                                } as MessageResponse & { _isStreaming?: boolean }],
                                pagination: { page: 1, limit: 15, total: 1, hasMore: false },
                            }],
                            pageParams: [undefined],
                        };
                    }

                    const exists = oldData.pages.some(p => p.data.some(m => m._id === data.messageId));
                    if (exists) return oldData;

                    const newPages = [...oldData.pages];
                    const lastIdx = newPages.length - 1;
                    newPages[lastIdx] = {
                        ...newPages[lastIdx],
                        data: [...newPages[lastIdx].data, {
                            _id: data.messageId,
                            conversationId: data.conversationId,
                            senderId: { _id: data.senderId } as any,
                            type: 'CHATBOT' as any,
                            content: '',
                            createdAt: new Date().toISOString(),
                            status: 'SENT',
                            isDeleted: false,
                            isEdited: false,
                            _isStreaming: true,
                        } as MessageResponse & { _isStreaming?: boolean }],
                    };
                    return { ...oldData, pages: newPages };
                },
            );

            // Scroll to bottom
            setTimeout(() => {
                virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'auto' });
            }, 50);
        };

        // Token arrived — update the streaming message's content
        const handleToken = (data: { conversationId: string; messageId: string; token: string }) => {
            if (data.conversationId !== selectedConversation._id) return;

            // Hide typing dots on first token
            setIsChatbotTyping(false);
            if (chatbotTypingTimeoutRef.current) clearTimeout(chatbotTypingTimeoutRef.current);

            streamingTextRef.current += data.token;
            const currentText = streamingTextRef.current;

            queryClient.setQueryData<InfiniteData<MessagesResponse>>(
                [QUERY_KEYS.CHATS, selectedConversation._id],
                (oldData) => {
                    if (!oldData) return oldData;

                    const newPages = oldData.pages.map(page => ({
                        ...page,
                        data: page.data.map(msg =>
                            msg._id === data.messageId
                                ? { ...msg, content: currentText }
                                : msg
                        ),
                    }));
                    return { ...oldData, pages: newPages };
                },
            );

            // Keep scrolled to bottom while streaming
            requestAnimationFrame(() => {
                virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' });
            });
        };

        // Stream done — replace placeholder with final DB message
        const handleStreamDone = (finalMsg: MessageResponse & { conversationId: string }) => {
            if (finalMsg.conversationId !== selectedConversation._id) return;

            setStreamingMessageId(null);
            streamingTextRef.current = '';
            setIsChatbotTyping(false); // Ensure typing indicator is cleared
            if (chatbotTypingTimeoutRef.current) clearTimeout(chatbotTypingTimeoutRef.current);

            queryClient.setQueryData<InfiniteData<MessagesResponse>>(
                [QUERY_KEYS.CHATS, selectedConversation._id],
                (oldData) => {
                    if (!oldData) return oldData;

                    const newPages = oldData.pages.map(page => ({
                        ...page,
                        data: page.data.map(msg =>
                            msg._id === finalMsg._id
                                ? { ...finalMsg, _isStreaming: false } as any
                                : msg
                        ),
                    }));
                    return { ...oldData, pages: newPages };
                },
            );
        };

        socketChat.on('chat.ai.stream.start', handleStreamStart);
        socketChat.on('chat.ai.token', handleToken);
        socketChat.on('chat.ai.stream.done', handleStreamDone);

        return () => {
            socketChat.off('chat.ai.stream.start', handleStreamStart);
            socketChat.off('chat.ai.token', handleToken);
            socketChat.off('chat.ai.stream.done', handleStreamDone);
        };
    }, [socketChat, selectedConversation._id, queryClient]);

    // Listen for block/unblock events to update chatBlocked status in real-time
    useEffect(() => {
        if (!socketRelationship || !selectedConversation._id) return;

        const handleBlockedBy = (data: { blockedByUserId: string }) => {
            // If blocked by the other user in this DIRECT conversation, refresh to update chatBlocked
            if (selectedConversation.type !== 'GROUP' && data.blockedByUserId === selectedConversation.otherId) {
                queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATION_BY_USER, 'detail', selectedConversation._id] });
                queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATIONS] });
            }
        };

        const handleUnblockedBy = (data: { unblockedByUserId: string }) => {
            // If unblocked by the other user in this DIRECT conversation, refresh
            if (selectedConversation.type !== 'GROUP' && data.unblockedByUserId === selectedConversation.otherId) {
                queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATION_BY_USER, 'detail', selectedConversation._id] });
                queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATIONS] });
            }
        };

        const handleBlocked = (data: { blockedUserId: string; blockedByUserId: string }) => {
            // If current user blocked the other user, refresh
            if (selectedConversation.type !== 'GROUP' && data.blockedUserId === selectedConversation.otherId) {
                queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATION_BY_USER, 'detail', selectedConversation._id] });
                queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATIONS] });
            }
        };

        const handleUnblocked = (data: { unblockedUserId: string }) => {
            // If current user unblocked the other user, refresh
            if (selectedConversation.type !== 'GROUP' && data.unblockedUserId === selectedConversation.otherId) {
                queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATION_BY_USER, 'detail', selectedConversation._id] });
                queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CONVERSATIONS] });
            }
        };

        socketRelationship.on('user:blockedBy', handleBlockedBy);
        socketRelationship.on('user:unblockedBy', handleUnblockedBy);
        socketRelationship.on('user:blocked', handleBlocked);
        socketRelationship.on('user:unblocked', handleUnblocked);

        return () => {
            socketRelationship.off('user:blockedBy', handleBlockedBy);
            socketRelationship.off('user:unblockedBy', handleUnblockedBy);
            socketRelationship.off('user:blocked', handleBlocked);
            socketRelationship.off('user:unblocked', handleUnblocked);
        };
    }, [socketRelationship, selectedConversation._id, selectedConversation.otherId, selectedConversation.type, queryClient]);


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

    const handleReply = useCallback((message: MessageResponse) => {
        setReplyMsg(message);
    }, []);

    const handleCancelReply = () => {
        setReplyMsg(null);
    };

    // Handle file selection
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const validFiles = validateFileSize(Array.from(files));
        if (validFiles.length === 0) {
            e.target.value = '';
            return;
        }

        const newPreviews: { file: File; url: string; type: 'image' | 'video' }[] = [];
        validFiles.forEach(file => {
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

        const validFiles = validateFileSize(Array.from(files));
        if (validFiles.length === 0) {
            e.target.value = '';
            return;
        }

        const newFiles: { file: File; name: string; size: number; type: string }[] = [];
        validFiles.forEach(file => {
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
        if ((!newMessageRef.current.trim() && mediaPreview.length === 0 && filePreview.length === 0) || !socketChat) return;

        // Capture values before clearing UI
        const messageContent = newMessageRef.current || '';
        const currentMediaPreview = [...mediaPreview];
        const currentFilePreview = [...filePreview];
        const currentReplyMsg = replyMsg;
        const hasMedia = currentMediaPreview.length > 0;
        const hasFiles = currentFilePreview.length > 0;

        // Determine message type for optimistic message
        let optimisticType: 'TEXT' | 'IMAGE' | 'FILE' = 'TEXT';
        if (hasMedia && !messageContent.trim()) optimisticType = 'IMAGE';
        if (hasFiles && !messageContent.trim()) optimisticType = 'FILE';

        // Generate temp ID for optimistic message
        const tempId = `_optimistic_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

        // Build local preview attachments for optimistic display
        const localMediaPreviews = currentMediaPreview.map(m => m.url);
        const optimisticAttachments: AttachmentData[] = [
            ...currentMediaPreview.map(m => ({
                url: m.url, // Local blob URL
                fileName: m.file.name,
                fileSize: m.file.size,
                mediaType: (m.type === 'image' ? 'IMAGE' : 'VIDEO') as 'IMAGE' | 'VIDEO' | 'RAW',
            })),
            ...currentFilePreview.map(f => ({
                url: '', // No preview for files
                fileName: f.name,
                fileSize: f.size,
                mediaType: 'RAW' as 'IMAGE' | 'VIDEO' | 'RAW',
            })),
        ];

        // Get current user info from conversation participants
        const currentUser = currentUserParticipant?.user;

        // Create optimistic message
        const optimisticMessage: MessageResponse = {
            _id: tempId,
            conversationId: selectedConversation._id,
            senderId: {
                _id: userId,
                firstName: currentUser?.firstName || '',
                lastName: currentUser?.lastName || '',
                avatar: currentUser?.avatar || '',
            },
            type: optimisticType,
            content: messageContent,
            attachments: optimisticAttachments.length > 0 ? optimisticAttachments : undefined,
            replyTo: currentReplyMsg || undefined,
            createdAt: new Date().toISOString(),
            isRestricted: false,
            status: 'SENT',
            _isOptimistic: true,
            _isUploading: hasMedia || hasFiles,
            _tempId: tempId,
            _localMediaPreviews: localMediaPreviews,
        };

        // IMMEDIATELY add optimistic message to cache
        queryClient.setQueryData<InfiniteData<MessagesResponse>>(
            [QUERY_KEYS.CHATS, selectedConversation._id],
            (oldData) => {
                if (!oldData) {
                    return {
                        pages: [{ data: [optimisticMessage], pagination: { page: 1, limit: 15, total: 1, hasMore: false } }],
                        pageParams: [undefined],
                    };
                }
                const newPages = [...oldData.pages];
                const lastPageIndex = newPages.length - 1;
                newPages[lastPageIndex] = {
                    ...newPages[lastPageIndex],
                    data: [...newPages[lastPageIndex].data, optimisticMessage],
                };
                return { ...oldData, pages: newPages };
            }
        );

        // Clear UI immediately (user sees message appear instantly)
        newMessageRef.current = "";
        setDisplayMessage("");
        setReplyMsg(null);
        setMediaPreview([]);
        setFilePreview([]);
        setShowMentions(false);

        // Scroll to bottom immediately
        setTimeout(() => {
            virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'auto' });
        }, 50);

        // Stop typing indicator
        socketChat.emit("typing:stop", { conversationId: selectedConversation._id });

        // For CHATBOT conversations, immediately show AI typing indicator
        // so user gets instant feedback that AI is processing
        if (isChatbot && messageContent.trim()) {
            if (chatbotTypingTimeoutRef.current) clearTimeout(chatbotTypingTimeoutRef.current);
            setIsChatbotTyping(true);
            // Safety timeout: hide after 30s if AI never responds
            chatbotTypingTimeoutRef.current = setTimeout(() => setIsChatbotTyping(false), 30000);
        }

        // Now handle uploads and actual sending in the background
        try {
            let attachments: AttachmentData[] = [];
            let messageType: 'TEXT' | 'IMAGE' | 'FILE' = 'TEXT';

            // Upload media if any
            if (hasMedia) {
                const files = currentMediaPreview.map(m => m.file);
                const uploadResult = await uploadChatMedia(files);
                if (uploadResult.success) {
                    attachments = uploadResult.results.map(u => ({
                        url: u.url,
                        fileName: u.fileName,
                        fileSize: u.fileSize,
                        mediaType: u.mediaType
                    }));
                    messageType = messageContent.trim() ? 'TEXT' : 'IMAGE';
                } else {
                    // Mark optimistic message as failed
                    queryClient.setQueryData<InfiniteData<MessagesResponse>>(
                        [QUERY_KEYS.CHATS, selectedConversation._id],
                        (oldData) => {
                            if (!oldData) return oldData;
                            return {
                                ...oldData,
                                pages: oldData.pages.map(page => ({
                                    ...page,
                                    data: page.data.map(msg =>
                                        msg._id === tempId ? { ...msg, _isUploading: false, _sendFailed: true } : msg
                                    )
                                }))
                            };
                        }
                    );
                    toast.error(uploadResult.error || t('chat.upload_failed'));
                    return;
                }
            }

            // Upload document files if any
            if (hasFiles) {
                const files = currentFilePreview.map(f => f.file);
                const uploadResult = await uploadChatMedia(files);
                if (uploadResult.success) {
                    const docAttachments = uploadResult.results.map(u => ({
                        url: u.url,
                        fileName: u.fileName,
                        fileSize: u.fileSize,
                        mediaType: u.mediaType
                    }));
                    attachments = [...attachments, ...docAttachments];
                    messageType = messageContent.trim() ? 'TEXT' : 'FILE';
                } else {
                    queryClient.setQueryData<InfiniteData<MessagesResponse>>(
                        [QUERY_KEYS.CHATS, selectedConversation._id],
                        (oldData) => {
                            if (!oldData) return oldData;
                            return {
                                ...oldData,
                                pages: oldData.pages.map(page => ({
                                    ...page,
                                    data: page.data.map(msg =>
                                        msg._id === tempId ? { ...msg, _isUploading: false, _sendFailed: true } : msg
                                    )
                                }))
                            };
                        }
                    );
                    toast.error(uploadResult.error || t('chat.upload_failed'));
                    return;
                }
            }

            // Update optimistic message to remove uploading state (upload done, now sending)
            if (hasMedia || hasFiles) {
                queryClient.setQueryData<InfiniteData<MessagesResponse>>(
                    [QUERY_KEYS.CHATS, selectedConversation._id],
                    (oldData) => {
                        if (!oldData) return oldData;
                        return {
                            ...oldData,
                            pages: oldData.pages.map(page => ({
                                ...page,
                                data: page.data.map(msg => {
                                    if (msg._id === tempId) {
                                        // Replace local blob URLs with real uploaded URLs
                                        return {
                                            ...msg,
                                            _isUploading: false,
                                            _localMediaPreviews: undefined,
                                            attachments: attachments.length > 0 ? attachments : undefined,
                                            type: messageType,
                                        };
                                    }
                                    return msg;
                                })
                            }))
                        };
                    }
                );
            }

            const payload: SendMessagePayload = {
                conversationId: selectedConversation._id,
                senderId: userId,
                type: messageType,
                content: messageContent,
                attachments: attachments.length > 0 ? attachments : undefined,
                replyTo: currentReplyMsg?._id,
            };

            // Send message with callback to handle errors
            socketChat.emit("message", payload, (response: { success: boolean; error?: string; message?: MessageResponse }) => {
                if (response && !response.success) {
                    // Mark as failed
                    queryClient.setQueryData<InfiniteData<MessagesResponse>>(
                        [QUERY_KEYS.CHATS, selectedConversation._id],
                        (oldData) => {
                            if (!oldData) return oldData;
                            return {
                                ...oldData,
                                pages: oldData.pages.map(page => ({
                                    ...page,
                                    data: page.data.map(msg =>
                                        msg._id === tempId ? { ...msg, _sendFailed: true, _isOptimistic: true } : msg
                                    )
                                }))
                            };
                        }
                    );
                    toast.error(response.error || t('chat.cannot_send'));
                }
                // On success, the socket 'message:new' event will bring the real message.
                // We remove the optimistic one when the real one arrives (handled in handleNewMessage).
            });

            // Safety: if optimistic message is still not reconciled after 15s, clear its flag
            // so it doesn't stay stuck as "Sending..." forever
            setTimeout(() => {
                queryClient.setQueryData<InfiniteData<MessagesResponse>>(
                    [QUERY_KEYS.CHATS, selectedConversation._id],
                    (oldData) => {
                        if (!oldData) return oldData;
                        const hasStale = oldData.pages.some(p => p.data.some(m => m._id === tempId && m._isOptimistic));
                        if (!hasStale) return oldData;
                        return {
                            ...oldData,
                            pages: oldData.pages.map(page => ({
                                ...page,
                                data: page.data.map(msg =>
                                    msg._id === tempId && msg._isOptimistic
                                        ? { ...msg, _isOptimistic: false, _isUploading: false }
                                        : msg
                                )
                            }))
                        };
                    }
                );
            }, 15000);
        } catch (err) {
            console.error("Failed to send message:", err);
            // Mark optimistic message as failed
            queryClient.setQueryData<InfiniteData<MessagesResponse>>(
                [QUERY_KEYS.CHATS, selectedConversation._id],
                (oldData) => {
                    if (!oldData) return oldData;
                    return {
                        ...oldData,
                        pages: oldData.pages.map(page => ({
                            ...page,
                            data: page.data.map(msg =>
                                msg._id === tempId ? { ...msg, _isUploading: false, _sendFailed: true } : msg
                            )
                        }))
                    };
                }
            );
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
        newMessageRef.current = raw;
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
        newMessageRef.current = newRaw;

        setShowMentions(false);
        setMentionSearch('');
        setMentionStartIndex(-1);
    };



    const handleEmojiClick = (emoji: { native: string }) => {
        newMessageRef.current += emoji.native;
        setEmojiAnchor(null);
    };

    // Send quick reaction as a message (optimistic)
    const handleSendQuickReaction = () => {
        if (!socketChat) return;

        const tempId = `_optimistic_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const currentUser = currentUserParticipant?.user;

        // Create optimistic message
        const optimisticMessage: MessageResponse = {
            _id: tempId,
            conversationId: selectedConversation._id,
            senderId: {
                _id: userId,
                firstName: currentUser?.firstName || '',
                lastName: currentUser?.lastName || '',
                avatar: currentUser?.avatar || '',
            },
            type: 'TEXT',
            content: quickReaction,
            createdAt: new Date().toISOString(),
            isRestricted: false,
            status: 'SENT',
            _isOptimistic: true,
            _tempId: tempId,
        };

        // Add to cache immediately
        queryClient.setQueryData<InfiniteData<MessagesResponse>>(
            [QUERY_KEYS.CHATS, selectedConversation._id],
            (oldData) => {
                if (!oldData) {
                    return {
                        pages: [{ data: [optimisticMessage], pagination: { page: 1, limit: 15, total: 1, hasMore: false } }],
                        pageParams: [undefined],
                    };
                }
                const newPages = [...oldData.pages];
                const lastPageIndex = newPages.length - 1;
                newPages[lastPageIndex] = {
                    ...newPages[lastPageIndex],
                    data: [...newPages[lastPageIndex].data, optimisticMessage],
                };
                return { ...oldData, pages: newPages };
            }
        );

        // Scroll to bottom
        setTimeout(() => {
            virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'auto' });
        }, 50);

        // For CHATBOT conversations, show AI typing immediately
        if (isChatbot) {
            if (chatbotTypingTimeoutRef.current) clearTimeout(chatbotTypingTimeoutRef.current);
            setIsChatbotTyping(true);
            chatbotTypingTimeoutRef.current = setTimeout(() => setIsChatbotTyping(false), 30000);
        }

        const payload: SendMessagePayload = {
            conversationId: selectedConversation._id,
            senderId: userId,
            type: 'TEXT',
            content: quickReaction,
        };

        socketChat.emit("message", payload, (response: { success: boolean; error?: string }) => {
            if (response && !response.success) {
                // Mark as failed
                queryClient.setQueryData<InfiniteData<MessagesResponse>>(
                    [QUERY_KEYS.CHATS, selectedConversation._id],
                    (oldData) => {
                        if (!oldData) return oldData;
                        return {
                            ...oldData,
                            pages: oldData.pages.map(page => ({
                                ...page,
                                data: page.data.map(msg =>
                                    msg._id === tempId ? { ...msg, _sendFailed: true } : msg
                                )
                            }))
                        };
                    }
                );
                toast.error(response.error || t('chat.cannot_send'));
            }
        });
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
                        {t('chat.all_messages_shown')}
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
                bgcolor: "background.paper",
                height: { xs: "100dvh", md: "100vh" },
                overflow: "hidden",
                width: "100%",
            }}
        >
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                {/* Chat Header */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        p: { xs: 1.5, md: 2 },
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        bgcolor: 'background.paper',
                        position: 'sticky',
                        top: 0,
                        zIndex: 10,
                        flexShrink: 0,
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1, md: 2 } }}>
                        {/* Back Button for Mobile */}
                        {isMobile && onMobileBack && (
                            <IconButton
                                onClick={onMobileBack}
                                size="small"
                                sx={{
                                    color: 'primary.main',
                                    p: 0.5,
                                }}
                            >
                                <ArrowBackIcon />
                            </IconButton>
                        )}
                        <Badge
                            overlap="circular"
                            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                            variant="dot"
                            sx={{
                                "& .MuiBadge-badge": {
                                    backgroundColor: otherUserStatus.isOnline || isChatbot ? theme.palette.success.main : "none",
                                    border: `2px solid ${theme.palette.background.paper}`,
                                    display: otherUserStatus.isOnline || isChatbot ? "block" : "none",
                                    width: { xs: 12, md: 15 },
                                    borderRadius: '50%',
                                    height: { xs: 12, md: 15 },
                                },
                            }}
                        >
                            <Avatar src={selectedConversation.avatar} sx={{ width: { xs: 36, md: 40 }, height: { xs: 36, md: 40 } }} />
                        </Badge>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography fontWeight={600} fontSize={{ xs: 14, md: 15 }} color="text.primary" noWrap>
                                {selectedConversation.fullName}
                            </Typography>
                            <Typography
                                variant="body2"
                                fontSize={{ xs: 11, md: 12 }}
                                color={otherUserStatus.isOnline || isChatbot ? 'success.main' : 'text.secondary'}
                                noWrap
                            >
                                {statusText}
                            </Typography>
                        </Box>
                    </Box>
                    <Box sx={{ display: "flex", gap: { xs: 0.5, md: 1 } }}>
                        {!isChatbot && (
                            <>
                                <IconButton
                                    size="small"
                                    sx={{
                                        color: 'primary.main',
                                        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : '#f0f2f5',
                                        "&:hover": { bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : '#e4e6eb' },
                                    }}
                                    onClick={() => {
                                        if (!isGroup) {
                                            callUser(
                                                selectedConversation.otherId,
                                                selectedConversation._id,
                                                true,
                                                selectedConversation.fullName,
                                                selectedConversation.avatar
                                            );
                                        } else {
                                            startGroupCall(selectedConversation._id, true);
                                        }
                                    }}
                                >
                                    <CallIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                    size="small"
                                    onClick={() => {
                                        if (!isGroup) {
                                            callUser(
                                                selectedConversation.otherId,
                                                selectedConversation._id,
                                                false,
                                                selectedConversation.fullName,
                                                selectedConversation.avatar
                                            );
                                        } else {
                                            startGroupCall(selectedConversation._id, false);
                                        }
                                    }}
                                    sx={{
                                        color: 'primary.main',
                                        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : '#f0f2f5',
                                        "&:hover": { bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : '#e4e6eb' },
                                    }}
                                >
                                    <VideocamIcon fontSize="small" />
                                </IconButton>
                            </>
                        )}
                        <IconButton
                            onClick={() => setShowInfo(!showInfo)}
                            size="small"
                            sx={{
                                color: showInfo ? "white" : 'primary.main',
                                bgcolor: showInfo ? 'primary.main' : (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : '#f0f2f5'),
                                "&:hover": { bgcolor: showInfo ? 'primary.dark' : (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : '#e4e6eb') },
                            }}
                        >
                            <InfoIcon fontSize="small" />
                        </IconButton>
                    </Box>
                </Box>

                {/* Messages Area with Virtuoso */}
                <Box sx={{ flex: 1, overflow: "hidden", background: getGradientBg(themeColor) }}>
                    {isLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', bgcolor: "background.paper", }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <Virtuoso
                            key={selectedConversation._id}
                            ref={virtuosoRef}
                            style={{ height: '100%' }}
                            data={allMessages}
                            firstItemIndex={firstItemIndex}
                            initialTopMostItemIndex={Math.max(allMessages.length - 1, 0)}
                            followOutput="auto"
                            startReached={handleStartReached}
                            rangeChanged={(range) => {
                                // Update cursor based on visible range
                                // Use the message with highest index in visible range as cursor
                                if (range.startIndex !== undefined && range.endIndex !== undefined && allMessages.length > 0) {
                                    // Find the message with highest index in visible range
                                    let highestIndex = -1;
                                    for (let i = range.startIndex; i <= range.endIndex; i++) {
                                        const actualIndex = i - firstItemIndex;
                                        if (actualIndex >= 0 && actualIndex < allMessages.length) {
                                            highestIndex = Math.max(highestIndex, actualIndex);
                                        }
                                    }

                                    if (highestIndex >= 0 && highestIndex < allMessages.length) {
                                        const visibleMessage = allMessages[highestIndex];
                                        // Only update cursor if message is valid and not deleted
                                        if (visibleMessage && visibleMessage._id && !visibleMessage.isDeleted) {
                                            let messageId: string | undefined;
                                            if (typeof visibleMessage._id === 'string') {
                                                messageId = visibleMessage._id;
                                            } else if (visibleMessage._id && typeof visibleMessage._id === 'object' && '_id' in visibleMessage._id) {
                                                messageId = String((visibleMessage._id as { _id: unknown })._id);
                                            } else if (visibleMessage._id) {
                                                messageId = String(visibleMessage._id);
                                            }

                                            // Validate messageId format (MongoDB ObjectId is 24 hex chars)
                                            if (messageId && /^[a-fA-F0-9]{24}$/.test(messageId)) {
                                                updateCursor(messageId);
                                            }
                                        }
                                    }
                                }
                            }}
                            components={{
                                Header,
                            }}
                            itemContent={(index, message) => {
                                /* =========================
                                    1. TÍNH actualIndex
                                ========================== */

                                const actualIndex = index - firstItemIndex;

                                /* =========================
                                   2. BASIC FLAGS
                                ========================== */
                                const isChatbotMessage = message.type === 'CHATBOT';

                                const senderId = message.senderId._id;

                                const isOwn =
                                    !isChatbotMessage &&
                                    senderId === userId?.toString();


                                // ========== SEEN AVATARS (Pre-calculated for performance) ==========
                                // Simply lookup from pre-calculated map - O(1) instead of O(n)
                                const finalSeenUsers = seenAvatarsMap.get(actualIndex) || [];



                                // Xác định lastMessage mà mình gửi (O(1) lookup)
                                const isLastOwnMessage = isOwn && actualIndex === lastOwnMessageIndex;


                                return (
                                    conversationDetail?.data &&
                                    <MessageItem
                                        key={message._id}
                                        message={message}
                                        isOwn={isOwn}
                                        avatar={message.senderId?.avatar || ''}
                                        conversation={conversationDetail?.data}
                                        socket={socketChat}
                                        userId={userId}
                                        onReply={handleReply}
                                        themeColor={themeColor}
                                        otherAvatarsNotRead={finalSeenUsers || []}
                                        isLastOwnMessage={isLastOwnMessage}
                                        isStreaming={streamingMessageId === message._id}
                                    />
                                );
                            }}
                        />
                    )}
                </Box>

                {/* Typing Indicator */}
                {isOtherTyping && usersTyping.length > 0 && usersTyping.filter(u => u.user._id !== userId).map((userTyping) => (
                    <Box
                        key={userTyping.user._id}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            px: 2,
                            py: 1,
                            bgcolor: 'background.paper',
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
                                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : '#e4e6eb',
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
                                            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.5)' : '#65676b',
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
                        <Typography fontSize={14} color="text.secondary">
                            {userTyping.nickname || `${userTyping.user.firstName} ${userTyping.user.lastName}`} {t('chat.typing_indicator')}
                        </Typography>
                    </Box>
                ))}

                {/* Chatbot Typing Indicator */}
                {isChatbotTyping && (
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            px: 2,
                            py: 1,
                            bgcolor: 'background.paper',
                            animation: 'fadeIn 0.3s ease-in-out',
                            '@keyframes fadeIn': {
                                '0%': { opacity: 0 },
                                '100%': { opacity: 1 },
                            },
                        }}
                    >
                        <Avatar
                            sx={{
                                width: 32,
                                height: 32,
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                boxShadow: '0 2px 8px rgba(102, 126, 234, 0.4)',
                            }}
                        >
                            <Box component="span" sx={{ fontSize: 18 }}>🤖</Box>
                        </Avatar>
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                background: 'linear-gradient(135deg, #f6f8fc 0%, #f0f4ff 100%)',
                                border: '1px solid rgba(102, 126, 234, 0.15)',
                                borderRadius: '18px',
                                px: 1.5,
                                py: 1,
                            }}
                        >
                            <Box sx={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                {[0, 1, 2].map((i) => (
                                    <Box
                                        key={i}
                                        sx={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: '50%',
                                            background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                            animation: 'chatbotTypingBounce 1.4s infinite ease-in-out',
                                            animationDelay: `${i * 0.2}s`,
                                            '@keyframes chatbotTypingBounce': {
                                                '0%, 80%, 100%': {
                                                    transform: 'scale(0.6)',
                                                    opacity: 0.4,
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
                        <Typography
                            fontSize={14}
                            sx={{
                                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                fontWeight: 500,
                            }}
                        >
                            {t('chat.ai_thinking')}
                        </Typography>
                    </Box>
                )}

                {/* Group Deleted or Kicked or Restricted Notice */}
                {!canChat && !blockedByMe && (
                    <Box
                        sx={{
                            p: 3,
                            bgcolor: isGroupDeleted || wasKicked ? '#fff3cd' : '#d3d0d0ff',
                            borderTop: isGroupDeleted || wasKicked ? '1px solid #ffc107' : '1px solid #d3d0d0ff',
                            textAlign: 'center'
                        }}
                    >
                        <Typography color={isGroupDeleted || wasKicked ? '#856404' : '#152435ff'} fontWeight={500}>
                            {isGroupDeleted}{getChatRestrictionMessage()}
                        </Typography>
                    </Box>
                )}

                {/* Blocked User Notice */}
                {blockedByMe && (
                    <Box
                        sx={{
                            p: 2,
                            bgcolor: (theme) => alpha(theme.palette.error.main, 0.05),
                            borderTop: (theme) => `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
                            display: 'block',
                            textAlign: 'center',
                            justifyContent: 'center',
                            gap: 5
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: "center", gap: 1, marginBottom: 1 }}>
                            <BlockIcon sx={{ color: 'error.main', fontSize: 20 }} />
                            <Typography color="error.main" fontWeight={500} fontSize={14}>
                                {t('chat.you_blocked_this_user')}
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
                            {isUnblocking ? t('chat.processing') : t('chat.unblock_button')}
                        </Box>
                    </Box>
                )}

                {/* Input Area - Only show if can chat */}
                {canChat && (
                    <Box
                        sx={{
                            p: { xs: 1.5, md: 2 },
                            bgcolor: "background.paper",
                            borderTop: `1px solid ${theme.palette.divider}`,
                            position: 'sticky',
                            bottom: 0,
                            zIndex: 10,
                            flexShrink: 0,
                            pb: { xs: `calc(12px + env(safe-area-inset-bottom, 0px))`, md: 2 },
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
                                    bgcolor: 'background.paper',
                                    boxShadow: 3,
                                    borderRadius: 2,
                                    mb: 1,
                                    maxHeight: 200,
                                    overflowY: 'auto',
                                    zIndex: 10
                                }}
                            >
                                <List dense>
                                    <MenuItem onClick={() => handleSelectMention({
                                        user: {
                                            firstName: 'Chat',
                                            lastName: 'bot',
                                            _id: 'chatbot_id',
                                            username: 'chatbot',
                                        },
                                        isAdmin: false,
                                        nickname: 'Chatbot',
                                        joinedAt: new Date(),
                                    })}>
                                        <ListItemAvatar>
                                            <Avatar
                                                src={"https://png.pngtree.com/png-vector/20230225/ourmid/pngtree-smart-chatbot-cartoon-clipart-png-image_6620453.png"}
                                                sx={{ width: 35, height: 35 }}
                                            />
                                        </ListItemAvatar>
                                        <ListItemText sx={{ marginLeft: 1 }} primary={"Chatbot"} />
                                    </MenuItem>
                                    {filteredParticipants.map((p: ConversationParticipant) => (
                                        <MenuItem key={p.user._id} onClick={() => handleSelectMention(p)}>
                                            <ListItemAvatar>
                                                <Avatar src={p.user.avatar} sx={{ width: 35, height: 35 }} />
                                            </ListItemAvatar>
                                            <ListItemText sx={{ marginLeft: 1 }} primary={p.nickname || `${p.user.firstName} ${p.user.lastName}`} />
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
                                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : '#f0f2f5',
                                    p: 1,
                                    px: 2,
                                    borderRadius: 2,
                                    mb: 1,
                                }}
                            >
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography fontSize={12} color="text.secondary">
                                        {t('chat.replying_to')} <strong>{replyMsg?.type === 'CHATBOT' ? "AI Assistant" : (replyMsg.senderId._id === userId ? t('chat.yourself') : replyMsg.senderId.firstName + " " + replyMsg.senderId.lastName)}</strong>
                                    </Typography>
                                    <Typography fontSize={13} color="text.primary" noWrap sx={{ opacity: 0.8 }}>
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
                                    bgcolor: 'background.paper',
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
                                        border: `2px dashed ${theme.palette.divider}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        flexShrink: 0,
                                        '&:hover': { borderColor: 'text.secondary' }
                                    }}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <AddCircleIcon sx={{ color: 'text.disabled', fontSize: 28 }} />
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
                                            bgcolor: 'background.default',
                                            border: `1px solid ${theme.palette.divider}`,
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
                                                bgcolor: 'background.paper',
                                                color: 'text.primary',
                                                p: 0.3,
                                                border: `1px solid ${theme.palette.divider}`,
                                                '&:hover': { bgcolor: 'action.hover' }
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
                                            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : '#f0f2f5',
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
                                                sx={{ color: 'text.primary' }}
                                            >
                                                {file.name}
                                            </Typography>
                                            <Typography fontSize={12} color="text.secondary">
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
                                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : '#f0f2f5',
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
                                        color: "text.primary",
                                        fontSize: { xs: '14px', md: '15px' },
                                        "& .MuiInputBase-input": {
                                            py: 0.5,
                                        },
                                        "&::placeholder": {
                                            color: "text.secondary",
                                            opacity: 1,
                                        },
                                    },
                                }}
                            />
                            <IconButton size="small" sx={{ color: "#0084ff" }} onClick={(e) => setEmojiAnchor(e.currentTarget)}>
                                <EmojiEmotionsIcon fontSize="small" />
                            </IconButton>
                            {(displayMessage.trim() || mediaPreview.length > 0 || filePreview.length > 0) ? (
                                <IconButton onClick={handleSendMessage} size="small" sx={{ color: themeColor }}>
                                    <SendIcon fontSize="small" />
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
                    theme={theme.palette.mode}
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
