import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsInt,
  IsArray,
  IsUUID,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateRoomTypeDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  basePrice: number;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxOccupancy: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @IsNotEmpty()
  @IsUUID()
  propertyId: string;
}
