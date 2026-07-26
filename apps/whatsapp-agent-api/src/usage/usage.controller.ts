import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { UsageService } from './usage.service';
import { TopUpRequestsService } from './topup-requests.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { ScopedClientId } from '../common/decorators/scoped-client-id.decorator';

@Controller('usage')
@UseGuards(JwtAuthGuard)
export class UsageController {
  constructor(
    private readonly usageService: UsageService,
    private readonly topUpRequests: TopUpRequestsService,
  ) {}

  /** Fixed packages + staff-configured bank details (portal + staff). */
  @Get('packages')
  getPackages() {
    return {
      packages: this.topUpRequests.packages(),
      bankDetails: this.topUpRequests.bankDetails(),
    };
  }

  // ---- Staff: request review ----

  @Get('topup-requests')
  @UseGuards(AdminGuard)
  listAllRequests() {
    return this.topUpRequests.listAll();
  }

  @Get('topup-requests/:id/slip')
  @UseGuards(AdminGuard)
  async getSlip(@Param('id') id: string, @Res() res: Response) {
    const slip = await this.topUpRequests.getSlip(id);
    res.set({
      'Content-Type': slip.slipMimeType || 'application/octet-stream',
    });
    res.send(slip.slipData);
  }

  @Post('topup-requests/:id/approve')
  @UseGuards(AdminGuard)
  approveRequest(@Param('id') id: string) {
    return this.topUpRequests.approve(id);
  }

  @Post('topup-requests/:id/reject')
  @UseGuards(AdminGuard)
  rejectRequest(@Param('id') id: string, @Body() body: { note?: string }) {
    return this.topUpRequests.reject(id, body?.note || '');
  }

  // ---- Portal: usage card + client-initiated top-ups ----

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

  @Post(':clientId/topup-requests')
  createRequest(
    @ScopedClientId() clientId: string,
    @Body() body: { conversations: number },
  ) {
    return this.topUpRequests.createRequest(
      clientId,
      Number(body?.conversations),
    );
  }

  @Get(':clientId/topup-requests')
  listRequests(@ScopedClientId() clientId: string) {
    return this.topUpRequests.listForClient(clientId);
  }

  @Post(':clientId/topup-requests/:id/slip')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  uploadSlip(
    @ScopedClientId() clientId: string,
    @Param('id') id: string,
    @UploadedFile()
    file: { buffer: Buffer; mimetype: string; size: number } | undefined,
  ) {
    return this.topUpRequests.uploadSlip(clientId, id, file);
  }
}
