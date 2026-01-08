import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';
import { Account } from 'src/account/entities/account.entity';
import { Group } from './group.entity';

export type GroupMemberDocument = HydratedDocument<GroupMember>;

export enum GroupRole {
  ADMIN = 'ADMIN', // Full control
  MODERATOR = 'MODERATOR', // Can manage posts and members
  MEMBER = 'MEMBER', // Regular member
}

export enum MemberStatus {
  PENDING = 'PENDING', // Waiting for approval (private groups)
  APPROVED = 'APPROVED', // Active member
  BANNED = 'BANNED', // Banned from group
}

@Schema({ timestamps: true })
export class GroupMember {
  _id: mongoose.Schema.Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Group.name, required: true })
  groupId: mongoose.Schema.Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Account.name, required: true })
  userId: mongoose.Schema.Types.ObjectId;

  @Prop({ enum: GroupRole, default: GroupRole.MEMBER })
  role: GroupRole;

  @Prop({ enum: MemberStatus, default: MemberStatus.APPROVED })
  status: MemberStatus;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Account.name, default: null })
  invitedBy: mongoose.Schema.Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Account.name, default: null })
  approvedBy: Types.ObjectId;

  @Prop()
  joinedAt: Date;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const GroupMemberSchema = SchemaFactory.createForClass(GroupMember);

// Indexes
GroupMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true });
GroupMemberSchema.index({ groupId: 1, status: 1 });
GroupMemberSchema.index({ groupId: 1, role: 1 });
GroupMemberSchema.index({ userId: 1 });
