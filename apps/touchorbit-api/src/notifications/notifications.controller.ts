import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { z } from "zod";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { NotificationsService } from "./notifications.service";

const preferenceSchema = z.object({
  notification_type: z.string().optional(),
  type: z.string().optional(),
  email_enabled: z.boolean().optional(),
  push_enabled: z.boolean().optional(),
});

function normalizePreferences(body: unknown) {
  if (!body || typeof body !== "object") {
    return [];
  }

  const payload = body as { preferences?: unknown };
  if (Array.isArray(payload.preferences)) {
    return payload.preferences;
  }

  if (Array.isArray(body)) {
    return body;
  }

  return Object.entries(body as Record<string, unknown>)
    .filter(([, value]) => value && typeof value === "object")
    .map(([type, value]) => ({
      ...(value as Record<string, unknown>),
      notification_type: type,
    }));
}

@ApiTags("notifications")
@Controller("notifications")
@UseGuards(SessionAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @RequireModule("touchorbit", "notifications")
  @ApiOperation({ summary: "List notifications" })
  async findAll(
    @CurrentOrganization() organizationId: string,
    @CurrentUser("id") userId: string,
  ) {
    const rows = await this.notificationsService.findAll(
      organizationId,
      userId,
    );
    return { ok: true, data: rows };
  }

  @Patch(":id/read")
  @RequireModule("touchorbit", "notifications")
  @ApiOperation({ summary: "Mark notification as read" })
  async markRead(
    @CurrentOrganization() organizationId: string,
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
  ) {
    const row = await this.notificationsService.markRead(
      organizationId,
      userId,
      id,
    );
    return { ok: true, data: row };
  }

  @Delete(":id")
  @RequireModule("touchorbit", "notifications")
  @ApiOperation({ summary: "Delete notification" })
  async delete(
    @CurrentOrganization() organizationId: string,
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
  ) {
    const result = await this.notificationsService.delete(
      organizationId,
      userId,
      id,
    );
    return { ok: true, data: result };
  }

  @Post("preferences")
  @RequireModule("touchorbit", "notifications")
  @ApiOperation({ summary: "Upsert notification preferences" })
  async upsertPreferences(
    @CurrentOrganization() organizationId: string,
    @CurrentUser("id") userId: string,
    @Body() body: unknown,
  ) {
    const preferences = normalizePreferences(body)
      .map((preference) => preferenceSchema.safeParse(preference))
      .filter((result) => result.success)
      .map((result) => result.data)
      .map((preference) => ({
        notificationType: preference.notification_type ?? preference.type,
        emailEnabled: preference.email_enabled ?? true,
        pushEnabled: preference.push_enabled ?? true,
      }))
      .filter((preference) => Boolean(preference.notificationType));

    if (preferences.length === 0) {
      throw new BadRequestException("preferences are required");
    }

    const rows = await this.notificationsService.upsertPreferences(
      organizationId,
      userId,
      preferences as Array<{
        notificationType: string;
        emailEnabled: boolean;
        pushEnabled: boolean;
      }>,
    );
    return { ok: true, data: rows };
  }
}
