import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { SendTransactionalMessageDto } from './dto/send-transactional-message.dto';
import { TransactionalService } from './transactional.service';

@Controller('v1')
export class TransactionalController {
  constructor(private readonly transactionalService: TransactionalService) {}

  @Post('messages')
  @UseGuards(ApiKeyGuard)
  send(@Req() request: { apiKey: { id: string; clientId: string } }, @Body() dto: SendTransactionalMessageDto) {
    return this.transactionalService.send(request.apiKey.clientId, request.apiKey.id, dto);
  }
}
