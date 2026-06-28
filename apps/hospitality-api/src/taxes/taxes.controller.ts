import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TaxesService } from './taxes.service';

@ApiTags('taxes')
@Controller('taxes')
export class TaxesController {
  constructor(private readonly taxesService: TaxesService) {}
}
