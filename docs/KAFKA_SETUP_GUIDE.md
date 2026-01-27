# Hướng dẫn thiết lập Apache Kafka cho Project Chat Social

## 1. Giới thiệu
Apache Kafka là một nền tảng event streaming phân tán, được thiết kế để xử lý dữ liệu realtime với băng thông cao và độ trễ thấp. Trong dự án, Kafka được sử dụng cho:
- **Newsfeed Fan-out**: Pre-compute feeds cho users (kiến trúc phổ biến nhất của Facebook, Twitter)
- Tracking hành vi người dùng (User activity tracking)
- Event sourcing và analytics

## 2. Kiến trúc Newsfeed với Kafka

```
┌─────────────────┐     ┌─────────────────┐     ┌───────────────────┐
│    Backend      │────▶│      Kafka      │────▶│  Kafka Consumer   │
│   (Producer)    │     │  (Event Broker) │     │   (Processor)     │
└─────────────────┘     └─────────────────┘     └───────────────────┘
       │                        │                        │
       │                        │                        ▼
       │                   Topics:               ┌───────────────────┐
       │              - post-events              │  MongoDB (Feeds)  │
       │              - user-interactions        │  user_feeds table │
       │                                         └───────────────────┘
       │
       ▼
 Khi user tạo post, emit event
 đến Kafka với followerIds
```

### Topics:
- **post-events**: Khi posts được tạo, cập nhật, xóa
- **user-interactions**: Khi users tương tác (like, comment, view, follow)

### Schemas:
- **UserFeed**: Pre-computed feed cho mỗi user (postId, authorId, score, timestamp)
- **UserInteraction**: Lịch sử tương tác để analytics

## 3. Cài đặt Kafka (Sử dụng Docker)

### Bước 1: Di chuyển đến thư mục kafka-server
```bash
cd kafka-server
```

### Bước 2: Khởi chạy Docker
```bash
docker compose up -d
```

### Bước 3: Kiểm tra
- **Kafka UI**: Truy cập http://localhost:8090 để xem Dashboard quản lý Topic, Messages, Consumers.
- Nếu vào được giao diện và thấy status cluster là Online nghĩa là đã thành công.

---

## 4. Cấu hình Environment Variables

### Backend (.env)
```env
KAFKA_BROKER=localhost:9092
```

### Kafka Server (.env)
```env
KAFKA_BROKER=localhost:9092
MONGODB_URI=<your-mongodb-uri>
PORT=3002
```

---

## 5. Chạy Services

### 1. Khởi động Kafka (Docker)
```bash
cd kafka-server
docker compose up -d
```

### 2. Khởi động Kafka Consumer Service
```bash
cd kafka-server
npm run start:dev
```

### 3. Khởi động Backend (đã có sẵn)
```bash
cd backend
npm run start:dev
```

---

## 6. Cấu trúc thư mục Kafka Server

```
kafka-server/
├── src/
│   ├── feed/
│   │   ├── dto/
│   │   │   └── feed-event.dto.ts       # DTOs cho events
│   │   ├── schemas/
│   │   │   ├── user-feed.schema.ts     # Schema pre-computed feed
│   │   │   └── user-interaction.schema.ts  # Schema interaction tracking
│   │   ├── feed.module.ts
│   │   ├── feed.service.ts             # Logic fan-out, scoring
│   │   └── feed-consumer.controller.ts # Kafka event handlers
│   ├── app.module.ts
│   └── main.ts                         # Kafka microservice config
├── docker-compose.yml                  # Zookeeper + Kafka + Kafka UI
└── .env
```

---

## 7. Luồng hoạt động

### Khi User tạo Post:
1. **Backend**: `PostService.create()` emit event `post-events` với `POST_CREATED`
2. **Kafka**: Nhận event và đẩy đến consumers
3. **Kafka Consumer**: `FeedService.handlePostEvent()` fan-out post đến feeds của followers
4. **MongoDB**: Lưu vào `user_feeds` collection

### Khi User Like/Comment:
1. **Backend**: Emit event `user-interactions` với type `POST_LIKE` / `POST_COMMENT`
2. **Kafka Consumer**: 
   - Lưu interaction vào `user_interactions` (analytics)
   - Tăng score của post trong feeds (boost visibility)

### Khi User mở Newsfeed:
1. **Backend**: Query `user_feeds` với `userId`, sắp xếp theo `score` và `postCreatedAt`
2. **Response**: Trả về danh sách posts đã pre-computed, siêu nhanh!

---

## 8. Backend Integration

### KafkaProducerService
File: `backend/src/kafka/kafka-producer.service.ts`

```typescript
// Emit khi tạo post
await this.kafkaProducer.emitPostCreated(
  postId,
  authorId,
  followerIds,
  { content, privacy, mediaType, groupId }
);

// Emit khi like
await this.kafkaProducer.emitPostLike(userId, postId, reactionType);

// Emit khi comment
await this.kafkaProducer.emitPostComment(userId, postId, commentPreview);

// Emit khi follow
await this.kafkaProducer.emitUserFollow(userId, targetUserId);
```

---

## 9. Lưu ý quan trọng

- **Broker URL**: Khi chạy local (ngoài Docker), dùng `localhost:9092`. Nếu service backend cũng chạy trong Docker (cùng network), dùng `kafka:29092`.
- **Kafka UI**: Truy cập http://localhost:8090 để debug, xem tin nhắn có được đẩy vào topic hay không.
- **MongoDB Atlas**: Đảm bảo IP whitelist đúng nếu sử dụng cloud MongoDB.
- **Graceful Shutdown**: Kafka consumer sẽ tự commit offset khi tắt service.

---

## 10. Troubleshooting

### Kafka không khởi động được
- Kiểm tra Docker Desktop đang chạy
- Chạy `docker compose down` rồi `docker compose up -d` lại

### Consumer không nhận được event
- Kiểm tra topic đã được tạo trong Kafka UI
- Xem logs: `docker logs social-kafka`

### Connection refused
- Đảm bảo `KAFKA_BROKER=localhost:9092` đúng
- Kiểm tra port 9092 không bị firewall chặn
