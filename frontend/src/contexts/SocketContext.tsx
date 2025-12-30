// lib/socket-context.tsx  (hoặc app/socket-context.tsx nếu dùng app router)
'use client';

import { useAuthStore } from '@/stores/useAuthStore';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  socketRelationship: Socket | null;
  socketReaction: Socket | null;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
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

  useEffect(() => {
    const userId = user?.id;

    if (!userId) {
      // Không làm gì cả, chỉ đợi userId xuất hiện
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

    // Reaction socket (NEW)
    const socketReactionIo = io(process.env.NEXT_PUBLIC_SOCKET_URL + "/reaction", {
      query: { userId },
      transports: ["websocket"],
      reconnection: true,
    });

    // Event handlers
    socketIo.on("connect", () => {
      console.log("💬 Chat socket connected:", socketIo.id);
      setIsConnected(true);
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
      socketIo.disconnect();
      socketRelationshipIo.disconnect();
      socketReactionIo.disconnect();
    };
  }, [user?.id]);


  return (
    <SocketContext.Provider value={{ socket, isConnected, socketRelationship, socketReaction }}>
      {children}
    </SocketContext.Provider>
  );
};