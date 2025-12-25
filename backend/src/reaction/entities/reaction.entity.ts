import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { Account } from 'src/account/entities/account.entity';
import { Post } from 'src/post/entities/post.entity';

export type ReactionDocument = HydratedDocument<Reaction>;

export enum ReactionType {
  LIKE = 'LIKE',
  LOVE = 'LOVE',
  HAHA = 'HAHA',
  WOW = 'WOW',
  SAD = 'SAD',
  ANGRY = 'ANGRY',
}

@Schema({ timestamps: true })
export class Reaction {
  _id: mongoose.Schema.Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Post.name, required: true })
  postId: mongoose.Schema.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Account.name,
    required: true,
    autopopulate: true,
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

// Compound index to ensure one reaction per user per post
ReactionSchema.index({ postId: 1, userId: 1 }, { unique: true });
