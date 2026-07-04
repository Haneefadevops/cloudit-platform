import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SetFeatureFlagDto } from './dto/feature-flag.dto';

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string, product?: string) {
    return this.prisma.organizationFeatureFlag.findMany({
      where: { orgId, ...(product ? { product } : {}) },
      orderBy: [{ product: 'asc' }, { featureKey: 'asc' }],
    });
  }

  async set(orgId: string, dto: SetFeatureFlagDto) {
    await this.ensureOrganization(orgId);
    return this.prisma.organizationFeatureFlag.upsert({
      where: {
        orgId_product_featureKey: {
          orgId,
          product: dto.product,
          featureKey: dto.featureKey,
        },
      },
      create: {
        orgId,
        product: dto.product,
        featureKey: dto.featureKey,
        enabled: dto.enabled,
      },
      update: { enabled: dto.enabled },
    });
  }

  async remove(orgId: string, id: string) {
    const row = await this.prisma.organizationFeatureFlag.findFirst({
      where: { id, orgId },
    });
    if (!row) throw new NotFoundException('Feature flag not found');
    await this.prisma.organizationFeatureFlag.delete({ where: { id } });
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
