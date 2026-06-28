import {
  IsOptional,
  IsString,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { RoomStatus } from '@prisma/client-hospitality';

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  roomNumber?: string;

  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;

  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @IsOptional()
  @IsUUID()
  roomTypeId?: string;
}
