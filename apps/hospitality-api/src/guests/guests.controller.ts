import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GuestsService } from './guests.service';

@ApiTags('guests')
@Controller('guests')
export class GuestsController {
  constructor(private readonly guestsService: GuestsService) {}
}
