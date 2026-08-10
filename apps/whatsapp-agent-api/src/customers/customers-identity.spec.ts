import { CustomersService } from './customers.service';

describe('CustomersService channel identity', () => {
  function setup() {
    const prisma = {
      customer: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'customer-1', ...data })),
        update: jest.fn(),
      },
    };
    return { prisma, service: new CustomersService(prisma as never) };
  }

  it('keeps the WhatsApp phone-based lookup unchanged', async () => {
    const { prisma, service } = setup();
    prisma.customer.findUnique.mockResolvedValue({ id: 'customer-1', phoneNumber: '+94771234567' });

    await service.findOrCreate({ clientId: 'client-1', phoneNumber: '+94771234567' });

    expect(prisma.customer.findUnique).toHaveBeenCalledWith({
      where: { clientId_phoneNumber: { clientId: 'client-1', phoneNumber: '+94771234567' } },
    });
    expect(prisma.customer.findFirst).not.toHaveBeenCalled();
  });

  it('finds and reuses Messenger customers by source ID without a phone number', async () => {
    const { prisma, service } = setup();
    prisma.customer.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: 'customer-1', name: 'Maya', channel: 'messenger', channelSourceId: 'psid-1' });

    const created = await service.findOrCreate({
      clientId: 'client-1', channel: 'messenger', channelSourceId: 'psid-1', name: 'Maya',
    });
    const existing = await service.findOrCreate({
      clientId: 'client-1', channel: 'messenger', channelSourceId: 'psid-1', name: 'Maya',
    });

    expect(created.phoneNumber).toBeNull();
    expect(existing.id).toBe('customer-1');
    expect(prisma.customer.findFirst).toHaveBeenCalledWith({
      where: { clientId: 'client-1', channel: 'messenger', channelSourceId: 'psid-1' },
    });
    expect(prisma.customer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ phoneNumber: null, channel: 'messenger', channelSourceId: 'psid-1' }),
    });
  });

  it('never overwrites an existing customer channel identity', async () => {
    const { prisma, service } = setup();
    prisma.customer.findFirst.mockResolvedValue({
      id: 'customer-1', name: 'Maya', channel: 'messenger', channelSourceId: 'psid-1',
    });

    await service.findOrCreate({
      clientId: 'client-1', channel: 'messenger', channelSourceId: 'psid-1', name: 'Maya',
    });

    expect(prisma.customer.update).not.toHaveBeenCalled();
    expect(prisma.customer.create).not.toHaveBeenCalled();
  });
});
