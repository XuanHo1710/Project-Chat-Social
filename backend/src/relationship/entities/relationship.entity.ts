import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { Account } from 'src/account/entities/account.entity';
export type RelationshipDocument = HydratedDocument<Relationship>;

export enum RelationshipStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  BLOCKED = 'BLOCKED',
  REJECTED = 'REJECTED',
  CANCELED = 'CANCELED',
}

@Schema({ timestamps: true })
export class Relationship {
  _id: mongoose.Schema.Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Account.name, required: true })
  userId: mongoose.Schema.Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Account.name, required: true })
  friendId: mongoose.Schema.Types.ObjectId;

  @Prop({ type: String, enum: RelationshipStatus, default: RelationshipStatus.PENDING })
  status: RelationshipStatus; // PENDING, ACCEPTED, BLOCKED, REJECTED

  @Prop({
    type: { isBlocked: Boolean, blockedAt: Date, userBlockedId: mongoose.Schema.Types.ObjectId },
    default: { isBlocked: false, blockedAt: null, userBlockedId: null },
  })
  block: {
    isBlocked: boolean;
    blockedAt: Date;
    userBlockedId: mongoose.Schema.Types.ObjectId;
  }; // Block thằng bạn

  // Ngày gửi lời mời kết bạn
  @Prop()
  sendRequestAt: Date;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;

  @Prop()
  deletedAt: Date;
}

export const RelationshipSchema = SchemaFactory.createForClass(Relationship);
