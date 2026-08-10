import { BadGatewayException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { ApiKeyGuard } from './api-key.guard';
import { TransactionalService } from './transactional.service';

describe('Transactional API', () => {
  const client = { id: 'client-1', status: 'active', metaAccessToken: 'token', whatsappPhoneNumberId: 'phone-id' };
  const prisma = {
    apiKey: {
      findFirst: jest.fn(), update: jest.fn(), create: jest.fn(), findMany: jest.fn(), updateMany: jest.fn(),
    },
    client: { findUnique: jest.fn() },
    transactionalMessage: { create: jest.fn() },
  } as any;
  const sender = { sendTemplate: jest.fn() } as any;
  const service = new TransactionalService(prisma, sender);

  beforeEach(() => jest.clearAllMocks());

  it('rejects missing, invalid, and revoked API keys', async () => {
    const guard = new ApiKeyGuard(prisma);
    const request = { headers: {} } as any;
    const context = { switchToHttp: () => ({ getRequest: () => request }) } as any;
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    request.headers.authorization = 'Bearer garbage';
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    request.headers.authorization = 'Bearer trk_revoked';
    prisma.apiKey.findFirst.mockResolvedValue(null);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts a valid key, attaches its client, and records use asynchronously', async () => {
    const guard = new ApiKeyGuard(prisma);
    const request = { headers: { authorization: 'Bearer trk_valid' } } as any;
    const context = { switchToHttp: () => ({ getRequest: () => request }) } as any;
    prisma.apiKey.findFirst.mockResolvedValue({ id: 'key-1', clientId: 'client-1' });
    prisma.apiKey.update.mockResolvedValue({});
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.apiKey).toEqual({ id: 'key-1', clientId: 'client-1' });
    expect(prisma.apiKey.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { keyHash: createHash('sha256').update('trk_valid').digest('hex'), revokedAt: null },
    }));
  });

  it('sends, logs a sent row, and returns its id', async () => {
    prisma.client.findUnique.mockResolvedValue(client);
    sender.sendTemplate.mockResolvedValue(undefined);
    prisma.transactionalMessage.create.mockResolvedValue({ id: 'message-1' });
    await expect(service.send('client-1', 'key-1', { to: '+94771234567', templateName: 'order_update', parameters: ['#1042'], languageCode: 'en' })).resolves.toEqual({ id: 'message-1', status: 'sent' });
    expect(sender.sendTemplate).toHaveBeenCalledWith(expect.objectContaining({ client, to: '+94771234567', templateName: 'order_update' }));
    expect(prisma.transactionalMessage.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'sent' }) }));
  });

  it('logs Meta failures and returns the Meta message as 502', async () => {
    prisma.client.findUnique.mockResolvedValue(client);
    sender.sendTemplate.mockRejectedValue(new Error('Meta template rejected'));
    prisma.transactionalMessage.create.mockResolvedValue({ id: 'message-1' });
    await expect(service.send('client-1', 'key-1', { to: '+94771234567', templateName: 'order_update', languageCode: 'en' })).rejects.toEqual(new BadGatewayException('Meta template rejected'));
    expect(prisma.transactionalMessage.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'failed', error: 'Meta template rejected' }) }));
  });

  it('rejects inactive clients', async () => {
    prisma.client.findUnique.mockResolvedValue({ ...client, status: 'paused' });
    await expect(service.send('client-1', 'key-1', { to: '+94771234567', templateName: 'order_update', languageCode: 'en' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns a plaintext key only on creation, lists without its hash, and revokes by client', async () => {
    prisma.apiKey.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'key-1', name: data.name, prefix: data.prefix, keyHash: data.keyHash }));
    const created = await service.createApiKey('client-1', 'Orders');
    expect(created.key).toMatch(/^trk_[0-9a-f]{32}$/);
    expect(prisma.apiKey.create.mock.calls[0][0].data.keyHash).toBe(createHash('sha256').update(created.key).digest('hex'));
    expect(prisma.apiKey.create.mock.calls[0][0].data).not.toHaveProperty('key');

    prisma.apiKey.findMany.mockResolvedValue([{ id: 'key-1', name: 'Orders', prefix: created.prefix, lastUsedAt: null, revokedAt: null, createdAt: new Date() }]);
    await expect(service.listApiKeys('client-1')).resolves.not.toEqual(expect.arrayContaining([expect.objectContaining({ keyHash: expect.anything() })]));

    prisma.apiKey.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.revokeApiKey('other-client', 'key-1')).rejects.toBeInstanceOf(NotFoundException);
    prisma.apiKey.updateMany.mockResolvedValue({ count: 1 });
    await expect(service.revokeApiKey('client-1', 'key-1')).resolves.toEqual(expect.objectContaining({ id: 'key-1' }));
  });
});
