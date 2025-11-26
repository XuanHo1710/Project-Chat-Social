// lib/socket-context.tsx  (hoặc app/socket-context.tsx nếu dùng app router)
'use client';

import { useAuthStore } from '@/stores/useAuthStore';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    const userId = user?.id;

    if (!userId) {
      // Không làm gì cả, chỉ đợi userId xuất hiện
      return;
    }

    console.log("🔌 Creating socket with userId:", userId);
    const socketIo = io(process.env.NEXT_PUBLIC_SOCKET_URL + "/chat", {
      query: { userId },
      transports: ["websocket"],
      reconnection: true,
    });

    const initSocket = () => {
      const socketIo = io(process.env.NEXT_PUBLIC_SOCKET_URL + "/chat", {
        query: { userId },
        transports: ["websocket"],
        reconnection: true,
      });

      socketIo.on("connect", () => {
        console.log("SOCKET CONNECTED:", socketIo.id);
        setIsConnected(true);
      });

      socketIo.on("disconnect", () => {
        console.log("SOCKET DISCONNECTED");
        setIsConnected(false);
      });

      setSocket(socketIo);
    }

    initSocket();

    return () => {
      console.log("🧹 Cleanup socket");
      socketIo.disconnect();
    };
  }, [user?.id]);


  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};