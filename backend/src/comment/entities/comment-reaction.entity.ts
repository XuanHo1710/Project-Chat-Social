import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { Account } from 'src/account/entities/account.entity';
import { Comment } from './comment.entity';

export type CommentReactionDocument = HydratedDocument<CommentReaction>;

export enum CommentReactionType {
  LIKE = 'LIKE',
  LOVE = 'LOVE',
  HAHA = 'HAHA',
  WOW = 'WOW',
  SAD = 'SAD',
  ANGRY = 'ANGRY',
}

@Schema({ timestamps: true })
export class CommentReaction {
  _id: mongoose.Schema.Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Comment.name, required: true })
  commentId: mongoose.Schema.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Account.name,
    required: true,
  })
  userId: mongoose.Schema.Types.ObjectId;

  @Prop({ enum: CommentReactionType, required: true })
  type: CommentReactionType;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const CommentReactionSchema = SchemaFactory.createForClass(CommentReaction);

// Compound index to ensure one reaction per user per comment
CommentReactionSchema.index({ commentId: 1, userId: 1 }, { unique: true });
