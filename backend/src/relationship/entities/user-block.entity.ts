import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Account } from 'src/account/entities/account.entity';

export type UserBlockDocument = HydratedDocument<UserBlock>;

@Schema({ timestamps: true })
export class UserBlock {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Account.name, required: true })
  blockerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Account.name, required: true })
  blockedId: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export const UserBlockSchema = SchemaFactory.createForClass(UserBlock);
UserBlockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });
UserBlockSchema.index({ blockedId: 1, blockerId: 1 });
