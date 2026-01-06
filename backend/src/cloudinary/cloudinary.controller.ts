import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CloudinaryService, DeleteMediaDto } from './cloudinary.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

class DeleteMediaRequestDto {
  media: DeleteMediaDto[];
}

@Controller('cloudinary')
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  /**
   * Upload multiple media files to Cloudinary
   * Protected route - requires authentication
   */
  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadMedia(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      return { success: false, error: 'No files provided', results: [] };
    }

    try {
      const results = await this.cloudinaryService.uploadMultipleMedia(files);
      return {
        success: true,
        message: `Successfully uploaded ${results.length} files`,
        results,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Upload failed',
        results: [],
      };
    }
  }

  /**
   * Delete multiple media files from Cloudinary
   * Protected route - requires authentication
   */
  @Post('delete')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteMedia(@Body() body: DeleteMediaRequestDto) {
    if (!body.media || body.media.length === 0) {
      return { success: true, results: [] };
    }

    const results = await this.cloudinaryService.deleteMultipleMedia(body.media);

    const allSuccess = results.every((r) => r.success);
    const failedCount = results.filter((r) => !r.success).length;

    return {
      success: allSuccess,
      message: allSuccess
        ? `Successfully deleted ${results.length} media files`
        : `Deleted ${results.length - failedCount} files, ${failedCount} failed`,
      results,
    };
  }
}
