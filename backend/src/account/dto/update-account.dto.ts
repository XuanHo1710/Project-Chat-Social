import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsDefined,
  IsEmail,
  IsIn,
  IsInt,
  isISO8601,
  IsMongoId,
  IsNotEmpty,
  IsObject,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

class AddressDivisionDto {
  @IsInt()
  @Min(0)
  code: number;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;
}

class AddressDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsMongoId()
  _id?: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  label: string;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => AddressDivisionDto)
  province: AddressDivisionDto;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => AddressDivisionDto)
  district: AddressDivisionDto;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => AddressDivisionDto)
  ward: AddressDivisionDto;

  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  detailAddress: string;

  @IsBoolean()
  isDefault: boolean;
}

// Profile updates deliberately exclude credentials and provider metadata.
export class UpdateAccountDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstName?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  lastName?: string;

  // Empty contact fields from the profile form clear the stored value.
  @ValidateIf((_object, value: unknown) => value !== undefined && value !== '')
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value
  )
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined && value !== '')
  @Transform(trimString)
  @IsString()
  @MaxLength(32)
  @Matches(/^\+?[0-9]{7,20}$/)
  phone?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @MaxLength(101)
  bio?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @MaxLength(2048)
  avatar?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @MaxLength(2048)
  background?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['MALE', 'FEMALE', 'OTHER'])
  gender?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const normalized = value.trim();
    if (normalized === '') return null;
    return isISO8601(normalized, { strict: true }) ? new Date(normalized) : value;
  })
  @IsDate()
  birthday?: Date | null;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(10)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => AddressDto)
  addresses?: AddressDto[];
}
