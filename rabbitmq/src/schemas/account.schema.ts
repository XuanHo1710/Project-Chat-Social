import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AccountDocument = Account & Document;

@Schema({ timestamps: true })
export class Account {
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop()
  avatar: string;

  @Prop()
  username: string;

  @Prop({ type: [String], default: [] })
  fcmTokens: string[];

  @Prop({ default: 'ACTIVE' })
  status: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: false })
  isBlocked: boolean;

  @Prop({ default: 'USER' })
  role: string;

  @Prop()
  lastActive: Date;

  @Prop()
  lastLogin: Date;
}

export const AccountSchema = SchemaFactory.createForClass(Account);
