import { ArrayMaxSize, IsArray, IsMongoId } from 'class-validator';

export class PostReactionsSummaryDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  postIds: string[];
}

export class FactorReactionsSummaryDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  factorIds: string[];
}
