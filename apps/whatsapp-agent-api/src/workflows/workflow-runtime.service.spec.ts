import { WorkflowRuntimeService } from './workflow-runtime.service';

const WORKFLOW = {
  id: 'wf-1',
  name: 'Visa Services',
  categoryId: 'cat-1',
};

function setup() {
  const prisma = {
    workflow: {
      findMany: jest.fn().mockResolvedValue([WORKFLOW]),
    },
    workflowSession: {
      findFirst: jest.fn(),
      create: jest.fn().mockResolvedValue({
        id: 'session-1',
        workflow: WORKFLOW,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    customer: {
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const service = new WorkflowRuntimeService(prisma as never);
  return { prisma, service };
}

describe('WorkflowRuntimeService', () => {
  it('lists only active workflows, priority first', async () => {
    const { prisma, service } = setup();

    await service.findActiveWorkflows('client-1');

    expect(prisma.workflow.findMany).toHaveBeenCalledWith({
      where: { clientId: 'client-1', isActive: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  });

  it('starts a session and qualifies the customer into the workflow category', async () => {
    const { prisma, service } = setup();

    const session = await service.startSession({
      clientId: 'client-1',
      conversationId: 'conv-1',
      workflowId: 'wf-1',
      customerId: 'cust-1',
    });

    expect(prisma.workflowSession.create).toHaveBeenCalledWith({
      data: {
        clientId: 'client-1',
        conversationId: 'conv-1',
        workflowId: 'wf-1',
      },
      include: { workflow: true },
    });
    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'cust-1' },
      data: { categoryId: 'cat-1' },
    });
    expect(session.id).toBe('session-1');
  });

  it('does not touch the customer when the workflow has no category', async () => {
    const { prisma, service } = setup();
    prisma.workflowSession.create.mockResolvedValue({
      id: 'session-2',
      workflow: { ...WORKFLOW, categoryId: null },
    });

    await service.startSession({
      clientId: 'client-1',
      conversationId: 'conv-1',
      workflowId: 'wf-1',
      customerId: 'cust-1',
    });

    expect(prisma.customer.update).not.toHaveBeenCalled();
  });

  it('carries collected data forward', async () => {
    const { prisma, service } = setup();

    await service.updateProgress('session-1', { country: 'Dubai' });

    expect(prisma.workflowSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { collectedData: { country: 'Dubai' } },
    });
  });

  it('stamps completedAt only on completion', async () => {
    const { prisma, service } = setup();

    await service.completeSession('session-1', 'completed');
    expect(prisma.workflowSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { status: 'completed', completedAt: expect.any(Date) },
    });

    await service.completeSession('session-1', 'abandoned');
    expect(prisma.workflowSession.update).toHaveBeenLastCalledWith({
      where: { id: 'session-1' },
      data: { status: 'abandoned', completedAt: null },
    });
  });
});
