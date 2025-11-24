import { IsNotEmpty } from 'class-validator';

export class CreateAccountDto {
    @IsNotEmpty({ message: "Tên không được để trống" })
    firstName: string;

    @IsNotEmpty({ message: "Tên không được để trống" })
    lastName: string;

    @IsNotEmpty({ message: "Tên đăng nhập không được để trống" })
    username: string;

    @IsNotEmpty({ message: "Mật khẩu không được để trống" })
    password: string;
}
