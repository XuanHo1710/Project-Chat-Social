import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class ForgotPasswordDto {
    @IsEmail({}, { message: 'Email không hợp lệ' })
    @IsNotEmpty({ message: 'Email không được để trống' })
    email: string;
}

export class VerifyOtpDto {
    @IsEmail({}, { message: 'Email không hợp lệ' })
    @IsNotEmpty({ message: 'Email không được để trống' })
    email: string;

    @IsString({ message: 'Mã OTP phải là chuỗi' })
    @IsNotEmpty({ message: 'Mã OTP không được để trống' })
    @MinLength(6, { message: 'Mã OTP phải có 6 ký tự' })
    @MaxLength(6, { message: 'Mã OTP phải có 6 ký tự' })
    @Matches(/^\d{6}$/, { message: 'Mã OTP phải là 6 chữ số' })
    otp: string;
}

export class ResetPasswordDto {
    @IsEmail({}, { message: 'Email không hợp lệ' })
    @IsNotEmpty({ message: 'Email không được để trống' })
    email: string;

    @IsString({ message: 'Mật khẩu phải là chuỗi' })
    @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
    @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
    @MaxLength(50, { message: 'Mật khẩu không được quá 50 ký tự' })
    newPassword: string;
}

export class ResendOtpDto {
    @IsEmail({}, { message: 'Email không hợp lệ' })
    @IsNotEmpty({ message: 'Email không được để trống' })
    email: string;
}
