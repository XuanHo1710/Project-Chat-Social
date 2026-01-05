# 📬 Hệ thống Message Cache - Giải thích chi tiết

## 🤔 Vấn đề gặp phải

Khi sử dụng React Query để cache tin nhắn, có một vấn đề lớn:

### Scenario:

1. **User A** đang mở conversation **X** (chat với User B)
2. **User C** gửi tin nhắn vào conversation **Y** (chat khác với User A)
3. Socket nhận event `message:new` cho conversation Y
4. **NHƯNG** listener chỉ update cache cho conversation X (đang xem)
5. **Kết quả**: Khi User A chuyển sang conversation Y, tin nhắn của User C **KHÔNG HIỆN**!

### Tại sao?

- React Query cache được key theo `[QUERY_KEYS.CHATS, conversationId]`
- Component `AreaChatMessage` chỉ listen và update cache cho conversation đang mở
- Tin nhắn đến các conversation khác **bị bỏ qua**

---

## 💡 Giải pháp: useMessageCacheStore

Tạo một **Zustand store** để lưu trữ "pending messages" cho TẤT CẢ conversations.

```
┌─────────────────────────────────────────────────────────────────┐
│                    GLOBAL SOCKET LISTENER                        │
│              (trong SocketContext.tsx)                           │
├─────────────────────────────────────────────────────────────────┤
│  Nhận TẤT CẢ events: message:new, message:edited, etc.          │
│                           │                                      │
│                           ▼                                      │
│     ┌─────────────────────────────────────────┐                 │
│     │      useMessageCacheStore               │                 │
│     │  ┌───────────────────────────────────┐  │                 │
│     │  │ pendingMessages: {                │  │                 │
│     │  │   "conv_A": [msg1, msg2],         │  │                 │
│     │  │   "conv_B": [msg3],               │  │                 │
│     │  │   "conv_C": [msg4, msg5, msg6]    │  │                 │
│     │  │ }                                 │  │                 │
│     │  └───────────────────────────────────┘  │                 │
│     └─────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Luồng hoạt động

### 1️⃣ Khi có tin nhắn mới đến (Global)

```
Socket Server ──message:new──▶ SocketContext.tsx (Global Listener)
                                      │
                                      ▼
                        messageStore.addPendingMessage(
                            msg.conversationId,
                            msg
                        )
                                      │
                                      ▼
                        pendingMessages["conv_Y"].push(msg)
```

### 2️⃣ Khi User mở một conversation

```
User clicks Conversation Y
         │
         ▼
AreaChatMessage mount (key=Y)
         │
         ▼
useEffect chạy:
    1. consumePendingMessages("conv_Y")
       → Lấy tất cả pending messages cho Y
       → Xóa pending["conv_Y"]
         │
         ▼
    2. Merge vào React Query cache
       → queryClient.setQueryData([CHATS, Y], ...)
       → Thêm pending messages vào cuối
         │
         ▼
    3. UI render với đầy đủ tin nhắn!
```

### 3️⃣ Real-time updates khi đang xem

```
Đang xem Conversation Y
         │
         ▼
Socket nhận message:new cho Y
         │
    ┌────┴────┐
    │         │
    ▼         ▼
Global    Local Listener
Listener  (AreaChatMessage)
    │         │
    ▼         │
Add to    Update React Query
pending   cache trực tiếp
    │         │
    ▼         │
clearPending ◀┘
(đã xử lý rồi)
```

---

## 📝 Các methods trong useMessageCacheStore

| Method                                              | Mục đích                                      |
| --------------------------------------------------- | --------------------------------------------- |
| `addPendingMessage(convId, msg)`                    | Lưu tin nhắn mới vào pending                  |
| `consumePendingMessages(convId)`                    | Lấy và xóa tất cả pending cho 1 conversation  |
| `updatePendingMessage(convId, msg)`                 | Cập nhật tin nhắn (edit, reaction)            |
| `markPendingMessagesAsRead(convId, readBy, userId)` | Đánh dấu đã đọc                               |
| `clearPending(convId)`                              | Xóa pending (khi đã xử lý bởi local listener) |

---

## 🔢 Luồng Unread Count

```
┌──────────────────────────────────────────────────────────────┐
│ User B gửi tin nhắn vào conversation với User A              │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ Backend: chat.gateway.ts                                     │
│   1. Lưu message với status: 'SENT'                         │
│   2. conversationService.incrementUnreadCount()              │
│      → unreadCount[userA] += 1                               │
│   3. Emit 'conversation:unread:updated'                      │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ Frontend: ChatPage + Sidebar                                  │
│   1. Nhận event 'conversation:unread:updated'                │
│   2. refetchQueries([CONVERSATION_BY_USER])                  │
│   3. Sidebar hiện badge: 1                                   │
└──────────────────────────────────────────────────────────────┘
                             │
         User A click vào conversation
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ Frontend: AreaChatMessage.tsx                                 │
│   1. Emit 'message:read' { conversationId }                  │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ Backend: chat.gateway.ts                                     │
│   1. chatService.markAsRead() → status: 'READ'               │
│   2. conversationService.resetUnreadCount()                  │
│      → unreadCount[userA] = 0                                │
│   3. Emit 'message:read:updated' + 'conversation:unread:reset'│
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ Frontend:                                                     │
│   1. Nhận 'conversation:unread:reset'                        │
│   2. refetchQueries([CONVERSATION_BY_USER])                  │
│   3. Sidebar badge: BIẾN MẤT (unreadCount = 0)               │
│                                                               │
│   4. Nhận 'message:read:updated'                             │
│   5. Update message status trong cache → 'READ'              │
│   6. MessageItem hiện avatar đã xem                          │
└──────────────────────────────────────────────────────────────┘
```

---

## ⚠️ Edge Cases đã xử lý

### 1. Duplicate messages

```typescript
// Trong handleNewMessage:
const exists = oldData.pages.some((p) => p.data.some((m) => m._id === msg._id));
if (exists) return oldData; // Không thêm nếu đã có
```

### 2. Tin nhắn đến khi đang xem conversation khác

```typescript
// Global listener lưu vào pending
// Khi mở lại → consumePendingMessages() merge vào cache
```

### 3. Clear pending khi local listener đã xử lý

```typescript
// Trong handleNewMessage của AreaChatMessage:
useMessageCacheStore.getState().clearPending(selectedConversation._id);
```

---

## 🗂️ File Structure

```
frontend/src/
├── stores/
│   └── useMessageCacheStore.ts   # Zustand store cho pending messages
├── contexts/
│   └── SocketContext.tsx          # Global socket listeners
├── components/chats/
│   └── AreaChatMessage.tsx        # Chat component + local listeners
└── app/(client)/chat/
    └── page.tsx                   # Chat page + conversation list refresh
```

---

## 🐛 Debug Tips

Mở Console và xem các logs:

- `📨 Global message:new received:` - Tin nhắn nhận từ global listener
- `📥 Consuming pending messages:` - Khi merge pending vào cache
- `👁️ Message read event received:` - Khi có cập nhật đã đọc
- `🔄 Unread update event received:` - Khi unread count thay đổi
- `✅ Mark as read response:` - Response từ server khi mark as read
