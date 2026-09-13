import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { GroupPrivacy, GroupVisibility } from '../entities/group.entity';
import { GroupRole } from '../entities/group-member.entity';

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
  @MaxLength(120)
  location?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2048)
  avatar?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2048)
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
  @MaxLength(120)
  location?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2048)
  avatar?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2048)
  coverImage?: string;

  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  @IsOptional()
  rules?: string[];
}

export class InviteMemberDto {
  @IsMongoId()
  userId: string;
}

export class UpdateMemberRoleDto {
  @IsEnum(GroupRole)
  role: GroupRole;
}
