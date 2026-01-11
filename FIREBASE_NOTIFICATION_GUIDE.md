# Hướng dẫn Tích hợp Firebase Notification cho Chat

Tài liệu này hướng dẫn chi tiết cách tích hợp Firebase Cloud Messaging (FCM) vào dự án hiện tại để gửi thông báo đẩy (push notifications) khi có tin nhắn mới trong Chat.

## 1. Chuẩn bị (Prerequisites)

1.  Truy cập [Firebase Console](https://console.firebase.google.com/).
2.  Tạo một dự án mới (hoặc sử dụng dự án có sẵn).
3.  Trong phần **Project Settings > Service accounts**, tạo và tải xuống file `serviceAccountKey.json`.
    *   Đổi tên file này thành `firebase-service-account.json`.
    *   Lưu file này vào thư mục `backend/` (cùng cấp với `.env`). **Lưu ý: Thêm file này vào `.gitignore` để bảo mật.**
4.  Trong phần **Project Settings > General**, tạo ứng dụng Web để lấy cấu hình `firebaseConfig` (apiKey, authDomain, projectId, ...).

---

## 2. Implement phía Backend (NestJS)

### Bước 1: Cài đặt thư viện
Tại thư mục `backend`, chạy lệnh:
```bash
npm install firebase-admin
```

### Bước 2: Cài đặt biến môi trường
Cập nhật file `.env` trong `backend` để thêm đường dẫn tới file service key (hoặc có thể hardcode đường dẫn trong code nếu muốn đơn giản, nhưng khuyến khích dùng biến môi trường):
```env
FIREBASE_CREDENTIAL_PATH=./firebase-service-account.json
```

### Bước 3: Tạo Firebase Service
Tạo module và service mới để xử lý Firebase.
File: `src/firebase/firebase.service.ts`

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  onModuleInit() {
    // Kiểm tra xem app đã khởi tạo chưa để tránh lỗi
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(require('../../firebase-service-account.json')),
      });
    }
  }

  async sendToDevice(tokens: string[], title: string, body: string, data: any = {}) {
    if (!tokens || tokens.length === 0) return;

    try {
      const message: admin.messaging.MulticastMessage = {
        tokens: tokens,
        notification: {
          title,
          body,
        },
        data: {
          ...data,
          // Đảm bảo data là string
          conversationId: data.conversationId?.toString() || '',
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      console.log('Successfully sent message:', response);
      
      // Có thể xử lý xóa các token lỗi (invalid/expired) tại đây dựa trên response.responses
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }
}
```

Nhớ đăng ký `FirebaseService` vào `AppModule` hoặc `ChatModule`.

### Bước 4: Cập nhật Account Entity
Cần lưu trữ FCM Token của người dùng. Một người dùng có thể đăng nhập trên nhiều thiết bị, nên cần lưu mảng tokens.
File: `src/account/entities/account.entity.ts`

```typescript
// Thêm prop này vào class Account
@Prop({ type: [String], default: [] })
fcmTokens: string[];
```

### Bước 5: Cập nhật ChatGateway
Sửa file `src/chat/chat.gateway.ts` để gửi thông báo khi có tin nhắn mới.

1.  Inject `FirebaseService` vào `ChatGateway`.
2.  Trong hàm `handleEmitMessageToClient`, logic gửi thông báo sẽ như sau:

```typescript
// ... trong class ChatGateway

constructor(
  // ... các service khác
  private readonly firebaseService: FirebaseService, // Inject service
) {}

async handleEmitMessageToClient(...) {
  // ... code cũ emit socket

  // LOGIC MỚI: Gửi Notification
  activeParticipants.forEach(async (participant) => {
      const participantId = participant.user._id.toString();
      
      // Không gửi cho chính người gửi
      if (participantId === userId) return;

      const participantSockets = userSockets.get(participantId);
      
      // Logic: Nếu user OFFLINE (không có socket kết nối) HOẶC muốn gửi cả khi online thì tùy chỉnh
      // Ở đây ví dụ gửi khi user không có socket nào active (OFFLINE)
      const isOffline = !participantSockets || participantSockets.size === 0;
      
      if (isOffline) {
        // Lấy thông tin user để lấy fcmTokens
        const userAccount = await this.accountModel.findById(participantId).select('fcmTokens');
        if (userAccount && userAccount.fcmTokens && userAccount.fcmTokens.length > 0) {
           
           // Tạo nội dung thông báo
           // data.conversationId, data.senderId... có sẵn từ tham số hàm
           const senderName = await this.getUserDisplayName(userId);
           const contentPreview = savedMessage.content || '[Hình ảnh/File]'; // Xử lý nếu tin nhắn chỉ có ảnh
           
           await this.firebaseService.sendToDevice(
             userAccount.fcmTokens,
             senderName, // Title là tên người gửi
             contentPreview, // Body là nội dung tin nhắn
             { 
               conversationId: data.conversationId.toString(),
               type: 'NEW_MESSAGE'
             }
           );
        }
      }
  });
}
```

### Bước 6: API Lưu FCM Token
Cần một API để Client gửi token lên server khi người dùng đăng nhập/cấp quyền.
Tạo controller mới hoặc dùng `AccountController` (`src/account/account.controller.ts`).

```typescript
// Ví dụ endpoint
@Post('save-fcm-token')
@UseGuards(JwtAuthGuard)
async saveFcmToken(@User() user, @Body('token') token: string) {
  // Tìm user và add token vào mảng fcmTokens nếu chưa tồn tại
  // Logic update: $addToSet: { fcmTokens: token }
}
```

---

## 3. Implement phía Frontend (Next.js)

### Bước 1: Cài đặt thư viện
Tại thư mục `frontend`:
```bash
npm install firebase
```

### Bước 2: Cấu hình Firebase Client
Tạo file `src/lib/firebase.ts` (hoặc vị trí tương tự):

```typescript
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  // Copy từ Firebase Console > Project Settings > General
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};

const app = initializeApp(firebaseConfig);

// Messaging chỉ hoạt động trên browser environment và cần sw
export const getFirebaseToken = async () => {
  try {
    const messaging = getMessaging(app);
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      const currentToken = await getToken(messaging, {
        vapidKey: 'KEY_PAIR_TU_TAB_CLOUD_MESSAGING_TRONG_CONSOLE' 
      });
      if (currentToken) {
        return currentToken;
      } else {
        console.log('No registration token available.');
      }
    }
  } catch (err) {
    console.log('An error occurred while retrieving token. ', err);
  }
  return null;
};

export const onMessageListener = () => {
  const messaging = getMessaging(app);
  return new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
};
```

### Bước 3: Tạo Service Worker
Tạo file `public/firebase-messaging-sw.js` (Bắt buộc phải tên này và ở thư mục public để nhận background notification).

```javascript
importScripts('https://www.gstatic.com/firebasejs/9.x.x/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.x.x/firebase-messaging-compat.js');

firebase.initializeApp({
  // Copy config y hệt bước 2
   apiKey: "...",
   // ...
   messagingSenderId: "...", // Quan trọng
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png', // Đường dẫn icon app
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
```

### Bước 4: Tích hợp vào App
Trong Layout chính (ví dụ `src/app/layout.tsx` hoặc 1 component `AuthProvider`), gọi hàm lấy token khi user đã login.

```typescript
useEffect(() => {
  if (user) { // Chỉ chạy khi đã login
      getFirebaseToken().then((token) => {
          if (token) {
              // Gọi API backend để lưu token này: POST /accounts/save-fcm-token
              api.post('/accounts/save-fcm-token', { token });
          }
      });
      
      // Lắng nghe foreground message (khi đang mở app)
      onMessageListener().then(payload => {
         // Hiện toast notification hoặc update UI
         toast(payload.notification.title, { description: payload.notification.body });
      });
  }
}, [user]);
```

## 4. Kiểm tra
1.  Chạy backend và frontend.
2.  Login user A trên trình duyệt, cho phép nhận thông báo. Token được gửi lên server.
3.  Tắt tab của user A (để giả lập offline hoặc background).
4.  Dùng user B gửi tin nhắn cho user A.
5.  User A sẽ nhận được notification từ trình duyệt/hệ điều hành.
