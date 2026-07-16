import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { AuthUser } from "../common/decorators/auth-user.decorator";
import type { AuthContext } from "../auth/types";
import { AnnouncementsService } from "./announcements.service";

const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(250),
  content: z.string().trim().min(1).max(10000),
  priority: z.enum(["normal", "important", "urgent"]).default("normal"),
});

@ApiTags("announcements")
@Controller("announcements")
@UseGuards(SessionAuthGuard)
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  @ApiOperation({ summary: "List organization announcements" })
  async findAll(@CurrentOrganization() organizationId: string) {
    const rows = await this.announcementsService.findAll(organizationId);
    return { ok: true, data: rows };
  }

  @Post()
  @ApiOperation({ summary: "Create an organization announcement" })
  async create(
    @CurrentOrganization() organizationId: string,
    @AuthUser() user: AuthContext,
    @Body() body: unknown,
  ) {
    const parsed = createAnnouncementSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid announcement payload");
    }
    const row = await this.announcementsService.create(
      organizationId,
      user.id,
      parsed.data,
    );
    return { ok: true, data: row };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete an organization announcement" })
  async remove(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ) {
    const row = await this.announcementsService.remove(organizationId, id);
    return { ok: true, data: row };
  }
}
