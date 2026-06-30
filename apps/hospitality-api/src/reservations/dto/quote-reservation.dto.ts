import { IsDateString, IsNotEmpty, IsUUID } from "class-validator";

export class QuoteReservationDto {
  @IsNotEmpty()
  @IsUUID()
  roomId: string;

  @IsNotEmpty()
  @IsDateString()
  checkInDate: string;

  @IsNotEmpty()
  @IsDateString()
  checkOutDate: string;
}
