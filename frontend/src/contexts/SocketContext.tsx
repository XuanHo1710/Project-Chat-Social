// lib/socket-context.tsx  (hoặc app/socket-context.tsx nếu dùng app router)
'use client';

import { useAuthStore } from '@/stores/useAuthStore';
import { useOnlineStatusStore } from '@/stores/useOnlineStatusStore';
import { useMessageCacheStore } from '@/stores/useMessageCacheStore';
import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  socketChat: Socket | null; // Alias for socket (for clarity)
  isConnected: boolean;
  socketRelationship: Socket | null;
  socketReaction: Socket | null;
  socketNotification: Socket | null;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  socketChat: null,
  isConnected: false,
  socketRelationship: null,
  socketReaction: null,
  socketNotification: null,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketRelationship, setSocketRelationship] = useState<Socket | null>(null);
  const [socketReaction, setSocketReaction] = useState<Socket | null>(null);
  const [socketNotification, setSocketNotification] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuthStore();

  // Track if online status listener is already setup
  const onlineListenerSetup = useRef(false);
  const onlineCleanup = useRef<(() => void) | null>(null);

  useEffect(() => {
    const userId = user?.id;

    if (!userId) {
      return;
    }

    // Chat socket
    const socketIo = io(process.env.NEXT_PUBLIC_SOCKET_URL + "/chat", {
      query: { userId },
      transports: ["websocket"],
      reconnection: true,
    });

    // Relationship socket
    const socketRelationshipIo = io(process.env.NEXT_PUBLIC_SOCKET_URL + "/relationship", {
      query: { userId },
      transports: ["websocket"],
      reconnection: true,
    });

    // Reaction socket
    const socketReactionIo = io(process.env.NEXT_PUBLIC_SOCKET_URL + "/reaction", {
      query: { userId },
      transports: ["websocket"],
      reconnection: true,
    });

    // Notification socket
    const socketNotificationIo = io(process.env.NEXT_PUBLIC_SOCKET_URL + "/notifications", {
      query: { userId },
      transports: ["websocket"],
      reconnection: true,
    });

    // Event handlers
    socketIo.on("connect", () => {
      setIsConnected(true);

      // Setup global listeners ONCE when connected
      if (!onlineListenerSetup.current) {
        onlineListenerSetup.current = true;
        onlineCleanup.current = setupOnlineStatusListeners(socketIo, userId);
      }
    });

    socketIo.on("disconnect", () => {
      console.log("💬 Chat socket disconnected");
      setIsConnected(false);
    });

    socketRelationshipIo.on("connect", () => {
      console.log("👥 Relationship socket connected:", socketRelationshipIo.id);
    });

    socketRelationshipIo.on("disconnect", () => {
      console.log("👥 Relationship socket disconnected");
    });

    socketReactionIo.on("connect", () => {
      console.log("❤️ Reaction socket connected:", socketReactionIo.id);
    });

    socketReactionIo.on("disconnect", () => {
      console.log("❤️ Reaction socket disconnected");
    });

    socketNotificationIo.on("connect", () => {
      console.log("🔔 Notification socket connected:", socketNotificationIo.id);
    })

    socketNotificationIo.on("disconnect", () => {
      console.log("🔔 Notification socket disconnected");
    });

    setSocket(socketIo);
    setSocketRelationship(socketRelationshipIo);
    setSocketReaction(socketReactionIo);
    setSocketNotification(socketNotificationIo);

    return () => {
      onlineListenerSetup.current = false;
      onlineCleanup.current?.();
      onlineCleanup.current = null;
      socketIo.disconnect();
      socketRelationshipIo.disconnect();
      socketReactionIo.disconnect();
      socketNotificationIo.disconnect();
    };
  }, [user?.id]);


  return (
    <SocketContext.Provider value={{ socket, socketChat: socket, isConnected, socketRelationship, socketReaction, socketNotification }}>
      {children}
    </SocketContext.Provider>
  );
};

// Centralized online status listeners - runs ONCE
function setupOnlineStatusListeners(socket: Socket, userId: string): () => void {
  const onlineStore = useOnlineStatusStore.getState();
  const messageStore = useMessageCacheStore.getState();

  console.log("🟢 Setting up global socket listeners (once)");

  // ─── Global tab title notification for unread messages ───
  let unreadMsgCount = 0;
  const originalTitle = 'Social Chat - Mạng xã hội kết nối bạn bè';
  let originalFaviconHref: string | null = null;
  let titleBlinkInterval: ReturnType<typeof setInterval> | null = null;

  // Save original favicon
  if (typeof document !== 'undefined') {
    const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    originalFaviconHref = link?.href || '/icon';
  }

  // Create a favicon with red notification badge
  const setNotificationFavicon = (count: number) => {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 32, 32);
      // Draw red badge circle
      ctx.beginPath();
      ctx.arc(24, 8, 9, 0, 2 * Math.PI);
      ctx.fillStyle = '#FF0000';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Draw count number
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(count > 9 ? '9+' : String(count), 24, 8);
      // Apply favicon
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = canvas.toDataURL('image/png');
    };
    img.src = originalFaviconHref || '/icon';
  };

  const restoreFavicon = () => {
    if (typeof document === 'undefined') return;
    const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (link && originalFaviconHref) {
      link.href = originalFaviconHref;
    }
    if (titleBlinkInterval) {
      clearInterval(titleBlinkInterval);
      titleBlinkInterval = null;
    }
  };

  const handleWindowFocus = () => {
    unreadMsgCount = 0;
    document.title = originalTitle;
    restoreFavicon();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', handleWindowFocus);
  }

  // Listen for user online
  socket.on('user:online', (data: { userId: string; status: string }) => {
    console.log("🟢 User online:", data.userId);
    onlineStore.updateFromSocket({ userId: data.userId, status: data.status });
  });

  // Listen for user offline
  socket.on('user:offline', (data: { userId: string; status: string; lastActive?: Date }) => {
    console.log("🔴 User offline:", data.userId);
    onlineStore.updateFromSocket({ userId: data.userId, status: data.status, lastActive: data.lastActive });
  });

  // GLOBAL: Listen for new messages and store in pending cache
  socket.on('message:new', (msg: any) => {
    console.log("📨 Global message:new received:", msg.conversationId, msg._id);
    // Store in pending cache - AreaChatMessage will consume this when it opens
    messageStore.addPendingMessage(msg.conversationId, msg);

    // Update tab title and favicon if message is from someone else and tab is not focused
    const senderId = typeof msg.senderId === 'object' ? msg.senderId?._id : msg.senderId;
    if (senderId && senderId !== userId && typeof document !== 'undefined' && !document.hasFocus()) {
      let senderName = 'Ai đó';
      if (typeof msg.senderId === 'object' && msg.senderId) {
        const first = msg.senderId.firstName || '';
        const last = msg.senderId.lastName || '';
        const full = `${first} ${last}`.trim();
        if (full) senderName = full;
      }
      unreadMsgCount += 1;
      const notifTitle = `${senderName} đã gửi ${unreadMsgCount} tin nhắn đến bạn`;
      document.title = notifTitle;

      // Set red badge on favicon
      setNotificationFavicon(unreadMsgCount);

      // Blink tab title for attention
      if (titleBlinkInterval) clearInterval(titleBlinkInterval);
      let showNotif = true;
      titleBlinkInterval = setInterval(() => {
        if (document.hasFocus()) {
          handleWindowFocus();
          return;
        }
        document.title = showNotif ? notifTitle : '💬 Tin nhắn mới!';
        showNotif = !showNotif;
      }, 1500);
    }
  });

  // GLOBAL: Listen for message edits
  socket.on('message:edited', (msg: any) => {
    console.log("✏️ Global message:edited received:", msg.conversationId, msg._id);
    messageStore.updatePendingMessage(msg.conversationId, msg);
  });

  // GLOBAL: Listen for message reactions
  socket.on('message:reaction:updated', (msg: any) => {
    console.log("😀 Global message:reaction received:", msg.conversationId, msg._id);
    messageStore.updatePendingMessage(msg.conversationId, msg);
  });

  // GLOBAL: Listen for message deletes
  socket.on('message:deleted', (msg: any) => {
    console.log("🗑️ Global message:deleted received:", msg.conversationId, msg._id);
    messageStore.updatePendingMessage(msg.conversationId, msg);
  });

  // GLOBAL: Listen for message read status updates
  socket.on('message:read:updated', (data: {
    conversationId: string;
    readBy: { _id: string; firstName: string; lastName: string; avatar?: string } | null;
    readByUserId: string;
  }) => {
    console.log("👁️ Global message:read:updated received:", data);
    if (data.readBy) {
      messageStore.markPendingMessagesAsRead(data.conversationId, data.readBy, userId);
    }
  });

  // Request current online users list - using emit with callback
  socket.emit('users:online', {}, (response: { onlineUsers: string[] }) => {
    console.log("📋 Online users list:", response);
    if (response?.onlineUsers) {
      onlineStore.setOnlineUsers(response.onlineUsers);
    }
  });

  // Also listen for a direct response event (backup)
  socket.on('users:online:response', (data: { onlineUsers: string[] }) => {
    console.log("📋 Online users response event:", data);
    if (data?.onlineUsers) {
      onlineStore.setOnlineUsers(data.onlineUsers);
    }
  });

  // Return cleanup function
  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', handleWindowFocus);
    }
    restoreFavicon();
    document.title = originalTitle;
  };
}