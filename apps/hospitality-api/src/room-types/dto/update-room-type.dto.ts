import {
  IsOptional,
  IsString,
  IsNumber,
  IsInt,
  IsArray,
  IsUUID,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class UpdateRoomTypeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  basePrice?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxOccupancy?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional()
  @IsUUID()
  propertyId?: string;
}
