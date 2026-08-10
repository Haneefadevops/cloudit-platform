import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * State store for AI workflows. The AI does the thinking (detection and
 * step-following via prompt injection in AiService); this service owns the
 * truth: which conversation is running which workflow and what data has
 * been collected so far.
 */
@Injectable()
export class WorkflowRuntimeService {
  private readonly logger = new Logger(WorkflowRuntimeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Active workflows for a client, in match-priority order. */
  findActiveWorkflows(clientId: string) {
    return this.prisma.workflow.findMany({
      where: { clientId, isActive: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  /** The workflow session currently running on a conversation, if any. */
  findActiveSession(conversationId: string) {
    return this.prisma.workflowSession.findFirst({
      where: { conversationId, status: 'active' },
      include: { workflow: true },
    });
  }

  /**
   * Starts a workflow session and qualifies the customer: entering a
   * workflow assigns the workflow's category (latest intent wins).
   */
  async startSession(input: {
    clientId: string;
    conversationId: string;
    workflowId: string;
    customerId: string;
  }) {
    const session = await this.prisma.workflowSession.create({
      data: {
        clientId: input.clientId,
        conversationId: input.conversationId,
        workflowId: input.workflowId,
      },
      include: { workflow: true },
    });

    if (session.workflow.categoryId) {
      await this.prisma.customer.update({
        where: { id: input.customerId },
        data: { categoryId: session.workflow.categoryId },
      });
    }

    this.logger.log(
      `Workflow "${session.workflow.name}" started on conversation ${input.conversationId}`,
    );
    return session;
  }

  /** Carries forward the data the AI has collected so far. */
  updateProgress(sessionId: string, collectedData: Record<string, unknown>) {
    return this.prisma.workflowSession.update({
      where: { id: sessionId },
      data: { collectedData: collectedData as Prisma.InputJsonValue },
    });
  }

  completeSession(sessionId: string, status: 'completed' | 'abandoned') {
    return this.prisma.workflowSession.update({
      where: { id: sessionId },
      data: {
        status,
        completedAt: status === 'completed' ? new Date() : null,
      },
    });
  }
}
