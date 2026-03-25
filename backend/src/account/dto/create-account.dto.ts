import { IsNotEmpty, IsOptional, IsString, MinLength, Matches } from 'class-validator';

export class CreateAccountDto {
  @IsNotEmpty({ message: 'Tên không được để trống' })
  firstName: string;

  @IsNotEmpty({ message: 'Tên không được để trống' })
  lastName: string;

  @IsNotEmpty({ message: 'Tên đăng nhập không được để trống' })
  username: string;

  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  password: string;

  @IsOptional()
  @IsString()
  phone?: string;

  email?: string;

  avatar?: string;

  googleId?: string;

  authProvider?: string;
}
