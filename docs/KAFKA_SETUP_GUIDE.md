# Hướng dẫn thiết lập Apache Kafka cho Project Chat Social

## 1. Giới thiệu
Apache Kafka là một nền tảng event streaming phân tán, được thiết kế để xử lý dữ liệu realtime với băng thông cao và độ trễ thấp. Trong dự án, Kafka thích hợp cho:
- Tracking hành vi người dùng (User activity tracking).
- Hệ thống log tập trung.
- Event sourcing.
- Xử lý các luồng dữ liệu (Message stream processing).

## 2. Cài đặt Kafka (Sử dụng Docker)

Việc cài đặt Kafka trực tiếp trên Windows khá phức tạp (yêu cầu Java, cấu hình môi trường...), do đó **Docker** là giải pháp tốt nhất. Dưới đây là cấu hình bao gồm: Zookeeper, Kafka Broker và Kafka UI để quản lý.

### Bước 1: Tạo file cấu hình
Tạo file `docker-compose.kafka.yml` tại thư mục gốc dự án:

```yaml
version: '3'
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.4.0
    container_name: social-zookeeper
    ports:
      - "2181:2181"
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000

  kafka:
    image: confluentinc/cp-kafka:7.4.0
    container_name: social-kafka
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      # Cấu hình để Kafka có thể truy cập từ ngoài container (localhost) và trong mạng Docker
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092,PLAINTEXT_INTERNAL://kafka:29092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_INTERNAL:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT_INTERNAL
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1

  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    container_name: social-kafka-ui
    ports:
      - "8080:8080"
    depends_on:
      - kafka
    environment:
      KAFKA_CLUSTERS_0_NAME: local
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:29092
      KAFKA_CLUSTERS_0_ZOOKEEPER: zookeeper:2181
```

### Bước 2: Khởi chạy
Chạy lệnh sau trong terminal:
```bash
docker-compose -f docker-compose.kafka.yml up -d
```

### Bước 3: Kiểm tra
- **Kafka UI**: Truy cập http://localhost:8080 để xem Dashboard quản lý Topic, Messages, Consumers.
- Nếu vào được giao diện và thấy status cluster là Online nghĩa là đã thành công.

---

## 3. Tích hợp Kafka vào Backend (NestJS)

### Bước 1: Cài đặt Dependencies
Tại thư mục `backend`, chạy lệnh:
```bash
npm install --save @nestjs/microservices kafkajs
```

### Bước 2: Cấu hình Client (Producer)
Đăng ký Module trong `app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'KAFKA_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'social-backend',
            brokers: ['localhost:9092'],
          },
          consumer: {
            groupId: 'social-consumer-group',
          },
        },
      },
    ]),
  ],
})
export class AppModule {}
```

### Bước 3: Gửi tin nhắn (Producer)
Trong Service hoặc Controller:

```typescript
import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(@Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka) {}

  async onModuleInit() {
    // Đăng ký topic để client biết (bắt buộc với mô hình Request-Response)
    this.kafkaClient.subscribeToResponseOf('topic_notification');
    await this.kafkaClient.connect();
  }

  sendEvent() {
    // Gửi Event (không cần phản hồi)
    this.kafkaClient.emit('topic_notification', {
      title: 'New Message',
      content: 'Hello World',
      userId: 123
    });
  }
}
```

### Bước 4: Nhận tin nhắn (Consumer)
Để nhận tin nhắn, bạn cần cấu hình `main.ts` để ứng dụng kết nối như một Microservice Kafka:

**Trong `main.ts`:**
```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: ['localhost:9092'],
      },
      consumer: {
        groupId: 'social-consumer-group',
      },
    },
  });

  await app.startAllMicroservices();
  await app.listen(3000);
}
```

**Trong Controller:**
```typescript
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

@Controller()
export class AppController {
  
  @EventPattern('topic_notification')
  handleNotification(@Payload() message: any) {
    console.log('Kafka received:', message);
    // Xử lý message...
  }
}
```

## 4. Lưu ý quan trọng
- **Broker URL**: Khi chạy local (ngoài Docker), dùng `localhost:9092`. Nếu service backend cũng chạy trong Docker (cùng network), dùng `kafka:29092`.
- **Kafka UI**: Rất hữu ích để debug, xem tin nhắn có thực sự được đẩy vào topic hay không.
