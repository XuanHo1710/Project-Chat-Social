import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  FILE = 'FILE',
  SYSTEM = 'SYSTEM', // Thông báo hệ thống (vd: X đã tham gia nhóm)
  POST = 'POST', // Bài viết được chia sẻ
  STORY_REPLY = 'STORY_REPLY', // Trả lời story
  CHATBOT = 'CHATBOT', // Tin nhắn từ AI chatbot
  CALL = 'CALL', // Lịch sử cuộc gọi (audio/video)
}

export enum CallStatus {
  ANSWERED = 'ANSWERED', // Cuộc gọi đã được trả lời
  MISSED = 'MISSED', // Cuộc gọi nhỡ
  CANCELLED = 'CANCELLED', // Người gọi hủy
  ONGOING = 'ONGOING', // Đang diễn ra (group call)
}

export enum MessageStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
}

export enum EmotionType {
  LIKE = 'LIKE',
  LOVE = 'LOVE',
  FUNNY = 'FUNNY',
  SAD = 'SAD',
  ANGRY = 'ANGRY',
  WOW = 'WOW',
}

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Account', required: true })
  senderId: Types.ObjectId; // For CHATBOT type, this is the user who triggered the bot

  @Prop({ type: String, enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @Prop({ type: String, required: false, default: '', maxlength: 5000 })
  content: string; // Nội dung text hoặc URL của file/image (max 5000 chars)

  @Prop({ type: [{ userId: Types.ObjectId, emotionType: String }] })
  emotions?: [
    {
      userId: Types.ObjectId;
      emotionType: EmotionType; // Loại cảm xúc, ví dụ: 'LIKE', 'LOVE', 'FUNNY', 'SAD', 'ANGRY'
    },
  ];

  @Prop({
    type: [
      {
        url: String,
        fileName: String,
        fileSize: Number,
        mediaType: { type: String, enum: ['IMAGE', 'VIDEO', 'RAW'] },
      },
    ],
  })
  attachments?: {
    url: string;
    fileName: string;
    fileSize: number;
    mediaType: 'IMAGE' | 'VIDEO' | 'RAW';
  }[]; // Danh sách file đính kèm với metadata

  @Prop({ type: Types.ObjectId, ref: 'Message' })
  replyTo?: Types.ObjectId; // Tin nhắn được reply

  @Prop({ type: Types.ObjectId, ref: 'Post' })
  postId?: Types.ObjectId; // ID của bài viết được chia sẻ (cho type=POST)

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Post' }], default: [] })
  postIdsRecommendationfromAI?: Types.ObjectId[]; // Danh sách posts được AI gợi ý (cho type=CHATBOT)

  // Story reply data (cho type=STORY_REPLY)
  @Prop({
    type: {
      storyId: String,
      storyMediaUrl: String,
      storyOwnerId: String,
      storyOwnerName: String,
      storyCaption: String,
    },
  })
  storyReply?: {
    storyId: string;
    storyMediaUrl: string;
    storyOwnerId: string;
    storyOwnerName: string;
    storyCaption?: string;
  };

  // @Prop({ type: Object })
  // postData?: any; // Dữ liệu bài viết được cache (để hiển thị nhanh)

  // Call metadata (cho type=CALL)
  @Prop({
    type: {
      callType: { type: String, enum: ['AUDIO', 'VIDEO'] },
      callStatus: { type: String, enum: ['ANSWERED', 'MISSED', 'CANCELLED', 'ONGOING'] },
      duration: Number, // seconds
      isGroup: Boolean,
    },
  })
  callData?: {
    callType: 'AUDIO' | 'VIDEO';
    callStatus: 'ANSWERED' | 'MISSED' | 'CANCELLED' | 'ONGOING';
    duration?: number;
    isGroup?: boolean;
  };

  @Prop({ type: String, enum: MessageStatus, default: MessageStatus.SENT })
  status: MessageStatus;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  // Tự check bên backend giới hạn thời gian được phép chỉnh sửa tin nhắn (ví dụ: 15 phút)
  @Prop({ type: Boolean, default: false })
  isEdited: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Index để query nhanh
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1 });
MessageSchema.index({ conversationId: 1, status: 1 });
