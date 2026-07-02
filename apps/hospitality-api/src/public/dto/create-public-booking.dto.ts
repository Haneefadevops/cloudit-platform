import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class CreatePublicBookingDto {
  @IsNotEmpty()
  @IsString()
  propertySlug: string;

  @IsNotEmpty()
  @IsUUID()
  roomTypeId: string;

  @IsNotEmpty()
  @IsString()
  checkInDate: string;

  @IsNotEmpty()
  @IsString()
  checkOutDate: string;

  @IsNotEmpty()
  @IsString()
  firstName: string;

  @IsNotEmpty()
  @IsString()
  lastName: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  nicNumber?: string;

  @IsOptional()
  @IsString()
  passportNumber?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  adults?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  children?: number;

  @IsIn(["cash", "bank_transfer", "payhere", "stripe"])
  paymentMethod: "cash" | "bank_transfer" | "payhere" | "stripe";
}
