import { Types } from 'mongoose';
import { MessageType } from 'src/chat/entities/message.entity';

export class CreateMessageDto {
  conversationId: Types.ObjectId;

  senderId: Types.ObjectId; // For CHATBOT type, use trigger user's ID

  type: MessageType;

  content?: string; // Nội dung text hoặc URL của file/image (max 5000 chars)

  attachments?: {
    url: string;
    fileName: string;
    fileSize: number;
    mediaType: 'IMAGE' | 'VIDEO' | 'RAW';
  }[]; // Danh sách file đính kèm

  replyTo?: Types.ObjectId; // Tin nhắn được reply

  postId?: Types.ObjectId; // ID của bài viết được chia sẻ (cho type=POST)

  postIdsRecommendationfromAI?: string[]; // Danh sách post IDs được AI gợi ý (cho type=CHATBOT)

  callData?: {
    callType: 'AUDIO' | 'VIDEO';
    callStatus: 'ANSWERED' | 'MISSED' | 'CANCELLED' | 'ONGOING';
    duration?: number;
    isGroup?: boolean;
  }; // Dữ liệu cuộc gọi (cho type=CALL)

  // Story reply data (cho type=STORY_REPLY)
  storyReply?: {
    storyId: string;
    storyMediaUrl: string;
    storyOwnerId: string;
    storyOwnerName: string;
    storyCaption?: string;
  };
}
