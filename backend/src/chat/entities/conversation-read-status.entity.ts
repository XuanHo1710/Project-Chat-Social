import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConversationReadStatusDocument = ConversationReadStatus & Document;

@Schema({ timestamps: true })
export class ConversationReadStatus {
    @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
    conversationId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Account', required: true })
    userId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Message' })
    lastReadMessageId: Types.ObjectId;

    @Prop({ type: Date, default: Date.now })
    lastReadAt: Date;
}

export const ConversationReadStatusSchema = SchemaFactory.createForClass(ConversationReadStatus);

// Index for quick lookup
ConversationReadStatusSchema.index({ conversationId: 1, userId: 1 }, { unique: true });
