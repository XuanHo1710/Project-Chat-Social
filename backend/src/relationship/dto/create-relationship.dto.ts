import { IsNotEmpty } from 'class-validator';
import mongoose from 'mongoose';

export class CreateRelationshipDto {
  @IsNotEmpty({ message: 'userId is required' })
  userId: mongoose.Schema.Types.ObjectId;

  @IsNotEmpty({ message: 'friendId is required' })
  friendId: mongoose.Schema.Types.ObjectId;

  status?: string;

  sendRequestAt?: Date;
}
