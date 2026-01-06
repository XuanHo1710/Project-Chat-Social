import { IsString, IsEnum, IsOptional, IsNumber, Max, IsArray } from 'class-validator';
import { StoryType, StoryPrivacy } from '../entities/story.entity';

export class CreateStoryDto {
  @IsEnum(StoryType)
  type: StoryType;

  @IsString()
  mediaUrl: string;

  @IsOptional()
  @IsString()
  thumbnail?: string;

  @IsOptional()
  @IsNumber()
  @Max(15) // Max 15 seconds
  duration?: number;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsEnum(StoryPrivacy)
  privacy?: StoryPrivacy;
}

export class ReactToStoryDto {
  @IsString()
  storyId: string;

  @IsString()
  reaction: string; // emoji
}

export class ViewStoryDto {
  @IsString()
  storyId: string;
}
