import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsMongoId,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

class CommentMediaDto {
  @IsEnum(['IMAGE', 'VIDEO'])
  mediaType: 'IMAGE' | 'VIDEO';

  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  publicId?: string;

  @IsOptional()
  width?: number;

  @IsOptional()
  height?: number;
}

export class CreateCommentDto {
  @IsNotEmpty()
  @IsMongoId()
  postId: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommentMediaDto)
  media?: CommentMediaDto[];

  @IsOptional()
  @IsMongoId()
  parentId?: string; // For reply comments
}
