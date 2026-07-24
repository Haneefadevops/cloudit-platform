import { BadRequestException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

function setup(bookingOverrides: Record<string, unknown> = {}) {
  const booking = {
    id: 'bk-1',
    status: 'confirmed',
    startAt: new Date('2099-07-24T19:30:00Z'),
    service: { name: 'Consultation' },
    staff: { name: 'Dr. Perera' },
    customer: { name: 'Nimal', phoneNumber: '+94771234567' },
    client: {
      name: 'Test Clinic',
      timezone: 'UTC',
      metaAccessToken: 'token',
      whatsappPhoneNumberId: 'pn-1',
      bookingConfirmationTemplate: null,
    },
    ...bookingOverrides,
  };
  const prisma = {
    booking: {
      update: jest.fn().mockResolvedValue(booking),
      findMany: jest.fn().mockResolvedValue([booking]),
    },
  };
  const sender = { sendMessage: jest.fn().mockResolvedValue(undefined) };
  const service = new BookingsService(prisma as never, sender as never);
  return { prisma, sender, service };
}

describe('BookingsService.updateBookingStatus', () => {
  it('rejects an invalid status', async () => {
    const { service } = setup();
    await expect(
      service.updateBookingStatus('client-1', 'bk-1', 'maybe'),
    ).rejects.toThrow(BadRequestException);
  });

  it('confirms and notifies the customer with the default message', async () => {
    const { service, prisma, sender } = setup();
    await service.updateBookingStatus('client-1', 'bk-1', 'confirmed');

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'bk-1', clientId: 'client-1' },
        data: { status: 'confirmed' },
      }),
    );
    expect(sender.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '+94771234567',
        message: expect.stringContaining('is confirmed'),
      }),
    );
  });

  it('uses the client confirmation template with variable substitution', async () => {
    const { service, sender } = setup({
      client: {
        name: 'Test Clinic',
        timezone: 'UTC',
        metaAccessToken: 'token',
        whatsappPhoneNumberId: 'pn-1',
        bookingConfirmationTemplate:
          'Hi {{customer_name}}, {{service_name}} at {{when}} confirmed by {{business_name}}.',
      },
    });
    await service.updateBookingStatus('client-1', 'bk-1', 'confirmed');

    const message = sender.sendMessage.mock.calls[0][0].message as string;
    expect(message).toContain('Hi Nimal');
    expect(message).toContain('Consultation');
    expect(message).toContain('Test Clinic');
    expect(message).not.toContain('{{');
  });

  it('notifies on cancellation', async () => {
    const { service, sender } = setup({ status: 'cancelled' });
    await service.updateBookingStatus('client-1', 'bk-1', 'cancelled');

    const message = sender.sendMessage.mock.calls[0][0].message as string;
    expect(message).toContain('cancelled');
  });

  it('stays silent for other statuses (completed, no_show, pending)', async () => {
    const { service, sender } = setup({ status: 'completed' });
    await service.updateBookingStatus('client-1', 'bk-1', 'completed');

    expect(sender.sendMessage).not.toHaveBeenCalled();
  });

  it('does not fail the status update when notification fails', async () => {
    const { service, sender } = setup();
    sender.sendMessage.mockRejectedValue(new Error('Meta API down'));
    const booking = await service.updateBookingStatus(
      'client-1',
      'bk-1',
      'confirmed',
    );
    expect(booking.status).toBe('confirmed');
  });
});
