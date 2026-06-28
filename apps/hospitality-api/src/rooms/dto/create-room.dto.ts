import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { RoomStatus } from '@prisma/client-hospitality';

export class CreateRoomDto {
  @IsNotEmpty()
  @IsString()
  roomNumber: string;

  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;

  @IsNotEmpty()
  @IsUUID()
  propertyId: string;

  @IsNotEmpty()
  @IsUUID()
  roomTypeId: string;
}
