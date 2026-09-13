import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MediaType, PostPrivacy } from '../entities/post.entity';

export class MediaItemDto {
  @IsEnum(MediaType)
  @IsNotEmpty()
  mediaType: MediaType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  url: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  publicId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20000)
  width?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20000)
  height?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(86400)
  duration?: number;
}

export class CreatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;

  @IsOptional()
  @IsEnum(PostPrivacy)
  privacy?: PostPrivacy;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  media?: MediaItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  background?: string | null;

  @IsOptional()
  @IsString()
  @IsMongoId()
  sharedPostId?: string | null;

  @IsOptional()
  @IsString()
  @IsMongoId()
  groupId?: string | null;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @IsOptional()
  @IsBoolean()
  allowComments?: boolean;

  @IsOptional()
  @IsBoolean()
  allowShares?: boolean;

  @IsOptional()
  @IsBoolean()
  allowReactions?: boolean;

}
