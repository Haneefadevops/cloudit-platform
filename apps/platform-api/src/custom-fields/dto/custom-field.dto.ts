import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpsertCustomFieldDto {
  @IsString()
  @IsNotEmpty()
  product!: string;

  @IsString()
  @IsNotEmpty()
  module!: string;

  @IsString()
  @IsNotEmpty()
  entity!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  fieldKey!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fieldLabel!: string;

  @IsIn(['text', 'number', 'date', 'dropdown', 'checkbox'])
  fieldType!: string;

  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
