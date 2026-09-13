import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Account } from 'src/account/entities/account.entity';

export type GroupDocument = HydratedDocument<Group>;

export enum GroupPrivacy {
  PUBLIC = 'PUBLIC', // Anyone can see posts, anyone can join
  PRIVATE = 'PRIVATE', // Only members can see posts, need approval to join
}

export enum GroupVisibility {
  VISIBLE = 'VISIBLE', // Anyone can find the group
  HIDDEN = 'HIDDEN', // Only members can find
}

@Schema({ timestamps: true })
export class Group {
  _id: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: null })
  avatar: string;

  @Prop({ default: null })
  coverImage: string;

  @Prop({ enum: GroupPrivacy, default: GroupPrivacy.PUBLIC })
  privacy: GroupPrivacy;

  @Prop({ enum: GroupVisibility, default: GroupVisibility.VISIBLE })
  visibility: GroupVisibility;

  @Prop({ default: null })
  location: string;

  @Prop({ type: Types.ObjectId, ref: Account.name, required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Number, default: 0 })
  memberCount: number;

  @Prop({ type: Number, default: 0 })
  postCount: number;

  @Prop({ type: [String], default: [] })
  rules: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const GroupSchema = SchemaFactory.createForClass(Group);

// Indexes
GroupSchema.index({ name: 'text', description: 'text' });
GroupSchema.index({ createdBy: 1 });
GroupSchema.index({ privacy: 1, visibility: 1 });
GroupSchema.index({ isActive: 1, visibility: 1, memberCount: -1 });
GroupSchema.index({ isActive: 1, privacy: 1, memberCount: -1 });
