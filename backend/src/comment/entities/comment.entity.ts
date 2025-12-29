import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { Account } from 'src/account/entities/account.entity';
import { Post } from 'src/post/entities/post.entity';

export type CommentDocument = HydratedDocument<Comment>;

// Media schema for comments
class CommentMedia {
  @Prop({ required: true, enum: ['IMAGE', 'VIDEO'] })
  mediaType: string;

  @Prop({ required: true })
  url: string;

  @Prop()
  publicId: string;

  @Prop()
  width: number;

  @Prop()
  height: number;
}

@Schema({ timestamps: true })
export class Comment {
  _id: mongoose.Schema.Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Post.name, required: true })
  postId: mongoose.Schema.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Account.name,
    required: true,
  })
  userId: mongoose.Schema.Types.ObjectId;

  @Prop({ required: true })
  content: string;

  @Prop({ type: String, default: null })
  image: string | null; // Optional image in comment (legacy)

  @Prop({ type: [CommentMedia], default: [] })
  media: CommentMedia[]; // New media field for images/videos

  // For reply comments
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Comment.name, default: null })
  parentId: mongoose.Schema.Types.ObjectId | null;

  @Prop({ type: Number, default: 0 })
  totalReplies: number;

  @Prop({ type: Number, default: 0 })
  totalLikes: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Boolean, default: false })
  isEdited: boolean;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);
