import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class AccountGoogleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  lastName: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MaxLength(2048)
  picture: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  googleId: string;
}
