# Hướng dẫn thiết lập RabbitMQ cho Project Chat Social

## 1. Giới thiệu
RabbitMQ là một message broker mạnh mẽ, giúp xử lý các tác vụ bất đồng bộ (asynchronous), hàng đợi (queues) và giao tiếp giữa các thành phần trong hệ thống. Trong dự án Chat Social, RabbitMQ có thể được sử dụng để:
- Xử lý thông báo (Notifications) background.
- Xử lý gửi email/SMS queues.
- Chat queue để đảm bảo tin nhắn không bị mất khi tải cao.

## 2. Cài đặt RabbitMQ Server

Có hai cách phổ biến để cài đặt RabbitMQ trên Windows:

### Cách 1: Sử dụng Docker (Khuyên dùng)
Cách này nhanh chóng, sạch sẽ và dễ quản lý phiên bản.

1.  **Yêu cầu**: Đã cài đặt Docker Desktop.
2.  **Thực hiện**:
    Bạn có thể chạy câu lệnh sau trong terminal (PowerShell/CMD):
    ```bash
    docker run -d --hostname my-rabbit --name social-rabbitmq -p 15672:15672 -p 5672:5672 -e RABBITMQ_DEFAULT_USER=user -e RABBITMQ_DEFAULT_PASS=password rabbitmq:3-management
    ```

    Hoặc tạo file `docker-compose.yml` tại thư mục gốc dự án:
    ```yaml
    version: '3.8'
    services:
      rabbitmq:
        image: rabbitmq:3-management
        container_name: social-rabbitmq
        ports:
          - "5672:5672" # Port chính AMQP
          - "15672:15672" # Port Management UI
        environment:
          RABBITMQ_DEFAULT_USER: user
          RABBITMQ_DEFAULT_PASS: password
        volumes:
          - rabbitmq_data:/var/lib/rabbitmq
        networks:
          - social-network

    volumes:
      rabbitmq_data:

    networks:
      social-network:
        driver: bridge
    ```
    Sau đó chạy: `docker-compose up -d`

3.  **Kiểm tra**:
    - Truy cập: http://localhost:15672
    - Đăng nhập: `user` / `password`

### Cách 2: Cài đặt trực tiếp trên Windows (Installer)
1.  **Cài đặt Erlang**: RabbitMQ chạy trên nền tảng Erlang/OTP. Tải và cài đặt Erlang for Windows từ trang chủ.
2.  **Cài đặt RabbitMQ**: Tải RabbitMQ Installer và cài đặt.
3.  **Kích hoạt Plugin Management**:
    - Mở `RabbitMQ Command Prompt (sbin)` (Tìm trong Start Menu).
    - Chạy lệnh:
      ```cmd
      rabbitmq-plugins enable rabbitmq_management
      ```
    - Khởi động lại service (nếu cần).
4.  Truy cập vào http://localhost:15672 (Mặc định: `guest`/`guest`).

---

## 3. Tích hợp RabbitMQ vào Backend (NestJS)

### Bước 1: Cài đặt Dependencies
Tại thư mục `backend`, chạy lệnh:
```bash
npm install --save @nestjs/microservices amqplib amqp-connection-manager
```

### Bước 2: Cấu hình biến môi trường
Thêm vào file `backend/.env`:
```env
RABBITMQ_USER=user
RABBITMQ_PASS=password
RABBITMQ_HOST=localhost
RABBITMQ_QUEUE_NAME=social_queue
RABBITMQ_URL=amqp://user:password@localhost:5672
```

### Bước 3: Đăng ký Module trong NestJS

**Cách 1: Sử dụng như một Microservice (Hybrid App)**
Trong `main.ts`:
```typescript
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Kết nối RabbitMQ microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: ['amqp://user:password@localhost:5672'],
      queue: 'social_queue',
      queueOptions: {
        durable: false
      },
    },
  });

  await app.startAllMicroservices();
  await app.listen(3000);
}
bootstrap();
```

**Cách 2: Sử dụng ClientsModule để gửi message (Producer)**
Trong `app.module.ts` (hoặc module cần dùng):
```typescript
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'SOCIAL_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://user:password@localhost:5672'],
          queue: 'social_queue',
          queueOptions: {
            durable: false
          },
        },
      },
    ]),
  ],
})
export class AppModule {}
```

### Bước 4: Gửi tin nhắn (Producer)
Trong Service hoặc Controller:
```typescript
import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class AppService {
  constructor(@Inject('SOCIAL_SERVICE') private client: ClientProxy) {}

  sendNotification(data: any) {
    // Gửi pattern 'notification_created' với data
    this.client.emit('notification_created', data);
  }
}
```

### Bước 5: Nhận tin nhắn (Consumer)
Trong Controller:
```typescript
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

@Controller()
export class AppController {
  
  @EventPattern('notification_created')
  async handleNotificationCreated(@Payload() data: any) {
    console.log('Received notification data:', data);
    // Xử lý logic background (gửi email, push noti...)
  }
}
```

## 4. Kiểm tra
1.  Đảm bảo RabbitMQ Server đang chạy.
2.  Chạy backend NestJS: `npm run start:dev`.
3.  Gọi API kích hoạt hàm `sendNotification`.
4.  Kiểm tra logs của backend để xem message đã nhận được chưa.
