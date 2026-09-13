import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserRestrictionDocument = HydratedDocument<UserRestriction>;

@Schema({ timestamps: true })
export class UserRestriction {
  @Prop({ type: Types.ObjectId, ref: 'Account', required: true })
  restrictorId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Account', required: true })
  restrictedId: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserRestrictionSchema = SchemaFactory.createForClass(UserRestriction);
UserRestrictionSchema.index({ restrictorId: 1, restrictedId: 1 }, { unique: true });
UserRestrictionSchema.index({ restrictedId: 1, restrictorId: 1 });
