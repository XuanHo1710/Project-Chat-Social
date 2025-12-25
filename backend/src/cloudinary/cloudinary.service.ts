import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

export interface DeleteMediaDto {
  publicId: string;
  mediaType: 'IMAGE' | 'VIDEO';
}

@Injectable()
export class CloudinaryService implements OnModuleInit {
  constructor(private configService: ConfigService) {}

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
