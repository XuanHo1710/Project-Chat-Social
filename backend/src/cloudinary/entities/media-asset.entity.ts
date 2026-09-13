import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Account } from 'src/account/entities/account.entity';

export type MediaAssetDocument = HydratedDocument<MediaAsset>;

@Schema({ timestamps: true })
export class MediaAsset {
  @Prop({ type: Types.ObjectId, ref: Account.name, required: true, index: true })
  ownerId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  publicId: string;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true, enum: ['IMAGE', 'VIDEO', 'RAW'] })
  mediaType: 'IMAGE' | 'VIDEO' | 'RAW';

  @Prop({ required: true, maxlength: 255 })
  fileName: string;

  @Prop({ required: true, min: 0 })
  fileSize: number;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const MediaAssetSchema = SchemaFactory.createForClass(MediaAsset);
MediaAssetSchema.index({ ownerId: 1, createdAt: -1 });
