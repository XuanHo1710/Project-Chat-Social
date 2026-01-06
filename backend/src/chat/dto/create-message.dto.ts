import { Types } from 'mongoose';
import { MessageType } from 'src/chat/entities/message.entity';

export class CreateMessageDto {
  conversationId: Types.ObjectId;

  senderId: Types.ObjectId;

  type: MessageType;

  content?: string; // Nội dung text hoặc URL của file/image (max 5000 chars)

  attachments?: string[]; // Danh sách file đính kèm

  replyTo?: Types.ObjectId; // Tin nhắn được reply

  postId?: Types.ObjectId; // ID của bài viết được chia sẻ (cho type=POST)

  // Story reply data (cho type=STORY_REPLY)
  storyReply?: {
    storyId: string;
    storyMediaUrl: string;
    storyOwnerId: string;
    storyOwnerName: string;
    storyCaption?: string;
  };
}
