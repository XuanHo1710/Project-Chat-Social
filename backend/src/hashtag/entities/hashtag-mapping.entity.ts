import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Hashtag } from './hashtag.entity';

export type HashtagMappingDocument = HydratedDocument<HashtagMapping>;

/**
 * Entity types that can have hashtags
 */
export enum HashtagEntityType {
    POST = 'POST',
    COMMENT = 'COMMENT',
    // Future: STORY, VIDEO, REEL, STATUS, BIO
}

/**
 * Bảng liên kết N-N giữa Hashtag và Entity (Post/Comment)
 * - Flexible design using entity_type để mở rộng cho story, video, reel, status, bio
 * - Indexes cho fast query cả 2 chiều
 */
@Schema({ timestamps: true })
export class HashtagMapping {
    _id: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: Hashtag.name, required: true, index: true })
    hashtagId: Types.ObjectId;

    // The entity (post, comment, etc.) that contains this hashtag
    @Prop({ type: Types.ObjectId, required: true, index: true })
    entityId: Types.ObjectId;

    // Type of entity for polymorphic relationship
    @Prop({ type: String, enum: HashtagEntityType, required: true, index: true })
    entityType: HashtagEntityType;

    @Prop()
    createdAt: Date;
}

export const HashtagMappingSchema = SchemaFactory.createForClass(HashtagMapping);

// Unique compound index to prevent duplicate mappings
HashtagMappingSchema.index({ hashtagId: 1, entityId: 1, entityType: 1 }, { unique: true });

// Index for finding all hashtags of an entity
HashtagMappingSchema.index({ entityId: 1, entityType: 1 });

// Index for finding all entities with a hashtag
HashtagMappingSchema.index({ hashtagId: 1, entityType: 1 });
HashtagMappingSchema.index({ entityType: 1, createdAt: -1, hashtagId: 1 });
HashtagMappingSchema.index({ hashtagId: 1, entityType: 1, createdAt: -1 });
