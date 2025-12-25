import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { CloudinaryService, DeleteMediaDto } from './cloudinary.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

class DeleteMediaRequestDto {
  media: DeleteMediaDto[];
}

@Controller('cloudinary')
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

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
