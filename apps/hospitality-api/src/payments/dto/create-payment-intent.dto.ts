import { IsEnum, IsNotEmpty, IsNumber, IsString, Min } from "class-validator";
import { Type } from "class-transformer";
import { PaymentMethod } from "@prisma/client-hospitality";

export class CreatePaymentIntentDto {
  @IsNotEmpty()
  @IsString()
  invoiceId: string;

  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  method: PaymentMethod;
}
