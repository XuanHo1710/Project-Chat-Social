# RabbitMQ Message Processing Architecture

## Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MESSAGE FLOW ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────┐         ┌───────────────┐         ┌───────────────┐     │
│  │   Frontend    │ socket  │   Backend     │  emit   │   RabbitMQ    │     │
│  │   (Client)    │ ───────►│   (Gateway)   │ ───────►│   Consumer    │     │
│  │               │ ◄─────  │               │ ◄─────  │               │     │
│  └───────────────┘  socket └───────────────┘  emit   └───────────────┘     │
│                                                             │               │
│                                                    ┌────────┴────────┐      │
│                                                    ▼                 ▼      │
│                                            ┌───────────┐     ┌───────────┐  │
│                                            │ AI Server │     │   FCM     │  │
│                                            │ (Python)  │     │ (Firebase)│  │
│                                            └───────────┘     └───────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Flow chi tiết

### 1. User gửi tin nhắn

```
User ──► Frontend ──► Backend Gateway (socket)
                          │
                          ├── Save message to MongoDB ✅
                          ├── Emit socket 'message:new' to room ✅ (REAL-TIME)
                          └── Emit RabbitMQ 'chat.message.created' (ASYNC)
```

### 2. RabbitMQ Consumer xử lý

```
RabbitMQ Consumer receives 'chat.message.created'
    │
    ├── Process AI Chatbot (nếu cần)
    │       ├── Query chat history từ MongoDB
    │       ├── Gọi AI Server HTTP API
    │       ├── Save AI response to MongoDB
    │       └── Emit 'chat.ai.response' về Backend
    │
    └── Process FCM Notification (cho offline users)
            ├── Check user online status
            ├── Check mute status
            └── Send FCM via Firebase Admin SDK
```

### 3. Backend nhận AI response

```
Backend receives 'chat.ai.response' from backend_queue
    │
    ├── Query saved message from MongoDB (with populate)
    └── Emit socket 'message:new' to room (REAL-TIME)
```

## Queues

| Queue Name       | Publisher        | Consumer         | Purpose                    |
|------------------|------------------|------------------|----------------------------|
| `social_queue`   | Backend          | RabbitMQ Service | AI + FCM processing        |
| `backend_queue`  | RabbitMQ Service | Backend          | AI response + typing events|

## Events

### Backend → RabbitMQ Consumer

| Event                    | Data                                                           |
|--------------------------|----------------------------------------------------------------|
| `chat.message.created`   | messageId, conversationId, senderId, content, attachments,     |
|                          | isChatbotConversation, isChatbotMentioned, participantIds,     |
|                          | senderName, senderAvatar                                       |

### RabbitMQ Consumer → Backend

| Event              | Data                                                               |
|--------------------|-------------------------------------------------------------------|
| `chat.ai.response` | conversationId, messageId, senderId, content, postIdsRecommendation|
| `chat.typing`      | conversationId, isTyping                                           |

## Cách chạy

### 1. Khởi động Backend

```bash
cd backend
npm run start:dev
```

### 2. Khởi động RabbitMQ Consumer

```bash
cd rabbitmq
npm run start:dev
```

### 3. Khởi động AI Server

```bash
cd server-ai
python main.py
```

## Environment Variables

### Backend (.env)

```env
RABBITMQ_URL=amqp://user:123123123@localhost:5672
RABBITMQ_QUEUE_NAME=social_queue
```

### RabbitMQ Consumer (.env)

```env
RABBITMQ_URL=amqp://user:123123123@localhost:5672
RABBITMQ_QUEUE_NAME=social_queue
MONGODB_URI=mongodb+srv://...
AI_SERVER_URL=http://localhost:8000/api/v1
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
```

## Lợi ích

1. **Real-time nhanh hơn**: Message được gửi ngay lập tức, AI/FCM xử lý async
2. **Retry được**: Nếu AI/FCM fail, RabbitMQ sẽ retry
3. **Scale được**: Có thể chạy nhiều instance RabbitMQ Consumer
4. **Decouple**: Backend không phụ thuộc vào AI/FCM response time
5. **Fault tolerant**: Nếu AI/FCM down, message vẫn được lưu và gửi

## Troubleshooting

### RabbitMQ không nhận được message
- Check RabbitMQ server đang chạy: `rabbitmqctl status`
- Check queue exists: `rabbitmqctl list_queues`

### AI response không hiển thị
- Check backend_queue được tạo
- Check Backend listening on backend_queue
- Check RabbitMQ Consumer có emit 'chat.ai.response'

### FCM không gửi được
- Check Firebase credentials trong RabbitMQ .env
- Check user có FCM token
- Check user không mute conversation
