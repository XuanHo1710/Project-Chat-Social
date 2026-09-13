"use client";

import { useAuthStore } from "@/stores/useAuthStore";
import { useMessageCacheStore } from "@/stores/useMessageCacheStore";
import { useOnlineStatusStore } from "@/stores/useOnlineStatusStore";
import { QUERY_KEYS } from "@/constants/query-keys";
import { MessagesResponse } from "@/services/chat.service";
import { MessageResponse } from "@/types/chat";
import {
  InfiniteData,
  QueryClient,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";

interface SocketContextType {
  socket: Socket | null;
  socketChat: Socket | null;
  isConnected: boolean;
  socketRelationship: Socket | null;
  socketReaction: Socket | null;
  socketNotification: Socket | null;
}

type SocketState = SocketContextType;

const EMPTY_SOCKET_STATE: SocketState = {
  socket: null,
  socketChat: null,
  isConnected: false,
  socketRelationship: null,
  socketReaction: null,
  socketNotification: null,
};

const SocketContext = createContext<SocketContextType>(EMPTY_SOCKET_STATE);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<SocketState>(EMPTY_SOCKET_STATE);
  const userId = useAuthStore((store) => store.user?.id);
  const accessToken = useAuthStore((store) => store.accessToken);
  const hasAccessToken = Boolean(accessToken);
  const queryClient = useQueryClient();

  // Latest token without re-rendering socket instances. Sockets are created
  // once per user; auth is patched in place so token refreshes never tear
  // down live connections (e.g. mid-call signaling).
  const accessTokenRef = useRef<string | null>(null);
  const activeSocketsRef = useRef<Socket[]>([]);

  useEffect(() => {
    accessTokenRef.current = accessToken ?? null;
    for (const socket of activeSocketsRef.current) {
      socket.auth = { token: accessTokenRef.current };
      // Manual reconnect with the fresh token when the socket is idle or
      // exhausted its automatic attempts. Listeners stay attached.
      if (accessToken && !socket.connected && !socket.active) {
        socket.connect();
      }
    }
  }, [accessToken]);

  useEffect(() => {
    const socketBaseUrl = process.env.NEXT_PUBLIC_SOCKET_URL?.replace(/\/$/, "");
    if (!userId || !hasAccessToken || !socketBaseUrl || !accessTokenRef.current) {
      return;
    }

    const connectionOptions = {
      auth: { token: accessTokenRef.current },
      transports: ["websocket"] as ["websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      timeout: 10_000,
    };
    const chat = io(`${socketBaseUrl}/chat`, { ...connectionOptions });
    const relationship = io(`${socketBaseUrl}/relationship`, { ...connectionOptions });
    const reaction = io(`${socketBaseUrl}/reaction`, { ...connectionOptions });
    const notification = io(`${socketBaseUrl}/notifications`, { ...connectionOptions });
    activeSocketsRef.current = [chat, relationship, reaction, notification];

    const onChatConnect = () => {
      setState((current) =>
        current.socket === chat ? { ...current, isConnected: true } : current,
      );
    };
    const onChatDisconnect = () => {
      setState((current) =>
        current.socket === chat ? { ...current, isConnected: false } : current,
      );
    };
    const onConnectError = () => onChatDisconnect();

    chat.on("connect", onChatConnect);
    chat.on("disconnect", onChatDisconnect);
    chat.on("connect_error", onConnectError);
    const cleanupGlobalListeners = setupGlobalChatListeners(chat, userId, queryClient);

    const handleUserRestricted = () => {
      toast.info("Bạn đã bị hạn chế tương tác với một người dùng");
    };
    relationship.on("user:restricted", handleUserRestricted);

    const publishSocketsTimer = window.setTimeout(() => {
      setState({
        socket: chat,
        socketChat: chat,
        isConnected: chat.connected,
        socketRelationship: relationship,
        socketReaction: reaction,
        socketNotification: notification,
      });
    }, 0);

    return () => {
      cleanupGlobalListeners();
      relationship.off("user:restricted", handleUserRestricted);
      window.clearTimeout(publishSocketsTimer);
      activeSocketsRef.current = [];
      chat.off("connect", onChatConnect);
      chat.off("disconnect", onChatDisconnect);
      chat.off("connect_error", onConnectError);
      chat.disconnect();
      relationship.disconnect();
      reaction.disconnect();
      notification.disconnect();
      setState((current) =>
        current.socket === chat ? EMPTY_SOCKET_STATE : current,
      );
    };
  }, [userId, hasAccessToken, queryClient]);

  const value = useMemo<SocketContextType>(() => state, [state]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

const isMessageEvent = (value: unknown): value is MessageResponse => {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<MessageResponse>;
  return (
    typeof message._id === "string" &&
    typeof message.conversationId === "string"
  );
};

function setupGlobalChatListeners(
  socket: Socket,
  currentUserId: string,
  queryClient: QueryClient,
): () => void {
  const onlineStore = useOnlineStatusStore.getState();
  const messageStore = useMessageCacheStore.getState();
  let disposed = false;
  let unreadMessageCount = 0;
  const originalTitle = document.title;
  const BLINK_TITLE = "Tin nhắn mới!";
  let lastSetTitle: string | null = null;
  const reportedMessageErrors = new Set<string>();
  const favicon = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  const originalFaviconHref = favicon?.href || "/icon";
  let titleBlinkInterval: ReturnType<typeof setInterval> | null = null;

  const clearBlink = () => {
    if (titleBlinkInterval) {
      clearInterval(titleBlinkInterval);
      titleBlinkInterval = null;
    }
  };

  const restoreFavicon = () => {
    const current = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (current) current.href = originalFaviconHref;
    clearBlink();
  };

  const setNotificationFavicon = (count: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext("2d");
    if (!context) return;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (disposed) return;
      try {
        context.drawImage(image, 0, 0, 32, 32);
        context.beginPath();
        context.arc(24, 8, 9, 0, 2 * Math.PI);
        context.fillStyle = "#f00";
        context.fill();
        context.strokeStyle = "#fff";
        context.lineWidth = 2;
        context.stroke();
        context.fillStyle = "#fff";
        context.font = "bold 12px Arial";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(count > 9 ? "9+" : String(count), 24, 8);
        let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
        if (!link) {
          link = document.createElement("link");
          link.rel = "icon";
          document.head.appendChild(link);
        }
        link.href = canvas.toDataURL("image/png");
      } catch {
        // Cross-origin favicons can taint the canvas; title notification still works.
      }
    };
    image.src = originalFaviconHref;
  };

  const handleWindowFocus = () => {
    unreadMessageCount = 0;
    if (
      lastSetTitle !== null &&
      (document.title === lastSetTitle || document.title === BLINK_TITLE)
    ) {
      document.title = originalTitle;
    }
    restoreFavicon();
  };

  const handleUserOnline = (data: {
    userId?: unknown;
    status?: unknown;
  }) => {
    if (typeof data?.userId !== "string" || typeof data.status !== "string") return;
    onlineStore.updateFromSocket({ userId: data.userId, status: data.status });
  };

  const handleUserOffline = (data: {
    userId?: unknown;
    status?: unknown;
    lastActive?: Date | string;
  }) => {
    if (typeof data?.userId !== "string" || typeof data.status !== "string") return;
    onlineStore.updateFromSocket({
      userId: data.userId,
      status: data.status,
      lastActive: data.lastActive,
    });
  };

  const handleNewMessage = (message: unknown) => {
    if (!isMessageEvent(message)) return;
    messageStore.addPendingMessage(message.conversationId, message);
    const senderId =
      typeof message.senderId === "object" ? message.senderId?._id : message.senderId;
    if (!senderId || senderId === currentUserId || document.hasFocus()) return;

    const senderName =
      typeof message.senderId === "object"
        ? `${message.senderId?.firstName || ""} ${message.senderId?.lastName || ""}`.trim() ||
          "Ai đó"
        : "Ai đó";
    unreadMessageCount += 1;
    const notificationTitle = `${senderName} đã gửi ${unreadMessageCount} tin nhắn đến bạn`;
    document.title = notificationTitle;
    lastSetTitle = notificationTitle;
    setNotificationFavicon(unreadMessageCount);
    clearBlink();
    let showNotification = true;
    titleBlinkInterval = setInterval(() => {
      if (document.hasFocus()) {
        handleWindowFocus();
        return;
      }
      document.title = showNotification ? notificationTitle : "Tin nhắn mới!";
      showNotification = !showNotification;
    }, 1500);
  };

  const handleMessageUpdate = (message: unknown) => {
    if (!isMessageEvent(message)) return;
    messageStore.updatePendingMessage(message.conversationId, message);
  };

  const handleReadUpdate = (data: {
    conversationId?: unknown;
    readBy?: {
      _id: string;
      firstName: string;
      lastName: string;
      avatar?: string;
    } | null;
  }) => {
    if (typeof data?.conversationId !== "string" || !data.readBy?._id) return;
    messageStore.markPendingMessagesAsRead(
      data.conversationId,
      data.readBy,
      currentUserId,
    );
  };

  const handleOnlineUsers = (data: { onlineUsers?: unknown }) => {
    if (!Array.isArray(data?.onlineUsers)) return;
    onlineStore.setOnlineUsers(
      data.onlineUsers.filter((id): id is string => typeof id === "string").slice(0, 10_000),
    );
  };

  const handleMessageError = (data: {
    messageId?: unknown;
    conversationId?: unknown;
    error?: unknown;
  }) => {
    if (typeof data?.messageId !== "string" || typeof data?.conversationId !== "string") return;
    if (reportedMessageErrors.has(data.messageId)) return;
    reportedMessageErrors.add(data.messageId);

    queryClient.setQueryData<InfiniteData<MessagesResponse>>(
      [QUERY_KEYS.CHATS, data.conversationId],
      (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            data: page.data.map((msg) =>
              msg._id === data.messageId || msg._tempId === data.messageId
                ? { ...msg, _sendFailed: true }
                : msg
            ),
          })),
        };
      },
    );

    toast.error(
      typeof data.error === "string" ? data.error : "Không thể xử lý tin nhắn",
    );
  };

  window.addEventListener("focus", handleWindowFocus);
  socket.on("user:online", handleUserOnline);
  socket.on("user:offline", handleUserOffline);
  socket.on("message:new", handleNewMessage);
  socket.on("message:edited", handleMessageUpdate);
  socket.on("message:reaction:updated", handleMessageUpdate);
  socket.on("message:deleted", handleMessageUpdate);
  socket.on("message:error", handleMessageError);
  socket.on("message:read:updated", handleReadUpdate);
  socket.emit("users:online", {}, handleOnlineUsers);

  return () => {
    disposed = true;
    window.removeEventListener("focus", handleWindowFocus);
    socket.off("user:online", handleUserOnline);
    socket.off("user:offline", handleUserOffline);
    socket.off("message:new", handleNewMessage);
    socket.off("message:edited", handleMessageUpdate);
    socket.off("message:reaction:updated", handleMessageUpdate);
    socket.off("message:deleted", handleMessageUpdate);
    socket.off("message:error", handleMessageError);
    socket.off("message:read:updated", handleReadUpdate);
    clearBlink();
    restoreFavicon();
    if (document.title.includes("tin nhắn") || document.title === "Tin nhắn mới!") {
      document.title = originalTitle;
    }
  };
}
