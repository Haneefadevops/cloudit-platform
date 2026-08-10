import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { TransactionalService } from './transactional.service';

@Controller('clients')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ApiKeysController {
  constructor(private readonly transactionalService: TransactionalService) {}

  @Post(':clientId/api-keys')
  create(@Param('clientId') clientId: string, @Body() dto: CreateApiKeyDto) {
    return this.transactionalService.createApiKey(clientId, dto.name);
  }

  @Get(':clientId/api-keys')
  list(@Param('clientId') clientId: string) {
    return this.transactionalService.listApiKeys(clientId);
  }

  @Delete(':clientId/api-keys/:id')
  revoke(@Param('clientId') clientId: string, @Param('id') id: string) {
    return this.transactionalService.revokeApiKey(clientId, id);
  }
}
