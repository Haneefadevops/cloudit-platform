import { IsEnum, IsOptional, IsString } from "class-validator";
import { PaymentMethod } from "@prisma/client-hospitality";

export class PublicCheckoutDto {
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  providerRef?: string;
}
