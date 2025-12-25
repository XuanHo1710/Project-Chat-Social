import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { Account } from 'src/account/entities/account.entity';

export type PostDocument = HydratedDocument<Post>;

export enum PostPrivacy {
  PRIVATE = 'PRIVATE',
  PUBLIC = 'PUBLIC',
  FRIEND = 'FRIEND',
}

export enum MediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
}

export interface MediaItem {
  mediaType: MediaType;
  url: string;
  publicId: string; // Cloudinary public_id for deletion
  width?: number;
  height?: number;
  duration?: number; // For videos
}

@Schema({ timestamps: true })
export class Post {
  _id: mongoose.Schema.Types.ObjectId;

  @Prop({ enum: PostPrivacy, default: PostPrivacy.PUBLIC })
  privacy: PostPrivacy;

  @Prop()
  content: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Account.name, required: true })
  userId: mongoose.Schema.Types.ObjectId;

  @Prop({
    type: [
      {
        mediaType: { type: String, enum: MediaType },
        url: String,
        publicId: String,
        width: Number,
        height: Number,
        duration: Number,
      },
    ],
    default: [],
  })
  media: MediaItem[];

  @Prop({ type: String, default: null })
  background: string | null; // Background gradient/color for text-only posts

  @Prop({ type: Number, default: 0 })
  totalReacts: number;

  @Prop({ type: Number, default: 0 })
  totalComments: number;

  @Prop({ type: Number, default: 0 })
  totalShares: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  deletedAt: Date;
}

export const PostSchema = SchemaFactory.createForClass(Post);
