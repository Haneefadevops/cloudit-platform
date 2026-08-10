import { NotFoundException } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';

describe('WorkflowsService', () => {
  function setup() {
    const prisma = {
      workflow: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({ id: 'workflow-1', clientId: 'client-1' }),
        create: jest.fn().mockResolvedValue({ id: 'workflow-1' }),
        update: jest.fn().mockResolvedValue({ id: 'workflow-1' }),
        delete: jest.fn().mockResolvedValue({ id: 'workflow-1' }),
      },
      customerCategory: { findFirst: jest.fn().mockResolvedValue({ id: 'category-1' }) },
    };
    return { prisma, service: new WorkflowsService(prisma as never) };
  }

  it('lists workflows only for the requested client in priority order', async () => {
    const { prisma, service } = setup();

    await service.findAll('client-1');

    expect(prisma.workflow.findMany).toHaveBeenCalledWith({
      where: { clientId: 'client-1' },
      include: { category: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  });

  it('creates a workflow scoped to the client', async () => {
    const { prisma, service } = setup();

    await service.create('client-1', {
      name: 'Visa Services',
      trigger: 'Customer asks about visas',
      instructions: 'Collect the destination country.',
      categoryId: 'category-1',
    });

    expect(prisma.customerCategory.findFirst).toHaveBeenCalledWith({
      where: { id: 'category-1', clientId: 'client-1' },
    });
    expect(prisma.workflow.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ clientId: 'client-1', categoryId: 'category-1' }),
      include: { category: true },
    });
  });

  it('rejects update and delete requests for another client', async () => {
    const { prisma, service } = setup();
    prisma.workflow.findFirst.mockResolvedValue(null);

    await expect(service.update('client-2', 'workflow-1', { name: 'Other' })).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.remove('client-2', 'workflow-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.workflow.update).not.toHaveBeenCalled();
    expect(prisma.workflow.delete).not.toHaveBeenCalled();
  });
});
