// lib/socket-context.tsx  (hoặc app/socket-context.tsx nếu dùng app router)
'use client';

import { useAuthStore } from '@/stores/useAuthStore';
import { useOnlineStatusStore } from '@/stores/useOnlineStatusStore';
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

    console.log("🔌 Creating sockets with userId:", userId);

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
      console.log("💬 Chat socket connected:", socketIo.id);
      setIsConnected(true);

      // Setup online status listener ONCE when connected
      if (!onlineListenerSetup.current) {
        onlineListenerSetup.current = true;
        setupOnlineStatusListeners(socketIo);
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
      console.log("🧹 Cleanup sockets");
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
function setupOnlineStatusListeners(socket: Socket) {
  const store = useOnlineStatusStore.getState();

  console.log("🟢 Setting up online status listeners (once)");

  // Listen for user online
  socket.on('user:online', (data: { userId: string; status: string }) => {
    store.updateFromSocket({ userId: data.userId, status: data.status });
  });

  // Listen for user offline
  socket.on('user:offline', (data: { userId: string; status: string; lastActive?: Date }) => {
    store.updateFromSocket({ userId: data.userId, status: data.status, lastActive: data.lastActive });
  });

  // Request current online users list
  socket.emit('users:online', {}, (response: { onlineUsers: string[] }) => {
    if (response?.onlineUsers) {
      store.setOnlineUsers(response.onlineUsers);
    }
  });
}