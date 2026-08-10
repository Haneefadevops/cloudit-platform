import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';

@Injectable()
export class WorkflowsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(clientId: string) {
    return this.prisma.workflow.findMany({
      where: { clientId },
      include: { category: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async create(clientId: string, data: CreateWorkflowDto) {
    await this.ensureCategory(clientId, data.categoryId);
    return this.prisma.workflow.create({
      data: { clientId, ...data },
      include: { category: true },
    });
  }

  async update(clientId: string, id: string, data: UpdateWorkflowDto) {
    await this.findOne(clientId, id);
    if (data.categoryId !== undefined) {
      await this.ensureCategory(clientId, data.categoryId);
    }
    return this.prisma.workflow.update({
      where: { id },
      data,
      include: { category: true },
    });
  }

  async remove(clientId: string, id: string) {
    await this.findOne(clientId, id);
    return this.prisma.workflow.delete({ where: { id } });
  }

  private async findOne(clientId: string, id: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, clientId },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    return workflow;
  }

  private async ensureCategory(clientId: string, categoryId?: string) {
    if (!categoryId) return;
    const category = await this.prisma.customerCategory.findFirst({
      where: { id: categoryId, clientId },
    });
    if (!category) throw new NotFoundException('Customer category not found');
  }
}
