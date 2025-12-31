import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

export interface DeleteMediaDto {
  publicId: string;
  mediaType: 'IMAGE' | 'VIDEO';
}

@Injectable()
export class CloudinaryService implements OnModuleInit {
  constructor(private configService: ConfigService) { }

  onModuleInit() {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  /**
   * Delete a single media file from Cloudinary
   */
  async deleteMedia(publicId: string, mediaType: 'IMAGE' | 'VIDEO' = 'IMAGE'): Promise<boolean> {
    try {
      const resourceType = mediaType === 'VIDEO' ? 'video' : 'image';
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
      return result.result === 'ok';
    } catch (error) {
      console.error(`Failed to delete media ${publicId}:`, error);
      return false;
    }
  }

  /**
   * Upload a single media file to Cloudinary
   */
  async uploadMedia(
    fileBuffer: Buffer,
    filename: string,
    mediaType: 'IMAGE' | 'VIDEO' = 'IMAGE'
  ): Promise<{ url: string; publicId: string }> {
    const resourceType = mediaType === 'VIDEO' ? 'video' : 'image';

    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: resourceType,
          folder: 'chat_attachments',
          public_id: `${Date.now()}_${filename.replace(/\.[^/.]+$/, '')}`,
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else if (result) {
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
            });
          }
        }
      ).end(fileBuffer);
    });
  }

  /**
   * Upload multiple media files to Cloudinary
   */
  async uploadMultipleMedia(
    files: { buffer: Buffer; originalname: string; mimetype: string }[]
  ): Promise<{ url: string; publicId: string; mediaType: 'IMAGE' | 'VIDEO' }[]> {
    const uploadPromises = files.map(async (file) => {
      const mediaType: 'IMAGE' | 'VIDEO' = file.mimetype.startsWith('video/') ? 'VIDEO' : 'IMAGE';
      const result = await this.uploadMedia(file.buffer, file.originalname, mediaType);
      return { ...result, mediaType };
    });

    return Promise.all(uploadPromises);
  }

  /**
   * Delete multiple media files from Cloudinary
   * Uses parallel processing for better performance
   */
  async deleteMultipleMedia(
    mediaItems: DeleteMediaDto[]
  ): Promise<{ publicId: string; success: boolean }[]> {
    const deletePromises = mediaItems.map(async (item) => {
      const success = await this.deleteMedia(item.publicId, item.mediaType);
      return { publicId: item.publicId, success };
    });

    return Promise.all(deletePromises);
  }

  /**
   * Delete all media by public IDs (for cleanup operations)
   */
  async bulkDelete(publicIds: string[], resourceType: 'image' | 'video' = 'image'): Promise<any> {
    try {
      const result = await cloudinary.api.delete_resources(publicIds, {
        resource_type: resourceType,
      });
      return result;
    } catch (error) {
      console.error('Bulk delete failed:', error);
      throw error;
    }
  }
}
