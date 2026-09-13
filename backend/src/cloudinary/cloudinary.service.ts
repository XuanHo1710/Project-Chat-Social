import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';
import { Model, Types } from 'mongoose';
import { MediaAsset, MediaAssetDocument } from './entities/media-asset.entity';

export interface DeleteMediaDto {
  publicId: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'RAW';
}

interface UploadFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface UploadMediaResult {
  url: string;
  publicId: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'RAW';
  fileName: string;
  fileSize: number;
}

@Injectable()
export class CloudinaryService implements OnModuleInit {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(MediaAsset.name)
    private readonly mediaAssetModel: Model<MediaAssetDocument>,
  ) {}

  onModuleInit(): void {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Cloudinary credentials are not fully configured');
    }
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  }

  private resourceType(mediaType: 'IMAGE' | 'VIDEO' | 'RAW'): 'image' | 'video' | 'raw' {
    return mediaType === 'VIDEO' ? 'video' : mediaType === 'RAW' ? 'raw' : 'image';
  }

  private mediaTypeFor(file: UploadFile): 'IMAGE' | 'VIDEO' | 'RAW' {
    if (file.mimetype.startsWith('image/')) return 'IMAGE';
    if (file.mimetype.startsWith('video/')) return 'VIDEO';
    return 'RAW';
  }

  private safeFileName(fileName: string): string {
    const decoded = Buffer.from(fileName, 'latin1').toString('utf8');
    return decoded.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 255) || 'attachment';
  }

  private async destroyRemote(
    publicId: string,
    mediaType: 'IMAGE' | 'VIDEO' | 'RAW',
  ): Promise<boolean> {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: this.resourceType(mediaType),
      invalidate: true,
    });
    return result.result === 'ok' || result.result === 'not found';
  }

  async deleteMedia(
    publicId: string,
    mediaType: 'IMAGE' | 'VIDEO' | 'RAW' = 'IMAGE',
  ): Promise<boolean> {
    try {
      const deleted = await this.destroyRemote(publicId, mediaType);
      if (deleted) await this.mediaAssetModel.deleteOne({ publicId });
      return deleted;
    } catch (error: any) {
      this.logger.warn(`Failed to delete media ${publicId}: ${error?.message || 'unknown error'}`);
      return false;
    }
  }

  private async uploadRemote(
    file: UploadFile,
    mediaType: 'IMAGE' | 'VIDEO' | 'RAW',
  ): Promise<{ url: string; publicId: string }> {
    const publicId = randomUUID();
    const fileName = this.safeFileName(file.originalname);
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: this.resourceType(mediaType),
            folder: 'social_uploads',
            public_id: publicId,
            filename_override: fileName,
            use_filename: false,
          },
          (error, result) => {
            if (error) return reject(error);
            if (!result?.secure_url || !result.public_id) {
              return reject(new Error('Cloudinary returned an incomplete upload result'));
            }
            resolve({ url: result.secure_url, publicId: result.public_id });
          },
        )
        .end(file.buffer);
    });
  }

  async uploadMedia(file: UploadFile, ownerId: string): Promise<UploadMediaResult> {
    if (!Types.ObjectId.isValid(ownerId)) throw new BadRequestException('User ID không hợp lệ');
    const mediaType = this.mediaTypeFor(file);
    const fileName = this.safeFileName(file.originalname);
    const uploaded = await this.uploadRemote(file, mediaType);

    try {
      await this.mediaAssetModel.create({
        ownerId: new Types.ObjectId(ownerId),
        publicId: uploaded.publicId,
        url: uploaded.url,
        mediaType,
        fileName,
        fileSize: file.size,
      });
    } catch (error) {
      await this.destroyRemote(uploaded.publicId, mediaType).catch(() => false);
      throw error;
    }

    return { ...uploaded, mediaType, fileName, fileSize: file.size };
  }

  async uploadMultipleMedia(files: UploadFile[], ownerId: string): Promise<UploadMediaResult[]> {
    const results: UploadMediaResult[] = [];
    const concurrency = 3;
    try {
      for (let index = 0; index < files.length; index += concurrency) {
        const batch = files.slice(index, index + concurrency);
        results.push(...(await Promise.all(batch.map((file) => this.uploadMedia(file, ownerId)))));
      }
      return results;
    } catch (error) {
      await this.deleteMultipleMedia(
        results.map(({ publicId, mediaType }) => ({ publicId, mediaType })),
      );
      throw error;
    }
  }

  async deleteOwnedMedia(
    ownerId: string,
    mediaItems: DeleteMediaDto[],
  ): Promise<{ publicId: string; success: boolean }[]> {
    if (!Types.ObjectId.isValid(ownerId)) throw new BadRequestException('User ID không hợp lệ');
    const uniqueItems = [...new Map(mediaItems.map((item) => [item.publicId, item])).values()];
    const assets = await this.mediaAssetModel
      .find({
        ownerId: new Types.ObjectId(ownerId),
        publicId: { $in: uniqueItems.map((item) => item.publicId) },
      })
      .select('publicId mediaType')
      .lean();
    const ownedByPublicId = new Map(assets.map((asset) => [asset.publicId, asset]));

    return Promise.all(
      uniqueItems.map(async (item) => {
        const asset = ownedByPublicId.get(item.publicId);
        if (!asset || asset.mediaType !== item.mediaType) {
          return { publicId: item.publicId, success: false };
        }
        return { publicId: item.publicId, success: await this.deleteMedia(item.publicId, item.mediaType) };
      }),
    );
  }

  async assertOwnedMedia(
    ownerId: string,
    mediaItems: Array<{
      publicId?: string;
      url?: string;
      mediaType?: 'IMAGE' | 'VIDEO' | 'RAW';
    }>,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(ownerId)) throw new BadRequestException('User ID không hợp lệ');
    if (mediaItems.length === 0) return;
    if (mediaItems.some((item) => !item.publicId)) {
      throw new BadRequestException('Uploaded media is missing its public ID');
    }

    const uniquePublicIds = [...new Set(mediaItems.map((item) => item.publicId!))];
    const assets = await this.mediaAssetModel
      .find({
        ownerId: new Types.ObjectId(ownerId),
        publicId: { $in: uniquePublicIds },
      })
      .select('publicId url mediaType')
      .lean();
    const assetMap = new Map(assets.map((asset) => [asset.publicId, asset]));
    const isValid = mediaItems.every((item) => {
      const asset = assetMap.get(item.publicId!);
      return (
        !!asset &&
        (!item.url || asset.url === item.url) &&
        (!item.mediaType || asset.mediaType === item.mediaType)
      );
    });

    if (!isValid || assets.length !== uniquePublicIds.length) {
      throw new BadRequestException('One or more media assets are invalid or not owned by this user');
    }
  }

  async deleteMultipleMedia(
    mediaItems: DeleteMediaDto[],
  ): Promise<{ publicId: string; success: boolean }[]> {
    const uniqueItems = [...new Map(mediaItems.map((item) => [item.publicId, item])).values()];
    return Promise.all(
      uniqueItems.map(async (item) => ({
        publicId: item.publicId,
        success: await this.deleteMedia(item.publicId, item.mediaType),
      })),
    );
  }

  async bulkDelete(publicIds: string[], resourceType: 'image' | 'video' = 'image'): Promise<any> {
    const uniqueIds = [...new Set(publicIds)].slice(0, 100);
    if (uniqueIds.length === 0) return { deleted: {} };
    const result = await cloudinary.api.delete_resources(uniqueIds, { resource_type: resourceType });
    await this.mediaAssetModel.deleteMany({ publicId: { $in: uniqueIds } });
    return result;
  }
}
