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
}

@Schema({ timestamps: true })
export class Message {
    @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
    conversationId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Account' })
    senderId: Types.ObjectId;

    @Prop()
    content: string;

    @Prop({ enum: MessageType, default: MessageType.TEXT })
    type: MessageType;

    @Prop({ type: [String], default: [] })
    postIdsRecommendationfromAI: string[];

    createdAt: Date;
    updatedAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
