import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { CommentReactionType } from '../entities/comment-reaction.entity';

export class CreateCommentReactionDto {
  @IsString()
  @IsNotEmpty()
  commentId: string;

  @IsEnum(CommentReactionType)
  @IsNotEmpty()
  type: CommentReactionType;
}
