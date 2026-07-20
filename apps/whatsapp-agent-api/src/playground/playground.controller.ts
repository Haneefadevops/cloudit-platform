import {
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PlaygroundService } from './playground.service';
import { PlaygroundMessageDto } from './dto/playground-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('playground')
@UseGuards(JwtAuthGuard, AdminGuard)
export class PlaygroundController {
  constructor(private readonly playgroundService: PlaygroundService) {}

  @Post(':clientId/message')
  message(
    @Param('clientId') clientId: string,
    @Body() dto: PlaygroundMessageDto,
  ) {
    return this.playgroundService.run(clientId, dto);
  }
}
