import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Prisma } from '@prisma/client-platform';
import { PrismaService } from '../prisma/prisma.service';
import { ModulesService } from '../modules/modules.service';
import { EmailService } from '../email/email.service';
import { EventPublisherService } from '../events/event-publisher.service';
import { EventTypes } from '../events/event-types';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';

interface ProductProvisionResponse {
  tenantId: string;
  userId: string;
  inviteToken: string;
  setPasswordUrl: string;
}

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly modulesService: ModulesService,
    private readonly emailService: EmailService,
    private readonly eventPublisher: EventPublisherService,
    private readonly configService: ConfigService,
  ) {}

  async create(dto: CreateOnboardingDto) {
    const product = dto.product.trim().toLowerCase();
    const slug = dto.slug || this.slugify(dto.organizationName);
    const productDefinition = this.modulesService
      .getRegistry()
      .find((p) => p.key === product);
    if (!productDefinition || product === 'platform') {
      throw new BadRequestException('Unsupported onboarding product');
    }

    const enabledModules = (dto.modules || [])
      .filter((m) => m.enabled !== false)
      .map((m) => ({ product, moduleKey: m.moduleKey, enabled: true }));

    for (const module of enabledModules) {
      if (
        !productDefinition.modules.some((candidate) => {
          return candidate.key === module.moduleKey;
        })
      ) {
        throw new BadRequestException(
          `Invalid module: ${product}/${module.moduleKey}`,
        );
      }
    }

    const organization = await this.prisma.organization.create({
      data: {
        name: dto.organizationName,
        slug,
        settings: (dto.details || {}) as Prisma.InputJsonValue,
      },
    });

    await this.audit('organization.created', organization.id, organization.id, {
      product,
      slug,
    });
    await this.eventPublisher.publish(EventTypes.ORGANIZATION_CREATED, {
      organizationId: organization.id,
      organizationName: organization.name,
      product,
    });

    if (enabledModules.length > 0) {
      await this.modulesService.setModules(organization.id, enabledModules);
    }

    const pending = await this.prisma.organizationProvisioning.create({
      data: {
        orgId: organization.id,
        product,
        status: 'pending',
        invitedEmail: dto.superAdmin.email.toLowerCase().trim(),
      },
    });

    try {
      const provisioned = await this.provisionProduct({
        product,
        platformOrgId: organization.id,
        name: organization.name,
        slug: organization.slug,
        superAdminEmail: dto.superAdmin.email,
        superAdminFirstName: dto.superAdmin.firstName,
        superAdminLastName: dto.superAdmin.lastName,
      });

      const provisioning = await this.prisma.organizationProvisioning.update({
        where: { id: pending.id },
        data: {
          tenantId: provisioned.tenantId,
          userId: provisioned.userId,
          inviteToken: provisioned.inviteToken,
          setPasswordUrl: provisioned.setPasswordUrl,
          status: 'invite_sent',
          invitedAt: new Date(),
          failureReason: null,
        },
      });

      await this.emailService.sendInvite({
        to: dto.superAdmin.email,
        firstName: dto.superAdmin.firstName,
        organizationName: organization.name,
        productLabel: productDefinition.label,
        setPasswordUrl: provisioned.setPasswordUrl,
      });
      await this.audit('invite.sent', organization.id, provisioning.id, {
        product,
        email: dto.superAdmin.email,
      });
      await this.eventPublisher.publish(EventTypes.INVITE_SENT, {
        organizationId: organization.id,
        product,
        email: dto.superAdmin.email,
      });

      return this.findOne(organization.id);
    } catch (error) {
      const message = this.getErrorMessage(error);
      this.logger.error(`Provisioning failed for ${organization.id}: ${message}`);
      await this.prisma.organizationProvisioning.update({
        where: { id: pending.id },
        data: {
          status: 'failed',
          failureReason: message,
          retryCount: { increment: 1 },
        },
      });
      return this.findOne(organization.id);
    }
  }

  async findAll() {
    return this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        productModules: true,
        provisioning: true,
      },
    });
  }

  async findOne(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        productModules: true,
        provisioning: true,
        customFields: true,
        featureFlags: true,
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async resend(orgId: string, product?: string) {
    const provisioning = await this.getProvisioning(orgId, product);
    if (!provisioning.setPasswordUrl) {
      throw new BadRequestException('Invite link is not available');
    }
    if (provisioning.revokedAt) {
      throw new BadRequestException('Invite has been revoked');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) throw new NotFoundException('Organization not found');

    await this.emailService.sendInvite({
      to: provisioning.invitedEmail,
      firstName: provisioning.invitedEmail.split('@')[0],
      organizationName: org.name,
      productLabel: this.productLabel(provisioning.product),
      setPasswordUrl: provisioning.setPasswordUrl,
    });

    const updated = await this.prisma.organizationProvisioning.update({
      where: { id: provisioning.id },
      data: { status: 'invite_sent', invitedAt: new Date() },
    });
    await this.audit('invite.sent', orgId, updated.id, {
      product: updated.product,
      email: updated.invitedEmail,
      resent: true,
    });
    return updated;
  }

  async retry(orgId: string, product?: string) {
    const provisioning = await this.getProvisioning(orgId, product);
    if (!['failed', 'pending'].includes(provisioning.status)) {
      throw new BadRequestException('Only failed or pending provisioning can be retried');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const productDefinition = this.modulesService
      .getRegistry()
      .find((p) => p.key === provisioning.product);
    if (!productDefinition) {
      throw new BadRequestException('Unsupported onboarding product');
    }

    await this.prisma.organizationProvisioning.update({
      where: { id: provisioning.id },
      data: {
        status: 'pending',
        failureReason: null,
        retryCount: { increment: 1 },
      },
    });

    try {
      const emailName = provisioning.invitedEmail.split('@')[0] || 'Admin';
      const provisioned = await this.provisionProduct({
        product: provisioning.product,
        platformOrgId: org.id,
        name: org.name,
        slug: org.slug,
        superAdminEmail: provisioning.invitedEmail,
        superAdminFirstName: emailName,
        superAdminLastName: 'Admin',
      });

      const updated = await this.prisma.organizationProvisioning.update({
        where: { id: provisioning.id },
        data: {
          tenantId: provisioned.tenantId,
          userId: provisioned.userId,
          inviteToken: provisioned.inviteToken,
          setPasswordUrl: provisioned.setPasswordUrl,
          status: 'invite_sent',
          invitedAt: new Date(),
          failureReason: null,
        },
      });

      await this.emailService.sendInvite({
        to: provisioning.invitedEmail,
        firstName: emailName,
        organizationName: org.name,
        productLabel: productDefinition.label,
        setPasswordUrl: provisioned.setPasswordUrl,
      });
      await this.audit('invite.sent', org.id, updated.id, {
        product: updated.product,
        email: updated.invitedEmail,
        retried: true,
      });

      return updated;
    } catch (error) {
      const message = this.getErrorMessage(error);
      await this.prisma.organizationProvisioning.update({
        where: { id: provisioning.id },
        data: {
          status: 'failed',
          failureReason: message,
        },
      });
      throw new BadRequestException(message);
    }
  }

  async revoke(orgId: string, product?: string) {
    const provisioning = await this.getProvisioning(orgId, product);
    return this.prisma.organizationProvisioning.update({
      where: { id: provisioning.id },
      data: {
        status: 'revoked',
        revokedAt: new Date(),
        inviteToken: null,
        setPasswordUrl: null,
      },
    });
  }

  async markAccepted(input: {
    platformOrgId?: string;
    orgId?: string;
    product: string;
    tenantId?: string;
    userId?: string;
    email?: string;
  }) {
    const orgId = input.platformOrgId || input.orgId;
    if (!orgId || !input.product) {
      throw new BadRequestException('orgId and product are required');
    }

    const provisioning = await this.prisma.organizationProvisioning.update({
      where: {
        orgId_product: {
          orgId,
          product: input.product,
        },
      },
      data: {
        status: 'activated',
        activatedAt: new Date(),
        tenantId: input.tenantId,
        userId: input.userId,
      },
      include: { organization: true },
    });

    await this.audit('invite.accepted', orgId, provisioning.id, {
      product: input.product,
      email: input.email,
      tenantId: input.tenantId,
      userId: input.userId,
    });
    await this.eventPublisher.publish(EventTypes.INVITE_ACCEPTED, {
      organizationId: orgId,
      product: input.product,
      email: input.email,
      tenantId: input.tenantId,
      userId: input.userId,
    });
    await this.emailService.sendWelcome({
      to: provisioning.invitedEmail,
      firstName: provisioning.invitedEmail.split('@')[0],
      organizationName: provisioning.organization.name,
      productLabel: this.productLabel(input.product),
      loginUrl: this.productLoginUrl(input.product),
    });

    return { success: true, provisioning };
  }

  private async getProvisioning(orgId: string, product?: string) {
    const rows = await this.prisma.organizationProvisioning.findMany({
      where: {
        orgId,
        ...(product ? { product } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    if (rows.length === 0) {
      throw new NotFoundException('Provisioning record not found');
    }
    if (!product && rows.length > 1) {
      throw new BadRequestException('product is required for this organization');
    }
    return rows[0];
  }

  private async provisionProduct(input: {
    product: string;
    platformOrgId: string;
    name: string;
    slug: string;
    superAdminEmail: string;
    superAdminFirstName: string;
    superAdminLastName: string;
  }): Promise<ProductProvisionResponse> {
    const baseUrl = this.productApiUrl(input.product);
    const token = this.configService.get<string>('INTERNAL_API_TOKEN');
    if (!baseUrl || !token) {
      throw new BadRequestException(
        `${input.product} API URL or INTERNAL_API_TOKEN is not configured`,
      );
    }

    const response = await axios.post<{
      success?: boolean;
      data?: ProductProvisionResponse;
    }>(`${baseUrl.replace(/\/$/, '')}/internal/provision-tenant`, input, {
      headers: {
        'x-internal-token': token,
        Authorization: `Bearer ${token}`,
      },
      timeout: 15000,
    });
    const payload = (response.data?.data ?? response.data) as
      | ProductProvisionResponse
      | undefined;
    if (!payload || !payload.tenantId || !payload.inviteToken) {
      throw new BadRequestException('Product provisioning returned an invalid response');
    }
    return payload;
  }

  private productApiUrl(product: string): string | undefined {
    const normalized = product.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    return (
      this.configService.get<string>(`${normalized}_API_URL`) ||
      this.configService.get<string>(`PRODUCT_${normalized}_API_URL`)
    );
  }

  private productLoginUrl(product: string): string | undefined {
    const normalized = product.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    return this.configService.get<string>(`${normalized}_WEB_URL`);
  }

  private productLabel(product: string): string {
    return (
      this.modulesService.getRegistry().find((p) => p.key === product)?.label ||
      product
    );
  }

  private slugify(value: string): string {
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 72);
    return slug.length >= 3 ? slug : `org-${Date.now().toString(36)}`;
  }

  private async audit(
    action: string,
    orgId: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    await this.prisma.auditLog.create({
      data: {
        action,
        entityType: 'OrganizationProvisioning',
        entityId,
        orgId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  private getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      return (
        (error.response?.data as { message?: string; error?: string })?.message ||
        (error.response?.data as { message?: string; error?: string })?.error ||
        error.message
      );
    }
    return error instanceof Error ? error.message : 'Unknown provisioning error';
  }
}
