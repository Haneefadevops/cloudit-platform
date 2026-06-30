import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  IntegrationStatus,
  IntegrationSyncStatus,
} from "@prisma/client-hospitality";
import { PrismaService } from "../prisma/prisma.service";
import { CreateIntegrationDto } from "./dto/create-integration.dto";
import { SyncIntegrationDto } from "./dto/sync-integration.dto";
import { UpdateIntegrationDto } from "./dto/update-integration.dto";

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    organizationId: string,
    filters?: { provider?: string; propertyId?: string },
  ) {
    return this.prisma.integrationConnection.findMany({
      where: {
        organizationId,
        ...(filters?.provider ? { provider: filters.provider as any } : {}),
        ...(filters?.propertyId ? { propertyId: filters.propertyId } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        property: true,
        syncLogs: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });
  }

  async findOne(id: string, organizationId: string) {
    const connection = await this.prisma.integrationConnection.findFirst({
      where: { id, organizationId },
      include: {
        property: true,
        syncLogs: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!connection) {
      throw new NotFoundException("Integration connection not found");
    }
    return connection;
  }

  async create(organizationId: string, dto: CreateIntegrationDto) {
    await this.validateProperty(organizationId, dto.propertyId);
    return this.prisma.integrationConnection.create({
      data: {
        organizationId,
        provider: dto.provider,
        name: dto.name,
        status: dto.status ?? IntegrationStatus.active,
        endpointUrl: dto.endpointUrl,
        config: (dto.config ?? {}) as any,
        ...(dto.propertyId
          ? { property: { connect: { id: dto.propertyId } } }
          : {}),
      },
      include: { property: true, syncLogs: true },
    });
  }

  async update(id: string, organizationId: string, dto: UpdateIntegrationDto) {
    await this.findOne(id, organizationId);
    await this.validateProperty(organizationId, dto.propertyId);
    return this.prisma.integrationConnection.update({
      where: { id },
      data: {
        provider: dto.provider,
        name: dto.name,
        status: dto.status,
        endpointUrl: dto.endpointUrl,
        config: dto.config as any,
        ...(dto.propertyId
          ? { property: { connect: { id: dto.propertyId } } }
          : {}),
      },
      include: { property: true, syncLogs: { orderBy: { createdAt: "desc" } } },
    });
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.integrationConnection.delete({ where: { id } });
  }

  async sync(id: string, organizationId: string, dto: SyncIntegrationDto) {
    const connection = await this.findOne(id, organizationId);
    if (connection.status !== IntegrationStatus.active) {
      throw new BadRequestException("Integration connection is not active");
    }

    const now = new Date();
    const log = await this.prisma.integrationSyncLog.create({
      data: {
        connection: { connect: { id } },
        organizationId,
        direction: dto.direction,
        status: IntegrationSyncStatus.success,
        recordsPulled: dto.direction === "push" ? 0 : 1,
        recordsPushed: dto.direction === "pull" ? 0 : 1,
        summary: `${connection.provider} ${dto.direction} sync queued`,
        payload: (dto.payload ?? {}) as any,
      },
    });

    await this.prisma.integrationConnection.update({
      where: { id },
      data: { lastSyncAt: now, status: IntegrationStatus.active },
    });

    return log;
  }

  async logs(id: string, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.integrationSyncLog.findMany({
      where: { connectionId: id, organizationId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  private async validateProperty(organizationId: string, propertyId?: string) {
    if (!propertyId) return;
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId },
    });
    if (!property) {
      throw new BadRequestException("Property not found or access denied");
    }
  }
}
