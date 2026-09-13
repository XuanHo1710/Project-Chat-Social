import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';

export class FcmTokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  token: string;
}

export class ActivityStatusDto {
  @IsBoolean()
  show: boolean;
}
