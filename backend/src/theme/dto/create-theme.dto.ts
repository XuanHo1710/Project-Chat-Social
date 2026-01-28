
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateThemeDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    primaryColor: string;

    @IsString()
    @IsNotEmpty()
    secondaryColor: string;

    @IsString()
    @IsNotEmpty()
    bgDarkMode: string;

    @IsString()
    @IsNotEmpty()
    bgLightMode: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
