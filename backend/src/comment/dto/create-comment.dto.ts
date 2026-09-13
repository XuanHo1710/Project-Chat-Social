import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsMongoId,
  IsArray,
  ValidateNested,
  IsEnum,
  ArrayMaxSize,
  IsNumber,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class CommentMediaDto {
  @IsEnum(['IMAGE', 'VIDEO'])
  mediaType: 'IMAGE' | 'VIDEO';

  @IsString()
  @MaxLength(2048)
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  publicId?: string;

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
}

export class CreateCommentDto {
  @IsNotEmpty()
  @IsMongoId()
  postId: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  image?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => CommentMediaDto)
  media?: CommentMediaDto[];

  @IsOptional()
  @IsMongoId()
  parentId?: string; // For reply comments
}
