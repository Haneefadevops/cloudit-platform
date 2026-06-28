import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEmail,
  IsObject,
} from 'class-validator';

export class CreatePropertyDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}
