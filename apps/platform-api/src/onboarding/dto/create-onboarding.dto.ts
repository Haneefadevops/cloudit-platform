import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OnboardingModuleDto {
  @IsString()
  @IsNotEmpty()
  moduleKey!: string;

  @IsOptional()
  enabled?: boolean;
}

export class SuperAdminDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  lastName!: string;
}

export class CreateOnboardingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  organizationName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @IsString()
  @IsNotEmpty()
  product!: string;

  @ValidateNested()
  @Type(() => SuperAdminDto)
  superAdmin!: SuperAdminDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnboardingModuleDto)
  modules?: OnboardingModuleDto[];

  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;
}
