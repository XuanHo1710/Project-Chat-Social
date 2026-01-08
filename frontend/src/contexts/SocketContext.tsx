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
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  socketChat: null,
  isConnected: false,
  socketRelationship: null,
  socketReaction: null,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketRelationship, setSocketRelationship] = useState<Socket | null>(null);
  const [socketReaction, setSocketReaction] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuthStore();

  // Track if online status listener is already setup
  const onlineListenerSetup = useRef(false);

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

    // Event handlers
    socketIo.on("connect", () => {
      setIsConnected(true);

      // Setup global listeners ONCE when connected
      if (!onlineListenerSetup.current) {
        onlineListenerSetup.current = true;
        setupOnlineStatusListeners(socketIo, userId);
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

    setSocket(socketIo);
    setSocketRelationship(socketRelationshipIo);
    setSocketReaction(socketReactionIo);

    return () => {
      onlineListenerSetup.current = false;
      socketIo.disconnect();
      socketRelationshipIo.disconnect();
      socketReactionIo.disconnect();
    };
  }, [user?.id]);


  return (
    <SocketContext.Provider value={{ socket, socketChat: socket, isConnected, socketRelationship, socketReaction }}>
      {children}
    </SocketContext.Provider>
  );
};

// Centralized online status listeners - runs ONCE
function setupOnlineStatusListeners(socket: Socket, userId: string) {
  const onlineStore = useOnlineStatusStore.getState();
  const messageStore = useMessageCacheStore.getState();

  console.log("🟢 Setting up global socket listeners (once)");

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
  socket.on('message:read:updated', (data: { conversationId: string; readBy: string }) => {
    console.log("👁️ Global message:read:updated received:", data);
    messageStore.markPendingMessagesAsRead(data.conversationId, data.readBy, userId);
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
}