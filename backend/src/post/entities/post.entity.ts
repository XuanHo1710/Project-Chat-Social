import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { Account } from 'src/account/entities/account.entity';

export type PostDocument = HydratedDocument<Post>;

export enum PostPrivacy {
  PRIVATE = 'PRIVATE',
  PUBLIC = 'PUBLIC',
  FRIEND = 'FRIEND',
  GROUP = 'GROUP', // Group posts
}

export enum MediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
}

export enum PostType {
  POST = 'POST',
  LIVESTREAM = 'LIVESTREAM',
  SHARE = 'SHARE',
}

export enum LivestreamStatus {
  PREPARING = 'PREPARING',
  LIVE = 'LIVE',
  ENDED = 'ENDED',
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

  @Prop({ enum: PostType, default: PostType.POST })
  type: PostType;

  @Prop({ enum: LivestreamStatus, default: null })
  livestreamStatus: LivestreamStatus;

  @Prop()
  content: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Account.name, required: true })
  userId: mongoose.Schema.Types.ObjectId;

  // Group post reference
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null })
  groupId: mongoose.Schema.Types.ObjectId | null;

  // Anonymous post in group
  @Prop({ type: Boolean, default: false })
  isAnonymous: boolean;

  // Shared post reference
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null })
  sharedPostId: mongoose.Schema.Types.ObjectId | null;

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

  // Toggle features
  @Prop({ type: Boolean, default: true })
  allowComments: boolean;

  @Prop({ type: Boolean, default: true })
  allowShares: boolean;

  @Prop({ type: Boolean, default: true })
  allowReactions: boolean;
}

export const PostSchema = SchemaFactory.createForClass(Post);

PostSchema.index({ content: 'text' });
PostSchema.index({ isDeleted: 1, isActive: 1, privacy: 1, createdAt: -1 });
PostSchema.index({ userId: 1, isDeleted: 1, isActive: 1, createdAt: -1 });
PostSchema.index({ groupId: 1, isDeleted: 1, isActive: 1, createdAt: -1 });
PostSchema.index({ 'media.mediaType': 1, isDeleted: 1, isActive: 1, createdAt: -1 });
PostSchema.index({ type: 1, livestreamStatus: 1, isDeleted: 1 });
