import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getProductRegistry, isValidModule } from './modules.registry';

export interface ModuleToggleDto {
  product: string;
  moduleKey: string;
  enabled: boolean;
}

@Injectable()
export class ModulesService {
  constructor(private readonly prisma: PrismaService) {}

  getRegistry() {
    return getProductRegistry();
  }

  async findByOrganization(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const enabledRows = await this.prisma.organizationProductModule.findMany({
      where: { orgId, enabled: true },
    });

    const enabledSet = new Set(
      enabledRows.map((r) => `${r.product}:${r.moduleKey}`),
    );

    return getProductRegistry().map((product) => ({
      ...product,
      modules: product.modules.map((module) => ({
        ...module,
        enabled: enabledSet.has(`${product.key}:${module.key}`),
      })),
    }));
  }

  async setModules(orgId: string, toggles: ModuleToggleDto[]) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) throw new NotFoundException('Organization not found');

    for (const toggle of toggles) {
      if (!isValidModule(toggle.product, toggle.moduleKey)) {
        throw new BadRequestException(
          `Invalid module: ${toggle.product}/${toggle.moduleKey}`,
        );
      }
    }

    const upserts = toggles.map((toggle) =>
      this.prisma.organizationProductModule.upsert({
        where: {
          orgId_product_moduleKey: {
            orgId,
            product: toggle.product,
            moduleKey: toggle.moduleKey,
          },
        },
        create: {
          orgId,
          product: toggle.product,
          moduleKey: toggle.moduleKey,
          enabled: toggle.enabled,
        },
        update: {
          enabled: toggle.enabled,
        },
      }),
    );

    await this.prisma.$transaction(upserts);
    return this.findByOrganization(orgId);
  }

  async checkModule(
    orgId: string,
    product: string,
    moduleKey: string,
  ): Promise<boolean> {
    if (!isValidModule(product, moduleKey)) return false;

    const row = await this.prisma.organizationProductModule.findUnique({
      where: {
        orgId_product_moduleKey: {
          orgId,
          product,
          moduleKey,
        },
      },
    });

    return row?.enabled ?? false;
  }
}
