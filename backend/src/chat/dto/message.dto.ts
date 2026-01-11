import { Types } from 'mongoose';
import { MessageType } from 'src/chat/entities/message.entity';

export class SendMessageDto {
  conversationId: Types.ObjectId;

  senderId: Types.ObjectId | string;

  type: MessageType;

  content: string; // Nội dung text hoặc URL của file/image (max 5000 chars)

  attachments?: {
    url: string;
    fileName: string;
    fileSize: number;
    mediaType: 'IMAGE' | 'VIDEO' | 'RAW';
  }[]; // Danh sách file đính kèm

  replyTo?: Types.ObjectId; // Tin nhắn được reply

  postId?: Types.ObjectId; // ID của bài viết được chia sẻ (cho type=POST)
}
