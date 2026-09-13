
import { IsBoolean, IsHexColor, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateThemeDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(80)
    name: string;

    @IsString()
    @IsNotEmpty()
    @IsHexColor()
    primaryColor: string;

    @IsString()
    @IsNotEmpty()
    @IsHexColor()
    secondaryColor: string;

    @IsString()
    @IsNotEmpty()
    @IsHexColor()
    bgDarkMode: string;

    @IsString()
    @IsNotEmpty()
    @IsHexColor()
    bgLightMode: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
