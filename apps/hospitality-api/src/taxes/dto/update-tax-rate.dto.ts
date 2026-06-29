import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsEnum,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { TaxRateType } from "@prisma/client-hospitality";

export class UpdateTaxRateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Type(() => Number)
  rate?: number;

  @IsOptional()
  @IsEnum(TaxRateType)
  type?: TaxRateType;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isDefault?: boolean;
}
