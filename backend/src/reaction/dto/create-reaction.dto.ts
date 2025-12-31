import { IsNotEmpty, IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { ReactionType, TypeFactor } from '../entities/reaction.entity';

export class CreateReactionDto {
  @IsNotEmpty()
  @IsMongoId()
  factorId: string;  // Can be postId, commentId, or messageId

  @IsNotEmpty()
  @IsEnum(TypeFactor)
  typeFactor: TypeFactor;  // POST, COMMENT, or MESSAGE

  @IsNotEmpty()
  @IsEnum(ReactionType)
  type: ReactionType;
}

// DTO for toggle reaction (used by socket)
export class ToggleReactionDto {
  @IsNotEmpty()
  @IsMongoId()
  factorId: string;

  @IsNotEmpty()
  @IsEnum(TypeFactor)
  typeFactor: TypeFactor;

  @IsNotEmpty()
  @IsEnum(ReactionType)
  type: ReactionType;
}

// Legacy DTO for backward compatibility with post reactions
export class CreatePostReactionDto {
  @IsNotEmpty()
  @IsMongoId()
  postId: string;

  @IsNotEmpty()
  @IsEnum(ReactionType)
  type: ReactionType;
}

// Legacy DTO for backward compatibility with comment reactions
export class CreateCommentReactionDto {
  @IsNotEmpty()
  @IsMongoId()
  commentId: string;

  @IsNotEmpty()
  @IsEnum(ReactionType)
  type: ReactionType;
}
