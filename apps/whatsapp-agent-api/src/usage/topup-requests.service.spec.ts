import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  TopUpRequestsService,
  TOPUP_PACKAGES,
  TOPUP_REQUEST_TTL_MS,
} from './topup-requests.service';

const CLIENT = {
  id: 'client-1',
  name: 'Test Clinic',
  metaAccessToken: 'token',
  whatsappPhoneNumberId: 'pn-1',
};

function setup(options: {
  staffAlertNumber?: string;
  bankDetails?: string;
  existingReferences?: string[];
  request?: Record<string, unknown> | null;
} = {}) {
  const prisma = {
    client: {
      findUnique: jest.fn().mockResolvedValue(CLIENT),
      update: jest.fn().mockResolvedValue({}),
    },
    topUpRequest: {
      findUnique: jest.fn().mockImplementation(({ where }: any) => {
        if (where.reference) {
          return Promise.resolve(
            (options.existingReferences ?? []).includes(where.reference)
              ? { id: 'collision' }
              : null,
          );
        }
        return Promise.resolve(
          options.request === undefined ? null : options.request,
        );
      }),
      findFirst: jest
        .fn()
        .mockResolvedValue(options.request === undefined ? null : options.request),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'req-1', ...data }),
      ),
      update: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'req-1', reference: 'TU-00042', client: CLIENT, conversations: 500, ...data }),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    $transaction: jest
      .fn()
      .mockImplementation((promises: Promise<unknown>[]) =>
        Promise.all(promises),
      ),
  };
  const staffAlerts = { sendAlert: jest.fn().mockResolvedValue(undefined) };
  const config = {
    get: (key: string) =>
      key === 'STAFF_ALERT_WHATSAPP'
        ? options.staffAlertNumber
        : key === 'TOPUP_BANK_DETAILS'
          ? options.bankDetails
          : undefined,
  };
  const service = new TopUpRequestsService(
    prisma as never,
    staffAlerts as never,
    config as never,
  );
  return { prisma, staffAlerts, service };
}

describe('TopUpRequestsService packages & reference codes', () => {
  it('has the six fixed packages at flat LKR 5 per conversation', () => {
    expect(TOPUP_PACKAGES).toEqual([
      { conversations: 300, priceLkr: 1500 },
      { conversations: 500, priceLkr: 2500 },
      { conversations: 700, priceLkr: 3500 },
      { conversations: 1000, priceLkr: 5000 },
      { conversations: 1500, priceLkr: 7500 },
      { conversations: 2000, priceLkr: 10000 },
    ]);
    for (const p of TOPUP_PACKAGES) {
      expect(p.priceLkr / p.conversations).toBe(5);
    }
  });

  it('creates a request with a TU-XXXXX reference', async () => {
    const { service } = setup();
    const { request, bankDetails } = await service.createRequest(
      'client-1',
      500,
    );

    expect(request.reference).toMatch(/^TU-\d{5}$/);
    expect(request.conversations).toBe(500);
    expect(request.priceLkr).toBe(2500);
    expect(bankDetails).toContain('not configured');
  });

  it('rejects an unknown package', async () => {
    const { service } = setup();
    await expect(service.createRequest('client-1', 400)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('retries reference generation on collision', async () => {
    const { prisma, service } = setup();
    // First generated reference always collides, second is free.
    let calls = 0;
    prisma.topUpRequest.findUnique.mockImplementation(() => {
      calls++;
      return Promise.resolve(calls === 1 ? { id: 'collision' } : null);
    });

    const { request } = await service.createRequest('client-1', 300);
    expect(prisma.topUpRequest.findUnique.mock.calls.length).toBeGreaterThan(1);
    expect(request.reference).toMatch(/^TU-\d{5}$/);
  });

  it('generates different references across requests (uniqueness)', async () => {
    const { service } = setup();
    const refs = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const { request } = await service.createRequest('client-1', 300);
      refs.add(request.reference);
    }
    // With random 5-digit codes, 25 draws should not all be identical.
    expect(refs.size).toBeGreaterThan(20);
  });

  it('sends a staff WhatsApp alert on request created', async () => {
    const { staffAlerts, service } = setup({ staffAlertNumber: '+94770000001' });
    await service.createRequest('client-1', 500);

    expect(staffAlerts.sendAlert).toHaveBeenCalledWith(
      CLIENT,
      expect.stringContaining('500 conversations, LKR 2,500'),
    );
    const message = staffAlerts.sendAlert.mock.calls[0][1] as string;
    expect(message).toContain('Test Clinic');
    expect(message).toMatch(/TU-\d{5}/);
  });

  it('always delegates to StaffAlertsService — routing (env fallback, on-duty rotation) lives there', async () => {
    const { staffAlerts, service } = setup({});
    await service.createRequest('client-1', 300);
    expect(staffAlerts.sendAlert).toHaveBeenCalledWith(
      CLIENT,
      expect.stringContaining('TU-'),
    );
  });

  it('returns configured bank details', async () => {
    const { service } = setup({ bankDetails: 'BOC 123-456 · CloudIT' });
    expect(service.bankDetails()).toBe('BOC 123-456 · CloudIT');
  });
});

describe('TopUpRequestsService slip upload', () => {
  const slipFile = {
    buffer: Buffer.from('fake-pdf'),
    mimetype: 'application/pdf',
    size: 1000,
  };

  it('marks the request slip_uploaded and alerts staff', async () => {
    const { prisma, staffAlerts, service } = setup({
      staffAlertNumber: '+94770000001',
      request: { id: 'req-1', clientId: 'client-1', status: 'pending_payment' },
    });
    const result = await service.uploadSlip('client-1', 'req-1', slipFile);

    expect(prisma.topUpRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'slip_uploaded',
          slipMimeType: 'application/pdf',
        }),
      }),
    );
    expect(staffAlerts.sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ metaAccessToken: 'token' }),
      expect.stringContaining('slip uploaded'),
    );
    expect((result as any).slipData).toBeUndefined(); // never returned
  });

  it('rejects upload when the request is not pending_payment', async () => {
    const { service } = setup({
      request: { id: 'req-1', clientId: 'client-1', status: 'approved' },
    });
    await expect(
      service.uploadSlip('client-1', 'req-1', slipFile),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects non-image/PDF slips and oversized files', async () => {
    const { service } = setup({
      request: { id: 'req-1', clientId: 'client-1', status: 'pending_payment' },
    });
    await expect(
      service.uploadSlip('client-1', 'req-1', {
        ...slipFile,
        mimetype: 'text/plain',
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.uploadSlip('client-1', 'req-1', {
        ...slipFile,
        size: 6 * 1024 * 1024,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('scopes uploads to the owning client', async () => {
    const { service } = setup({ request: null });
    await expect(
      service.uploadSlip('client-2', 'req-1', slipFile),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('TopUpRequestsService approve / reject / expire', () => {
  it('approve adds the package credits to topUpCredits atomically', async () => {
    const { prisma, service } = setup({
      request: {
        id: 'req-1',
        clientId: 'client-1',
        status: 'slip_uploaded',
        conversations: 500,
        reference: 'TU-00042',
        client: CLIENT,
      },
    });
    // findUnique (by id) returns the request
    const updated = await service.approve('req-1');

    expect(prisma.client.update).toHaveBeenCalledWith({
      where: { id: 'client-1' },
      data: { topUpCredits: { increment: 500 } },
    });
    expect(updated.status).toBe('approved');
  });

  it('approve refuses requests without a slip', async () => {
    const { service } = setup({
      request: { id: 'req-1', clientId: 'client-1', status: 'pending_payment' },
    });
    await expect(service.approve('req-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('reject requires a note and stores it for the client', async () => {
    const { prisma, service } = setup({
      request: { id: 'req-1', clientId: 'client-1', status: 'slip_uploaded' },
    });

    await expect(service.reject('req-1', '')).rejects.toThrow(
      BadRequestException,
    );

    await service.reject('req-1', 'slip unreadable — please re-upload');
    expect(prisma.topUpRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: 'rejected',
          staffNote: 'slip unreadable — please re-upload',
        },
      }),
    );
  });

  it('expires pending_payment requests older than 48h', async () => {
    const { prisma, service } = setup({});
    const now = new Date('2026-07-25T12:00:00Z');
    await service.expireStale(now);

    expect(prisma.topUpRequest.updateMany).toHaveBeenCalledWith({
      where: {
        status: 'pending_payment',
        createdAt: { lt: new Date(now.getTime() - TOPUP_REQUEST_TTL_MS) },
      },
      data: { status: 'expired' },
    });
    const cutoff = (prisma.topUpRequest.updateMany.mock.calls[0][0] as any)
      .where.createdAt.lt as Date;
    expect(now.getTime() - cutoff.getTime()).toBe(48 * 60 * 60 * 1000);
  });
});
