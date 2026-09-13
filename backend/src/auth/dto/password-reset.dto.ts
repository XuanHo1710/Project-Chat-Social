import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength, Matches, Length } from 'class-validator';

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
    @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
    @MaxLength(72, { message: 'Mật khẩu không được quá 72 ký tự' })
    newPassword: string;

    @IsString({ message: 'Phiên đặt lại mật khẩu không hợp lệ' })
    @IsNotEmpty({ message: 'Thiếu phiên đặt lại mật khẩu' })
    @Length(64, 64, { message: 'Phiên đặt lại mật khẩu không hợp lệ' })
    @Matches(/^[a-f0-9]{64}$/i, { message: 'Phiên đặt lại mật khẩu không hợp lệ' })
    resetToken: string;
}

export class ResendOtpDto {
    @IsEmail({}, { message: 'Email không hợp lệ' })
    @IsNotEmpty({ message: 'Email không được để trống' })
    email: string;
}
