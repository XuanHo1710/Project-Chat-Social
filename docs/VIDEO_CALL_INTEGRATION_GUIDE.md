# Hướng dẫn Tích hợp Video Call (WebRTC) cho Chat

Tài liệu này hướng dẫn chi tiết cách tích hợp tính năng gọi video (Video Call) vào dự án Chat Social hiện tại sử dụng **WebRTC** và **Socket.io** làm Signaling Server.

## 1. Kiến trúc (Architecture)

Chúng ta sẽ sử dụng kiến trúc **Peer-to-Peer (P2P)** trực tiếp giữa hai người dùng (Client-to-Client) cho chất lượng tốt nhất và giảm tải cho server. Server chỉ đóng vai trò là **Signaling Server** (người đưa thư) để trao đổi thông tin kết nối ban đầu.

**Luồng hoạt động:**
1.  **User A (Caller)** gửi yêu cầu gọi (`offer`) lên Server.
2.  **Server** chuyển yêu cầu tới **User B (Callee)**.
3.  **User B** nhận yêu cầu, chấp nhận và gửi lại phản hồi (`answer`).
4.  Hai bên trao đổi các gói tin **ICE Candidates** qua Server để tìm đường đi ngắn nhất kết nối với nhau.
5.  Sau khi kết nối thành công, video/audio stream sẽ được truyền trực tiếp giữa A và B.

---

## 2. Implement phía Backend (NestJS)

Chúng ta cần cập nhật `ChatGateway` để xử lý các sự kiện signaling.

### Bước 1: Cập nhật ChatGateway

Mở file `backend/src/chat/chat.gateway.ts` và thêm các phương thức xử lý sự kiện mới.

```typescript
// Thêm các interfaces để define data payload
interface CallPayload {
  toUserId: string;
  offer: any; // Session Description (SDP)
  conversationId: string;
}

interface AnswerPayload {
  toUserId: string; // ID của người gọi (Caller)
  answer: any; // Session Description (SDP)
  conversationId: string;
}

interface IceCandidatePayload {
  toUserId: string;
  candidate: any;
  conversationId: string;
}

// ... Trong class ChatGateway

  // ============ VIDEO CALL SIGNALING ============

  // 1. Người gọi bắt đầu gọi (Gửi Offer)
  @SubscribeMessage('call:start')
  async handleCallStart(
    @MessageBody() data: CallPayload,
    @ConnectedSocket() client: Socket
  ) {
    const fromUserId = client.data.userId;
    this.logger.log(`User ${fromUserId} calling User ${data.toUserId}`);

    // Lấy thông tin người gọi để hiển thị
    const callerProfile = await this.getSenderProfile(fromUserId);

    // Tìm socket của người nhận
    const recipientSockets = userSockets.get(data.toUserId);
    
    if (recipientSockets && recipientSockets.size > 0) {
      recipientSockets.forEach(socketId => {
        this.server.to(socketId).emit('call:incoming', {
          fromUserId,
          callerName: callerProfile.name,
          callerAvatar: callerProfile.avatar,
          offer: data.offer,
          conversationId: data.conversationId
        });
      });
    } else {
      // Người nhận đang offline
      client.emit('call:failed', { reason: 'User is offline' });
    }
  }

  // 2. Người nhận chấp nhận cuộc gọi (Gửi Answer)
  @SubscribeMessage('call:answer')
  async handleCallAnswer(
    @MessageBody() data: AnswerPayload,
    @ConnectedSocket() client: Socket
  ) {
    const fromUserId = client.data.userId; // Người nhận (Callee)
    
    // Gửi answer lại cho người gọi (Caller)
    const callerSockets = userSockets.get(data.toUserId);
    if (callerSockets) {
      callerSockets.forEach(socketId => {
        this.server.to(socketId).emit('call:accepted', {
          fromUserId, // ID của người nhận trả về
          answer: data.answer
        });
      });
    }
  }

  // 3. Trao đổi ICE Candidates (Để vượt tường lửa/NAT)
  @SubscribeMessage('call:ice-candidate')
  async handleIceCandidate(
    @MessageBody() data: IceCandidatePayload,
    @ConnectedSocket() client: Socket
  ) {
    const fromUserId = client.data.userId;
    
    const targetSockets = userSockets.get(data.toUserId);
    if (targetSockets) {
      targetSockets.forEach(socketId => {
        this.server.to(socketId).emit('call:ice-candidate', {
          fromUserId,
          candidate: data.candidate
        });
      });
    }
  }

  // 4. Kết thúc cuộc gọi
  @SubscribeMessage('call:end')
  async handleCallEnd(
    @MessageBody() data: { toUserId: string },
    @ConnectedSocket() client: Socket
  ) {
    const fromUserId = client.data.userId;
    const targetSockets = userSockets.get(data.toUserId);
    
    if (targetSockets) {
      targetSockets.forEach(socketId => {
        this.server.to(socketId).emit('call:ended', { fromUserId });
      });
    }
  }
```

---

## 3. Implement phía Frontend (Next.js)

Chúng ta sẽ sử dụng library `simple-peer` để đơn giản hóa việc xử lý WebRTC. Đây là thư viện rất phổ biến và dễ dùng cho React.

### Bước 1: Cài đặt thư viện

```bash
cd frontend
npm install simple-peer
npm install --save-dev @types/simple-peer
```

**Lưu ý:** `simple-peer` phụ thuộc vào `readable-stream` và `process`. Nếu dùng Next.js 13+ (App Router), có thể bạn cần config thêm webpack hoặc polyfill nếu gặp lỗi `global is not defined`.
Một cách đơn giản hơn cho Next.js là dùng **web-streams-polyfill** nếu cần, hoặc đơn giản là import dynamically.

Nếu `simple-peer` gây khó khăn với SSR (Server Side Rendering), hãy đảm bảo chỉ import nó trong `useEffect` hoặc dùng `dynamic import`.

### Bước 2: Tạo Context để quản lý trạng thái gọi (CallContext)

Tạo file `src/context/CallContext.tsx`. Context này sẽ bao bọc toàn bộ ứng dụng để bạn có thể nhận cuộc gọi ở bất cứ trang nào.

*(Dưới đây là mã giả định logic chính hướng dẫn)*

```typescript
'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import SimplePeer from 'simple-peer';
import { useSocket } from '@/hooks/useSocket'; // Hook lấy socket instance
import { useAuth } from '@/hooks/useAuth'; // Hook lấy user info

interface CallContextType {
  callUser: (userId: string, conversationId: string) => void;
  answerCall: () => void;
  leaveCall: () => void;
  callReceived: boolean;
  isInCall: boolean;
  stream: MediaStream | undefined; // Local stream
  userVideo: React.MutableRefObject<HTMLVideoElement | null>;
  myVideo: React.MutableRefObject<HTMLVideoElement | null>;
  callerInfo: any;
  hasVideo: boolean;
  hasAudio: boolean;
}

const CallContext = createContext<CallContextType | null>(null);

export const CallProvider = ({ children }: { children: React.ReactNode }) => {
  const [stream, setStream] = useState<MediaStream>();
  const [isInCall, setIsInCall] = useState(false);
  const [callReceived, setCallReceived] = useState(false);
  const [callerSignal, setCallerSignal] = useState<any>(null);
  const [callerInfo, setCallerInfo] = useState<any>(null); // { name, avatar, id }
  
  const myVideo = useRef<HTMLVideoElement | null>(null);
  const userVideo = useRef<HTMLVideoElement | null>(null);
  const connectionRef = useRef<SimplePeer.Instance | null>(null);
  
  const { socket } = useSocket();
  const { user } = useAuth(); // Current user

  useEffect(() => {
    if (!socket) return;

    // Lắng nghe cuộc gọi đến
    socket.on('call:incoming', (data) => {
      setCallReceived(true);
      setCallerInfo({
        name: data.callerName,
        avatar: data.callerAvatar,
        id: data.fromUserId,
        conversationId: data.conversationId
      });
      setCallerSignal(data.offer);
    });
    
    // Lắng nghe khi đối phương dập máy
    socket.on('call:ended', () => {
       leaveCall();
    });

    return () => {
      socket.off('call:incoming');
      socket.off('call:ended');
    };
  }, [socket]);

  // Hàm gọi điện
  const callUser = (userId: string, conversationId: string) => {
    // 1. Get User Media (Cam/Mic)
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((currentStream) => {
        setStream(currentStream);
        if (myVideo.current) myVideo.current.srcObject = currentStream;
        
        setIsInCall(true); // Hiển thị modal gọi

        const peer = new SimplePeer({
          initiator: true, // Là người bắt đầu
          trickle: false,
          stream: currentStream
        });

        peer.on('signal', (data) => {
          // Gửi offer lên server
          socket.emit('call:start', {
            toUserId: userId,
            offer: data,
            conversationId
          });
        });

        peer.on('stream', (remoteStream) => {
          if (userVideo.current) userVideo.current.srcObject = remoteStream;
        });
        
        // Lắng nghe khi đối phương chấp nhận
        socket.on('call:accepted', (data) => {
           setCallAccepted(true);
           peer.signal(data.answer);
        });

        connectionRef.current = peer;
      })
      .catch(err => console.error('Failed to get media:', err));
  };

  // Hàm trả lời
  const answerCall = () => {
     setCallReceived(false);
     setIsInCall(true);

     navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((currentStream) => {
        setStream(currentStream);
        if (myVideo.current) myVideo.current.srcObject = currentStream;

        const peer = new SimplePeer({
          initiator: false,
          trickle: false,
          stream: currentStream
        });

        peer.on('signal', (data) => {
          socket.emit('call:answer', {
            toUserId: callerInfo.id,
            answer: data,
            conversationId: callerInfo.conversationId
          });
        });
        
         peer.on('stream', (remoteStream) => {
          if (userVideo.current) userVideo.current.srcObject = remoteStream;
        });

        peer.signal(callerSignal);
        connectionRef.current = peer;
      });
  };

  const leaveCall = () => {
    // Dọn dẹp
    setIsInCall(false);
    setCallReceived(false);
    
    connectionRef.current?.destroy();
    
    // Stop local tracks
    stream?.getTracks().forEach(track => track.stop());
    setStream(undefined);
    
    // Thông báo cho người kia
    if (callerInfo?.id) {
       socket.emit('call:end', { toUserId: callerInfo.id });
    }
  };

  return (
    <CallContext.Provider value={{
      callUser,
      answerCall,
      leaveCall,
      callReceived,
      isInCall,
      stream,
      myVideo,
      userVideo,
      callerInfo,
      // ... states
    }}>
      {children}
      {/* Nơi đặt Component UI hiển thị cuộc gọi */}
      {isInCall && <VideoCallModal />} 
      {/* Nơi đặt Component UI báo cuộc gọi đến */}
      {callReceived && <IncomingCallNotification />}
    </CallContext.Provider>
  );
};
```

### Bước 3: Tạo VideoCallModal (UI)

Tạo component `src/components/chat/VideoCallModal.tsx`.

Giao diện nên có:
1.  **Video lớn**: Video của đối phương (remote stream).
2.  **Video nhỏ (góc)**: Video của chính mình (local stream - mirror).
3.  **Các nút điều khiển**:
    *   Mute/Unmute Mic.
    *   On/Off Camera.
    *   End Call (Nút đỏ).

### Bước 4: Tích hợp vào Layout

Wrap layout chính của app bằng `CallProvider` để tính năng gọi khả dụng toàn hệ thống.

File: `src/app/layout.tsx`

```tsx
<AuthProvider>
  <SocketProvider>
    <CallProvider> {/* Thêm vào đây */}
       {children}
    </CallProvider>
  </SocketProvider>
</AuthProvider>
```

### Bước 5: Thêm nút Gọi Video vào Header Chat

Sửa file Header của khung chat (ví dụ `ChatHeader.tsx` hoặc `ConversationHeader.tsx`), thêm nút icon Camera. Khi click thì gọi hàm `callUser(currentRecipientId, currentConversationId)` từ Context.

---

## 4. Lưu ý quan trọng (Troubleshooting)

1.  **HTTPS**: WebRTC (getUserMedia) BẮT BUỘC phải chạy trên **HTTPS** hoặc **localhost**. Nếu bạn deploy lên server mà không có SSL, camera sẽ không bật được.
2.  **STUN/TURN Servers**:
    *   Khi chạy localhost cùng mạng LAN, WebRTC hoạt động tốt.
    *   Khi chạy môi trường thực tế (User A mạng Viettel, User B mạng FPT), bạn cần cấu hình **TURN Server** để vượt NAT/Firewall.
    *   Có thể sử dụng STUN server miễn phí của Google: `{ urls: 'stun:stun.l.google.com:19302' }`.
    *   Nếu STUN không đủ, cần tự dựng COTURN server hoặc mua dịch vụ Twilio/Xirsys.
3.  **Permissions**: Trình duyệt sẽ hỏi quyền truy cập Camera/Mic. Hãy xử lý trường hợp user từ chối quyền.
