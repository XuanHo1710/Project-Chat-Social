import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FirebaseService implements OnModuleInit {
  constructor(private configService: ConfigService) {}
  onModuleInit() {
    // Kiểm tra xem app đã khởi tạo chưa để tránh lỗi
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: this.configService.get<string>('FIREBASE_PROJECT_ID'),
          clientEmail: this.configService.get<string>('FIREBASE_CLIENT_EMAIL'),
          privateKey: this.configService.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
        }),
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

      const response = await admin.messaging().sendMulticast(message);
      console.log('Successfully sent message:', response);

      // Có thể xử lý xóa các token lỗi (invalid/expired) tại đây dựa trên response.responses
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }
}
