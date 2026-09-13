import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../common/enums/user-role.enum';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class AdminUserQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;

  @IsOptional()
  @IsIn(['ACTIVE', 'BLOCKED', 'PENDING'])
  status?: string;

  @IsOptional()
  @IsIn(['ALL', UserRole.USER, UserRole.ADMIN, UserRole.EMPLOYEE])
  role?: string;

  @IsOptional()
  @IsIn(['lastLogin', 'email', 'name', 'createdAt'])
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class AdminPostQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;

  @IsOptional()
  @IsIn(['ALL', 'ACTIVE', 'HIDDEN'])
  status?: string;

  @IsOptional()
  @IsIn(['ALL', 'PUBLIC', 'PRIVATE', 'FRIEND', 'GROUP'])
  privacy?: string;

  @IsOptional()
  @IsIn(['time', 'reactions', 'comments', 'shares', 'createdAt'])
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class TrafficQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days = 7;
}

export class CreateAdminAccountDto {
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  fullName: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email: string;

  @Transform(trim)
  @IsString()
  @Length(3, 40)
  username: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsIn([UserRole.USER, UserRole.ADMIN, UserRole.EMPLOYEE])
  role: UserRole.USER | UserRole.ADMIN | UserRole.EMPLOYEE;
}

export class BlockUserDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expireAt?: Date;
}

export class UpdateUserRoleDto {
  @IsIn([UserRole.USER, UserRole.ADMIN, UserRole.EMPLOYEE])
  role: UserRole.USER | UserRole.ADMIN | UserRole.EMPLOYEE;
}
