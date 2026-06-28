import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RoomTypesService } from './room-types.service';

@ApiTags('room-types')
@Controller('room-types')
export class RoomTypesController {
  constructor(private readonly roomTypesService: RoomTypesService) {}
}
