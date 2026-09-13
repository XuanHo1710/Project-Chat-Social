import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MessageType } from 'src/chat/entities/message.entity';

export class MessageAttachmentDto {
  @IsString()
  @MaxLength(2048)
  url: string;

  @IsString()
  @MaxLength(200)
  publicId: string;

  @IsString()
  @MaxLength(255)
  fileName: string;

  @IsNumber()
  @Min(0)
  fileSize: number;

  @IsIn(['IMAGE', 'VIDEO', 'RAW'])
  mediaType: 'IMAGE' | 'VIDEO' | 'RAW';
}

export class MessageCallDataDto {
  @IsIn(['AUDIO', 'VIDEO'])
  callType: 'AUDIO' | 'VIDEO';

  @IsIn(['ANSWERED', 'MISSED', 'CANCELLED', 'ONGOING'])
  callStatus: 'ANSWERED' | 'MISSED' | 'CANCELLED' | 'ONGOING';

  @IsOptional()
  @IsNumber()
  @Min(0)
  duration?: number;

  @IsOptional()
  @IsBoolean()
  isGroup?: boolean;
}

export class MessageStoryReplyDto {
  @IsString()
  @MaxLength(128)
  storyId: string;

  @IsString()
  @MaxLength(2048)
  storyMediaUrl: string;

  @IsMongoId()
  storyOwnerId: string;

  @IsString()
  @MaxLength(120)
  storyOwnerName: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  storyCaption?: string;
}

export class CreateMessageDto {
  @IsMongoId()
  conversationId: string;

  // Accepted for backward compatibility but always overwritten server-side
  // with the authenticated user's id.
  @IsOptional()
  @IsMongoId()
  senderId?: string;

  @IsEnum(MessageType)
  type: MessageType;

  // Nội dung text hoặc URL của file/image
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  // Danh sách file đính kèm
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MessageAttachmentDto)
  attachments?: MessageAttachmentDto[];

  // Tin nhắn được reply
  @IsOptional()
  @IsMongoId()
  replyTo?: string;

  // ID của bài viết được chia sẻ (cho type=POST)
  @IsOptional()
  @IsMongoId()
  postId?: string;

  // Danh sách post IDs được AI gợi ý (cho type=CHATBOT)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsMongoId({ each: true })
  postIdsRecommendationfromAI?: string[];

  // Dữ liệu cuộc gọi (cho type=CALL)
  @IsOptional()
  @ValidateNested()
  @Type(() => MessageCallDataDto)
  callData?: MessageCallDataDto;

  // Story reply data (cho type=STORY_REPLY)
  @IsOptional()
  @ValidateNested()
  @Type(() => MessageStoryReplyDto)
  storyReply?: MessageStoryReplyDto;
}
