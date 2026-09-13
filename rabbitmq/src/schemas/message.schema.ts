import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  FILE = 'FILE',
  SYSTEM = 'SYSTEM',
  POST = 'POST',
  STORY_REPLY = 'STORY_REPLY',
  CHATBOT = 'CHATBOT',
  CALL = 'CALL',
}

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Account' })
  senderId: Types.ObjectId;

  @Prop()
  content: string;

  @Prop({
    type: [
      { url: String, fileName: String, fileSize: Number, mediaType: String, publicId: String },
    ],
    default: [],
  })
  attachments?: Array<{
    url: string;
    fileName?: string;
    fileSize?: number;
    mediaType: 'IMAGE' | 'VIDEO' | 'RAW';
    publicId?: string;
  }>;

  @Prop({ enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Post' }], default: [] })
  postIdsRecommendationfromAI: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Message' })
  sourceMessageId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['PENDING', 'CONTENT_READY', 'COMPLETED', 'FAILED', 'DEAD'],
  })
  aiProcessingStatus?: string;

  @Prop({ type: String, maxlength: 2_000 })
  aiProcessingError?: string;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index(
  { sourceMessageId: 1 },
  { unique: true, partialFilterExpression: { sourceMessageId: { $type: 'objectId' } } }
);
