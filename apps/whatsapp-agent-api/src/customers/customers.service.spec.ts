import { NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';

describe('CustomersService category assignment', () => {
  function setup() {
    const prisma = {
      customer: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({ id: 'customer-1', clientId: 'client-1' }),
        update: jest.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      customerCategory: { findFirst: jest.fn().mockResolvedValue({ id: 'category-1' }) },
    };
    return { prisma, service: new CustomersService(prisma as never) };
  }

  it('lists customers by client and optional category', async () => {
    const { prisma, service } = setup();

    await service.findAll('client-1', 'category-1');

    expect(prisma.customer.findMany).toHaveBeenCalledWith({
      where: { clientId: 'client-1', categoryId: 'category-1' },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('assigns and clears a category for a customer in the same client', async () => {
    const { prisma, service } = setup();

    await service.setCategory('client-1', 'customer-1', 'category-1');
    await service.setCategory('client-1', 'customer-1', null);

    expect(prisma.customer.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'customer-1' },
      data: { categoryId: 'category-1' },
      include: { category: true },
    });
    expect(prisma.customer.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'customer-1' },
      data: { categoryId: null },
      include: { category: true },
    });
  });

  it('rejects a category owned by another client', async () => {
    const { prisma, service } = setup();
    prisma.customerCategory.findFirst.mockResolvedValue(null);

    await expect(
      service.setCategory('client-1', 'customer-1', 'other-client-category'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.customer.update).not.toHaveBeenCalled();
  });
});
