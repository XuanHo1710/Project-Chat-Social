import { IsEnum, IsMongoId, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { NotificationType } from '../entities/notification.entity';

export class CreateNotificationDto {
  @IsMongoId()
  recipientId: string;

  @IsMongoId()
  @IsOptional()
  senderId?: string; // Single sender - will be added to senderIds array in service

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  message?: string;

  @IsMongoId()
  @IsOptional()
  groupId?: string;

  @IsMongoId()
  @IsOptional()
  postId?: string;

  @IsMongoId()
  @IsOptional()
  commentId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  typeReaction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  templateKey?: string;

  @IsOptional()
  @IsObject()
  templateParams?: Record<string, string | number>;
}

export class RespondGroupInvitationDto {
  @IsMongoId()
  notificationId: string;

  @IsEnum(['ACCEPT', 'REJECT'])
  action: 'ACCEPT' | 'REJECT';
}
