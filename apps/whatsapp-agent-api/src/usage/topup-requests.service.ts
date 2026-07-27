import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StaffAlertsService } from '../staff-alerts/staff-alerts.service';

/** Flat LKR 5 per conversation — no volume discounts (settled in the plan). */
export const TOPUP_PACKAGES = [
  { conversations: 300, priceLkr: 1500 },
  { conversations: 500, priceLkr: 2500 },
  { conversations: 700, priceLkr: 3500 },
  { conversations: 1000, priceLkr: 5000 },
  { conversations: 1500, priceLkr: 7500 },
  { conversations: 2000, priceLkr: 10000 },
];

export const TOPUP_REQUEST_TTL_MS = 48 * 60 * 60 * 1000;

const SLIP_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];
const SLIP_MAX_BYTES = 5 * 1024 * 1024;

const WITHOUT_SLIP = {
  id: true,
  reference: true,
  conversations: true,
  priceLkr: true,
  status: true,
  slipMimeType: true,
  staffNote: true,
  createdAt: true,
  updatedAt: true,
  clientId: true,
} as const;

/**
 * Client-initiated top-ups: the client picks a package, pays by bank
 * transfer with the reference code as narration, uploads a slip, and staff
 * approves. Payments stay manual — a later PayHere phase replaces ONLY the
 * payment leg, not packages, statuses, or this flow.
 */
@Injectable()
export class TopUpRequestsService {
  private readonly logger = new Logger(TopUpRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly staffAlertsService: StaffAlertsService,
    private readonly configService: ConfigService,
  ) {}

  packages() {
    return TOPUP_PACKAGES;
  }

  /** Staff-configurable (TOPUP_BANK_DETAILS env), never hardcoded per client. */
  bankDetails(): string {
    return (
      this.configService.get<string>('TOPUP_BANK_DETAILS') ||
      'Bank details are not configured yet — please contact us directly.'
    );
  }

  async createRequest(clientId: string, conversations: number) {
    const pkg = TOPUP_PACKAGES.find((p) => p.conversations === conversations);
    if (!pkg) {
      throw new BadRequestException(
        `Unknown package. Choose one of: ${TOPUP_PACKAGES.map((p) => p.conversations).join(', ')}`,
      );
    }
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) throw new NotFoundException('Client not found');

    const reference = await this.generateReference();
    const request = await this.prisma.topUpRequest.create({
      data: {
        clientId,
        reference,
        conversations: pkg.conversations,
        priceLkr: pkg.priceLkr,
      },
      select: WITHOUT_SLIP,
    });

    await this.alertStaff(
      client,
      `Top-up request ${reference}: ${client.name} — ${pkg.conversations} conversations, LKR ${pkg.priceLkr.toLocaleString('en-US')}. Awaiting payment.`,
    );

    return { request, bankDetails: this.bankDetails() };
  }

  /** TU-XXXXX, unique — retries on collision. */
  private async generateReference(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const reference = `TU-${String(randomInt(0, 100000)).padStart(5, '0')}`;
      const existing = await this.prisma.topUpRequest.findUnique({
        where: { reference },
      });
      if (!existing) return reference;
    }
    throw new Error('Could not allocate a unique top-up reference');
  }

  async listForClient(clientId: string) {
    await this.expireStale();
    return this.prisma.topUpRequest.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: WITHOUT_SLIP,
    });
  }

  async listAll() {
    await this.expireStale();
    return this.prisma.topUpRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        ...WITHOUT_SLIP,
        client: { select: { id: true, name: true } },
      },
    });
  }

  /** pending_payment requests older than 48h become expired (lazy sweep). */
  async expireStale(now: Date = new Date()) {
    return this.prisma.topUpRequest.updateMany({
      where: {
        status: 'pending_payment',
        createdAt: { lt: new Date(now.getTime() - TOPUP_REQUEST_TTL_MS) },
      },
      data: { status: 'expired' },
    });
  }

  async uploadSlip(
    clientId: string,
    id: string,
    file: { buffer: Buffer; mimetype: string; size: number } | undefined,
  ) {
    if (!file || !file.buffer?.length) {
      throw new BadRequestException('A slip file is required');
    }
    if (!SLIP_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Slip must be an image (JPEG/PNG/WebP) or PDF');
    }
    if (file.size > SLIP_MAX_BYTES) {
      throw new BadRequestException('Slip must be smaller than 5 MB');
    }

    const request = await this.prisma.topUpRequest.findFirst({
      where: { id, clientId },
    });
    if (!request) throw new NotFoundException('Top-up request not found');
    if (request.status !== 'pending_payment') {
      throw new BadRequestException(
        `Cannot upload a slip for a request in status "${request.status}"`,
      );
    }

    const updated = await this.prisma.topUpRequest.update({
      where: { id },
      data: {
        status: 'slip_uploaded',
        slipData: file.buffer,
        slipMimeType: file.mimetype,
      },
      include: { client: true },
    });

    await this.alertStaff(
      updated.client,
      `Top-up request ${updated.reference}: slip uploaded — review in the dashboard.`,
    );

    const { slipData: _slipData, ...withoutSlip } = updated;
    return withoutSlip;
  }

  /** Staff: approve a slip_uploaded request — credits land immediately. */
  async approve(id: string) {
    const request = await this.prisma.topUpRequest.findUnique({
      where: { id },
      include: { client: true },
    });
    if (!request) throw new NotFoundException('Top-up request not found');
    if (request.status !== 'slip_uploaded') {
      throw new BadRequestException(
        `Only slip_uploaded requests can be approved (current: "${request.status}")`,
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.topUpRequest.update({
        where: { id },
        data: { status: 'approved' },
        select: WITHOUT_SLIP,
      }),
      this.prisma.client.update({
        where: { id: request.clientId },
        data: { topUpCredits: { increment: request.conversations } },
      }),
    ]);
    this.logger.log(
      `Approved top-up ${request.reference}: +${request.conversations} credits for ${request.client.name}`,
    );
    return updated;
  }

  /** Staff: reject with a mandatory note shown to the client. */
  async reject(id: string, note: string) {
    if (!note || !note.trim()) {
      throw new BadRequestException(
        'A note is required when rejecting (the client sees it)',
      );
    }
    const request = await this.prisma.topUpRequest.findUnique({
      where: { id },
    });
    if (!request) throw new NotFoundException('Top-up request not found');
    if (!['pending_payment', 'slip_uploaded'].includes(request.status)) {
      throw new BadRequestException(
        `Cannot reject a request in status "${request.status}"`,
      );
    }
    return this.prisma.topUpRequest.update({
      where: { id },
      data: { status: 'rejected', staffNote: note.trim() },
      select: WITHOUT_SLIP,
    });
  }

  async getSlip(id: string) {
    const request = await this.prisma.topUpRequest.findUnique({
      where: { id },
      select: { slipData: true, slipMimeType: true },
    });
    if (!request?.slipData) throw new NotFoundException('No slip uploaded');
    return request;
  }

  /**
   * Staff WhatsApp alert via the client's own sender credentials. Routing
   * (who is on duty, rotation, env fallback) lives in StaffAlertsService.
   */
  private async alertStaff(
    client: { metaAccessToken: string; whatsappPhoneNumberId: string },
    message: string,
  ) {
    try {
      await this.staffAlertsService.sendAlert(client, message);
    } catch (error) {
      this.logger.error(
        `Failed to send staff top-up alert: ${(error as Error).message}`,
      );
    }
  }
}
