import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Types, HydratedDocument } from 'mongoose';
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

  @Prop({ type: String, select: false })
  pairKey?: string;

  @Prop({
    type: { isBlocked: Boolean, blockedAt: Date, userBlockedId: Types.ObjectId },
    default: { isBlocked: false, blockedAt: null, userBlockedId: null },
  })
  block: {
    isBlocked: boolean;
    blockedAt: Date | null;
    userBlockedId: Types.ObjectId | null;
  }; // Block thằng bạn

  @Prop({
    type: {
      isRestricted: Boolean,
      restrictedAt: Date || null,
      userRestrictedId: Types.ObjectId || null,
    },
    default: { isRestricted: false, restrictedAt: null, userRestrictedId: null },
  })
  restrict: {
    isRestricted: boolean;
    restrictedAt: Date | null;
    userRestrictedId: Types.ObjectId | null;
  }; // Restrict (hạn chế) - ẩn conversation nhưng vẫn là bạn bè

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

RelationshipSchema.pre('validate', function setPairKey() {
  if (this.userId && this.friendId) {
    this.pairKey = [this.userId.toString(), this.friendId.toString()].sort().join(':');
  }
});

RelationshipSchema.index({ userId: 1, friendId: 1 }, { unique: true });
RelationshipSchema.index(
  { pairKey: 1 },
  { unique: true, partialFilterExpression: { pairKey: { $type: 'string' } } },
);
RelationshipSchema.index({ userId: 1, status: 1, sendRequestAt: -1 });
RelationshipSchema.index({ friendId: 1, status: 1, sendRequestAt: -1 });
RelationshipSchema.index({ 'block.userBlockedId': 1, status: 1 });
RelationshipSchema.index({ 'restrict.userRestrictedId': 1, 'restrict.isRestricted': 1 });
