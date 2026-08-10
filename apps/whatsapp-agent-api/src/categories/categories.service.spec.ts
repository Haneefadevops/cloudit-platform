import { NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  function setup() {
    const prisma = {
      customerCategory: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({ id: 'category-1', clientId: 'client-1' }),
        create: jest.fn().mockResolvedValue({ id: 'category-1' }),
        update: jest.fn().mockResolvedValue({ id: 'category-1' }),
        delete: jest.fn().mockResolvedValue({ id: 'category-1' }),
      },
    };
    return { prisma, service: new CategoriesService(prisma as never) };
  }

  it('lists and creates categories for the requested client', async () => {
    const { prisma, service } = setup();

    await service.findAll('client-1');
    await service.create('client-1', { name: 'Visa lead' });

    expect(prisma.customerCategory.findMany).toHaveBeenCalledWith({
      where: { clientId: 'client-1' },
      orderBy: { createdAt: 'asc' },
    });
    expect(prisma.customerCategory.create).toHaveBeenCalledWith({
      data: { clientId: 'client-1', name: 'Visa lead' },
    });
  });

  it('rejects updates and deletes for another client', async () => {
    const { prisma, service } = setup();
    prisma.customerCategory.findFirst.mockResolvedValue(null);

    await expect(service.update('client-2', 'category-1', { name: 'Other' })).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.remove('client-2', 'category-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.customerCategory.update).not.toHaveBeenCalled();
    expect(prisma.customerCategory.delete).not.toHaveBeenCalled();
  });
});
