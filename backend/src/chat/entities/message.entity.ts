import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Account } from 'src/account/entities/account.entity';

export type MessageDocument = Message & Document;

export enum MessageType {
    TEXT = 'TEXT',
    IMAGE = 'IMAGE',
    VIDEO = 'VIDEO',
    FILE = 'FILE',
    SYSTEM = 'SYSTEM', // Thông báo hệ thống (vd: X đã tham gia nhóm)
    POST = 'POST', // Bài viết được chia sẻ
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
}

@Schema({ timestamps: true })
export class Message {
    @Prop({ type: Types.ObjectId, ref: "Conversation", required: true })
    conversationId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: "Account", required: true })
    senderId: Types.ObjectId;

    @Prop({ type: String, enum: MessageType, default: MessageType.TEXT })
    type: MessageType;

    @Prop({ type: String, required: true, maxlength: 5000 })
    content: string; // Nội dung text hoặc URL của file/image (max 5000 chars)

    @Prop({ type: { userId: Types.ObjectId, emotionType: String } })
    emotions?: {
        userId: Types.ObjectId;
        emotionType: EmotionType; // Loại cảm xúc, ví dụ: 'LIKE', 'LOVE', 'FUNNY', 'SAD', 'ANGRY'
    }

    @Prop({ type: [String] })
    attachments?: string[]; // Danh sách file đính kèm

    @Prop({ type: Types.ObjectId, ref: "Message" })
    replyTo?: Types.ObjectId; // Tin nhắn được reply

    @Prop({ type: Types.ObjectId, ref: 'Post' })
    postId?: Types.ObjectId; // ID của bài viết được chia sẻ (cho type=POST)

    // @Prop({ type: Object })
    // postData?: any; // Dữ liệu bài viết được cache (để hiển thị nhanh)

    @Prop({ type: String, enum: MessageStatus, default: MessageStatus.SENT })
    status: MessageStatus;

    @Prop({ type: [{ type: Types.ObjectId, ref: Account.name }], default: [] })
    readBy: Types.ObjectId[]; // Danh sách user đã đọc

    @Prop({ type: Date, default: Date.now })
    createdAt: Date;

    @Prop({ type: Boolean, default: false })
    isDeleted: boolean;

    @Prop({ type: Date })
    deletedAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Index để query nhanh
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1 });
MessageSchema.index({ conversationId: 1, status: 1 });
