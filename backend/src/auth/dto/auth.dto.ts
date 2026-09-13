import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class LoginDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  username: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}

export class SignupDto {
  @Transform(trim)
  @IsString()
  @Length(3, 40)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'Username may only contain letters, numbers, dot, underscore and hyphen',
  })
  username: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @Transform(trim)
  @IsString()
  @Length(1, 60)
  firstName: string;

  @Transform(trim)
  @IsString()
  @Length(1, 60)
  lastName: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{8,15}$/)
  phone?: string;
}

export class RefreshTokenDto {
  @IsUUID('4')
  sessionId: string;
}

export class LogoutDto {
  @IsOptional()
  @IsUUID('4')
  sessionId?: string;
}

export class GoogleExchangeDto {
  @IsUUID('4')
  code: string;
}
