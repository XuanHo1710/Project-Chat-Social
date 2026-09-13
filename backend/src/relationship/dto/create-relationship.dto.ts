import { IsMongoId, IsOptional } from 'class-validator';
import mongoose from 'mongoose';

export class CreateRelationshipDto {
  // Backward-compatible input only. Controllers replace this value with the
  // authenticated principal so clients cannot act on behalf of another user.
  @IsOptional()
  @IsMongoId()
  userId?: mongoose.Schema.Types.ObjectId;

  @IsMongoId()
  friendId: mongoose.Schema.Types.ObjectId;

  status?: string;

  sendRequestAt?: Date;
}
