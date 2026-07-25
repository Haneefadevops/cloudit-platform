import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UsageService } from './usage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { ScopedClientId } from '../common/decorators/scoped-client-id.decorator';

@Controller('usage')
@UseGuards(JwtAuthGuard)
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  /** Usage card data + top-up history. Portal users see only their own client. */
  @Get(':clientId')
  async getUsage(@ScopedClientId() clientId: string) {
    const usage = await this.usageService.getUsage(clientId);
    if (!usage) throw new NotFoundException('Client not found');
    const topUps = await this.usageService.listTopUps(clientId);
    return { ...usage, topUps };
  }

  /** Staff records a top-up after confirming a manual payment. */
  @Post(':clientId/topups')
  @UseGuards(AdminGuard)
  topUp(
    @Param('clientId') clientId: string,
    @Body() body: { credits: number; priceLkr: number; note?: string },
  ) {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('credits and priceLkr are required');
    }
    return this.usageService.topUp(clientId, {
      credits: Number(body.credits),
      priceLkr: Number(body.priceLkr),
      note: body.note,
    });
  }
}
