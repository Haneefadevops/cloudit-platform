import { IsNotEmpty, IsUUID, IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class CalendarQueryDto {
  @IsNotEmpty()
  @IsUUID()
  propertyId: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month: number;

  @IsNotEmpty()
  @IsInt()
  @Min(2000)
  @Max(2100)
  @Type(() => Number)
  year: number;
}
