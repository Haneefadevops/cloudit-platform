import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CannedResponsesService } from './canned-responses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('canned-responses')
@UseGuards(JwtAuthGuard, AdminGuard)
export class CannedResponsesController {
  constructor(private readonly cannedResponsesService: CannedResponsesService) {}

  @Get(':clientId')
  findAll(@Param('clientId') clientId: string) {
    return this.cannedResponsesService.findAll(clientId);
  }

  @Post(':clientId')
  create(
    @Param('clientId') clientId: string,
    @Body() body: { shortcut: string; title: string; content: string },
  ) {
    return this.cannedResponsesService.create(clientId, body);
  }

  @Put(':clientId/:id')
  update(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @Body() body: { shortcut?: string; title?: string; content?: string },
  ) {
    return this.cannedResponsesService.update(clientId, id, body);
  }

  @Delete(':clientId/:id')
  remove(@Param('clientId') clientId: string, @Param('id') id: string) {
    return this.cannedResponsesService.remove(clientId, id);
  }
}
