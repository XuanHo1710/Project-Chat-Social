import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { GroupPrivacy, GroupVisibility } from '../entities/group.entity';

export class CreateGroupDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsEnum(GroupPrivacy)
  @IsOptional()
  privacy?: GroupPrivacy;

  @IsEnum(GroupVisibility)
  @IsOptional()
  visibility?: GroupVisibility;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsString()
  @IsOptional()
  coverImage?: string;
}

export class UpdateGroupDto {
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsEnum(GroupPrivacy)
  @IsOptional()
  privacy?: GroupPrivacy;

  @IsEnum(GroupVisibility)
  @IsOptional()
  visibility?: GroupVisibility;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsString()
  @IsOptional()
  coverImage?: string;

  @IsString({ each: true })
  @IsOptional()
  rules?: string[];
}

export class InviteMemberDto {
  @IsString()
  userId: string;
}

export class UpdateMemberRoleDto {
  @IsString()
  role: 'ADMIN' | 'MODERATOR' | 'MEMBER';
}
