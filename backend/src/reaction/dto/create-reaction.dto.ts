import { IsNotEmpty, IsEnum, IsMongoId } from 'class-validator';
import { ReactionType } from '../entities/reaction.entity';

export class CreateReactionDto {
  @IsNotEmpty()
  @IsMongoId()
  postId: string;

  @IsNotEmpty()
  @IsEnum(ReactionType)
  type: ReactionType;
}
