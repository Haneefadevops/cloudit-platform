import { Type } from "class-transformer";
import { IsEnum, IsNotEmpty, IsNumber, IsString, Min } from "class-validator";
import { PaymentMethod } from "@prisma/client-hospitality";

export class CreatePublicPaymentIntentDto {
  @IsNotEmpty()
  @IsString()
  token: string;

  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  method: PaymentMethod;
}
