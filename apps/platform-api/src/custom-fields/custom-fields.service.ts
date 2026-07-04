import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client-platform';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertCustomFieldDto } from './dto/custom-field.dto';

@Injectable()
export class CustomFieldsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string, product?: string, entity?: string) {
    return this.prisma.organizationCustomField.findMany({
      where: {
        orgId,
        ...(product ? { product } : {}),
        ...(entity ? { entity } : {}),
      },
      orderBy: [{ entity: 'asc' }, { order: 'asc' }, { fieldLabel: 'asc' }],
    });
  }

  async upsert(orgId: string, dto: UpsertCustomFieldDto) {
    await this.ensureOrganization(orgId);
    return this.prisma.organizationCustomField.upsert({
      where: {
        orgId_product_entity_fieldKey: {
          orgId,
          product: dto.product,
          entity: dto.entity,
          fieldKey: dto.fieldKey,
        },
      },
      create: {
        orgId,
        product: dto.product,
        module: dto.module,
        entity: dto.entity,
        fieldKey: dto.fieldKey,
        fieldLabel: dto.fieldLabel,
        fieldType: dto.fieldType,
        options: dto.options as Prisma.InputJsonValue | undefined,
        required: dto.required ?? false,
        order: dto.order ?? 0,
        isActive: dto.isActive ?? true,
      },
      update: {
        module: dto.module,
        fieldLabel: dto.fieldLabel,
        fieldType: dto.fieldType,
        options: dto.options as Prisma.InputJsonValue | undefined,
        required: dto.required,
        order: dto.order,
        isActive: dto.isActive,
      },
    });
  }

  async remove(orgId: string, id: string) {
    const row = await this.prisma.organizationCustomField.findFirst({
      where: { id, orgId },
    });
    if (!row) throw new NotFoundException('Custom field not found');
    await this.prisma.organizationCustomField.delete({ where: { id } });
    return { success: true };
  }

  private async ensureOrganization(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    });
    if (!org) throw new NotFoundException('Organization not found');
  }
}
