import { Type } from 'class-transformer';
import {
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { StoryType, StoryPrivacy } from '../entities/story.entity';

export class StoryCaptionStyleDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  x: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  y: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(8)
  @Max(72)
  fontSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  backgroundColor?: string;
}

export class CreateStoryDto {
  @IsEnum(StoryType)
  type: StoryType;

  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  mediaUrl: string;

  @IsString()
  @MinLength(1)
  @MaxLength(512)
  mediaPublicId: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  thumbnail?: string;

  @ValidateIf((dto: CreateStoryDto) => dto.thumbnail !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  thumbnailPublicId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(15) // Max 15 seconds
  duration?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  @IsOptional()
  @IsEnum(StoryPrivacy)
  privacy?: StoryPrivacy;

  @IsOptional()
  @ValidateNested()
  @Type(() => StoryCaptionStyleDto)
  captionStyle?: StoryCaptionStyleDto;
}

export class UpdateStoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  @IsOptional()
  @IsEnum(StoryPrivacy)
  privacy?: StoryPrivacy;

  @IsOptional()
  @ValidateNested()
  @Type(() => StoryCaptionStyleDto)
  captionStyle?: StoryCaptionStyleDto;
}

export class ReactToStoryDto {
  @IsMongoId()
  storyId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(16)
  reaction: string; // emoji
}
