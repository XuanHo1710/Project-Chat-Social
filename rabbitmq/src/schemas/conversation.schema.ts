import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConversationDocument = Conversation & Document;

class Participant {
  @Prop({ type: Types.ObjectId, ref: 'Account' })
  user: Types.ObjectId;

  @Prop()
  kickedAt?: Date;

  @Prop()
  leftAt?: Date;
}

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ enum: ['DIRECT', 'GROUP', 'CHATBOT'], default: 'DIRECT' })
  type: string;

  @Prop({
    type: [{ user: { type: Types.ObjectId, ref: 'Account' }, kickedAt: Date, leftAt: Date }],
  })
  participants: Participant[];

  @Prop({ type: [Types.ObjectId], ref: 'Account', default: [] })
  mutedBy: Types.ObjectId[];

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Message' })
  lastMessage: Types.ObjectId;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
ConversationSchema.index({ 'participants.user': 1, isDeleted: 1 });
