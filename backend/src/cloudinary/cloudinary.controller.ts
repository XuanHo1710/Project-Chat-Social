import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  PayloadTooLargeException,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UserInfo } from 'decorators/customize';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CloudinaryService } from './cloudinary.service';

class DeleteMediaItemDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9/_-]{1,200}$/)
  publicId: string;

  @IsEnum(['IMAGE', 'VIDEO', 'RAW'])
  mediaType: 'IMAGE' | 'VIDEO' | 'RAW';
}

class DeleteMediaRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DeleteMediaItemDto)
  media: DeleteMediaItemDto[];
}

@Controller('cloudinary')
@UseGuards(JwtAuthGuard)
export class CloudinaryController {
  private static readonly CHAT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
  private static readonly GENERAL_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
  private static readonly GENERAL_MAX_TOTAL_BYTES = 100 * 1024 * 1024;
  private static readonly ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ]);

  constructor(private readonly cloudinaryService: CloudinaryService) {}

  private static fileFilter(
    _request: unknown,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ): void {
    if (!CloudinaryController.ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      return callback(new BadRequestException(`Unsupported file type: ${file.mimetype}`), false);
    }
    callback(null, true);
  }

  private validateFiles(files: Express.Multer.File[]): void {
    if (!files?.length) throw new BadRequestException('No files provided');
    const totalBytes = files.reduce((total, file) => total + file.size, 0);
    if (totalBytes > CloudinaryController.GENERAL_MAX_TOTAL_BYTES) {
      throw new PayloadTooLargeException('Combined upload size exceeds 100 MB');
    }
  }

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: {
        files: 10,
        fileSize: CloudinaryController.GENERAL_MAX_FILE_SIZE_BYTES,
      },
      fileFilter: CloudinaryController.fileFilter,
    }),
  )
  async uploadMedia(@UserInfo() user: any, @UploadedFiles() files: Express.Multer.File[]) {
    this.validateFiles(files);
    const results = await this.cloudinaryService.uploadMultipleMedia(files, user._id);
    return { success: true, message: `Successfully uploaded ${results.length} files`, results };
  }

  @Post('upload/chat')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: {
        files: 10,
        fileSize: CloudinaryController.CHAT_MAX_FILE_SIZE_BYTES,
      },
      fileFilter: CloudinaryController.fileFilter,
    }),
  )
  async uploadChatMedia(@UserInfo() user: any, @UploadedFiles() files: Express.Multer.File[]) {
    this.validateFiles(files);
    const results = await this.cloudinaryService.uploadMultipleMedia(files, user._id);
    return { success: true, message: `Successfully uploaded ${results.length} files`, results };
  }

  @Post('delete')
  @HttpCode(HttpStatus.OK)
  async deleteMedia(@UserInfo() user: any, @Body() body: DeleteMediaRequestDto) {
    const results = await this.cloudinaryService.deleteOwnedMedia(user._id, body.media);
    const failedCount = results.filter((result) => !result.success).length;
    return {
      success: failedCount === 0,
      message:
        failedCount === 0
          ? `Successfully deleted ${results.length} media files`
          : `Deleted ${results.length - failedCount} files, ${failedCount} rejected or failed`,
      results,
    };
  }
}
