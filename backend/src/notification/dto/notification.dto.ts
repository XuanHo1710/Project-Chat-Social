import { IsEnum, IsOptional, IsString } from 'class-validator';
import { NotificationType } from '../entities/notification.entity';

export class CreateNotificationDto {
  @IsString()
  recipientId: string;

  @IsString()
  @IsOptional()
  senderId?: string; // Single sender - will be added to senderIds array in service

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsString()
  @IsOptional()
  groupId?: string;

  @IsString()
  @IsOptional()
  postId?: string;

  @IsString()
  @IsOptional()
  commentId?: string;

  @IsOptional()
  metadata?: Record<string, any>;

  typeReaction?: string;
}

export class RespondGroupInvitationDto {
  @IsString()
  notificationId: string;

  @IsEnum(['ACCEPT', 'REJECT'])
  action: 'ACCEPT' | 'REJECT';
}
