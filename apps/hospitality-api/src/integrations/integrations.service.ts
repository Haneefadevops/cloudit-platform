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

  async summary(organizationId: string) {
    const [connections, recentLogs] = await Promise.all([
      this.prisma.integrationConnection.findMany({
        where: { organizationId },
        include: { property: true },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.integrationSyncLog.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { connection: true },
      }),
    ]);

    const byProvider = connections.reduce(
      (totals, connection) => {
        const key = connection.provider;
        totals[key] = (totals[key] ?? 0) + 1;
        return totals;
      },
      {} as Record<string, number>,
    );

    const connectedChannels = connections
      .filter((connection) => connection.provider === "channel_manager")
      .map((connection) => {
        const config = connection.config as Record<string, unknown>;
        return {
          id: connection.id,
          name: connection.name,
          channel: String(config.channel ?? "channel_manager"),
          status: connection.status,
          propertyName: connection.property?.name ?? "All Properties",
          lastSyncAt: connection.lastSyncAt,
        };
      });

    const posConnections = connections
      .filter((connection) => connection.provider === "pos")
      .map((connection) => {
        const config = connection.config as Record<string, unknown>;
        return {
          id: connection.id,
          name: connection.name,
          system: String(config.system ?? "restaurant_pos"),
          outletId: String(config.outletId ?? ""),
          status: connection.status,
          propertyName: connection.property?.name ?? "All Properties",
          lastSyncAt: connection.lastSyncAt,
        };
      });

    return {
      summary: {
        totalConnections: connections.length,
        activeConnections: connections.filter(
          (connection) => connection.status === IntegrationStatus.active,
        ).length,
        channelManagers: byProvider.channel_manager ?? 0,
        posSystems: byProvider.pos ?? 0,
      },
      connectedChannels,
      posConnections,
      recentLogs: recentLogs.map((log) => ({
        id: log.id,
        provider: log.connection.provider,
        connectionName: log.connection.name,
        direction: log.direction,
        status: log.status,
        recordsPulled: log.recordsPulled,
        recordsPushed: log.recordsPushed,
        summary: log.summary,
        createdAt: log.createdAt,
      })),
    };
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
    const syncPlan = this.buildSyncPlan(connection.provider, dto);
    const log = await this.prisma.integrationSyncLog.create({
      data: {
        connection: { connect: { id } },
        organizationId,
        direction: dto.direction,
        status: IntegrationSyncStatus.success,
        recordsPulled: syncPlan.recordsPulled,
        recordsPushed: syncPlan.recordsPushed,
        summary: syncPlan.summary,
        payload: syncPlan.payload as any,
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

  private buildSyncPlan(
    provider: string,
    dto: SyncIntegrationDto,
  ): {
    recordsPulled: number;
    recordsPushed: number;
    summary: string;
    payload: Record<string, unknown>;
  } {
    const payload = dto.payload ?? {};
    const counts = payload.counts as Record<string, number> | undefined;

    if (provider === "channel_manager") {
      const reservations = counts?.reservations ?? (dto.direction === "push" ? 0 : 1);
      const rates = counts?.rates ?? (dto.direction === "pull" ? 0 : 1);
      const inventory = counts?.inventory ?? (dto.direction === "pull" ? 0 : 1);
      return {
        recordsPulled: dto.direction === "push" ? 0 : reservations,
        recordsPushed: dto.direction === "pull" ? 0 : rates + inventory,
        summary:
          "Channel manager sync prepared for Booking.com/Agoda reservations, rates, and inventory",
        payload: {
          ...payload,
          supportedChannels: ["booking_com", "agoda"],
          syncObjects: ["reservations", "rates", "inventory"],
        },
      };
    }

    const checks = counts?.checks ?? (dto.direction === "push" ? 0 : 1);
    const charges = counts?.charges ?? (dto.direction === "pull" ? 0 : 1);
    return {
      recordsPulled: dto.direction === "push" ? 0 : checks + charges,
      recordsPushed: dto.direction === "pull" ? 0 : 1,
      summary: "Restaurant POS sync prepared for outlet charges and room posting",
      payload: {
        ...payload,
        syncObjects: ["checks", "charges", "room_posting"],
      },
    };
  }
}
