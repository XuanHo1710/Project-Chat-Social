import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { Account } from 'src/account/entities/account.entity';

export type ReactionDocument = HydratedDocument<Reaction>;

export enum ReactionType {
  LIKE = 'LIKE',
  LOVE = 'LOVE',
  HAHA = 'HAHA',
  WOW = 'WOW',
  SAD = 'SAD',
  ANGRY = 'ANGRY',
}

export enum TypeFactor {
  POST = 'POST',
  COMMENT = 'COMMENT',
  MESSAGE = 'MESSAGE'
}

@Schema({ timestamps: true })
export class Reaction {
  _id: mongoose.Schema.Types.ObjectId;

  // Generic reference ID - can be postId, commentId, or messageId
  @Prop({ type: mongoose.Schema.Types.ObjectId, required: true })
  factorId: mongoose.Schema.Types.ObjectId;

  // Type of the factor - POST, COMMENT, or MESSAGE
  @Prop({ enum: TypeFactor, required: true })
  typeFactor: TypeFactor;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Account.name,
    required: true,
  })
  userId: mongoose.Schema.Types.ObjectId;

  @Prop({ enum: ReactionType, required: true })
  type: ReactionType;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const ReactionSchema = SchemaFactory.createForClass(Reaction);

// Compound index to ensure one reaction per user per factor (post/comment/message)
ReactionSchema.index({ factorId: 1, typeFactor: 1, userId: 1 }, { unique: true });
