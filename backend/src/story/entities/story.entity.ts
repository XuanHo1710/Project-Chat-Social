import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StoryDocument = Story & Document;

export enum StoryType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
}

export enum StoryPrivacy {
  PUBLIC = 'PUBLIC',
  FRIENDS = 'FRIENDS',
  PRIVATE = 'PRIVATE',
  CUSTOM = 'CUSTOM',
}

@Schema({ timestamps: true })
export class Story {
  @Prop({ type: Types.ObjectId, ref: 'Account', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: StoryType, required: true })
  type: StoryType;

  @Prop({ type: String, required: true })
  mediaUrl: string; // URL của ảnh/video

  @Prop({ type: String })
  thumbnail?: string; // Thumbnail cho video

  @Prop({ type: String, required: true, maxlength: 512 })
  mediaPublicId: string;

  @Prop({ type: String, maxlength: 512 })
  thumbnailPublicId?: string;

  @Prop({ type: Number })
  duration?: number; // Thời lượng video (giây), max 15s

  @Prop({ type: String, maxlength: 500 })
  caption?: string; // Caption/text overlay

  @Prop({
    type: {
      x: Number,
      y: Number,
      fontSize: Number,
      color: String,
      backgroundColor: String,
    },
  })
  captionStyle?: {
    x: number;
    y: number;
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
  };

  @Prop({ type: String, enum: StoryPrivacy, default: StoryPrivacy.FRIENDS })
  privacy: StoryPrivacy;

  @Prop({
    type: [
      {
        userId: { type: Types.ObjectId, ref: 'Account' },
        viewedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  viewers: {
    userId: Types.ObjectId;
    viewedAt: Date;
  }[];

  @Prop({
    type: [
      {
        userId: { type: Types.ObjectId, ref: 'Account' },
        reaction: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  reactions: {
    userId: Types.ObjectId;
    reaction: string; // emoji reaction
    createdAt: Date;
  }[];

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date })
  expiresAt?: Date; // Story hết hạn sau 24h

  @Prop({ type: Boolean, default: false })
  isArchived: boolean;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;
}

export const StorySchema = SchemaFactory.createForClass(Story);

// Auto-set expiresAt to 24 hours from creation.
// Archived stories must not be TTL-deleted: clearing expiresAt removes them
// from the TTL index scope (MongoDB TTL skips docs where the indexed field is
// absent), so archives persist while live stories keep the +24h expiry.
StorySchema.pre('save', function (next) {
  if (this.isArchived === true) {
    this.expiresAt = undefined;
    return next();
  }
  if (!this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  next();
});

// Indexes
StorySchema.index({ userId: 1, createdAt: -1 });
StorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index - auto delete expired
StorySchema.index({ privacy: 1 });
StorySchema.index({ userId: 1, isDeleted: 1, expiresAt: 1, createdAt: -1 });
StorySchema.index({ privacy: 1, isDeleted: 1, expiresAt: 1, createdAt: -1 });
StorySchema.index({ mediaPublicId: 1 });
