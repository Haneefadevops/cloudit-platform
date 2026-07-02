import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import {
  OrganizationsService,
  OrganizationError,
} from "./organizations.service";
import {
  organizationInputSchema,
  inviteStaffSchema,
  createStaffProfileSchema,
} from "./organizations.schemas";
import { AuthUser } from "../common/decorators/auth-user.decorator";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireOrgMemberGuard } from "../common/guards/require-org-member.guard";
import { RequireRoleGuard } from "../common/guards/require-role.guard";
import type { AuthContext } from "../auth/types";

@Controller("v2/organizations")
@UseGuards(SessionAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @UseGuards(new RequireRoleGuard(["freelancer"]))
  async create(
    @AuthUser() user: AuthContext,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = organizationInputSchema.safeParse(body);
    if (!input.success) {
      res.status(400);
      return { ok: false, error: "Invalid organization details." };
    }

    try {
      const organization = await this.organizationsService.createOrganization(
        user.id,
        input.data,
      );
      res.status(201);
      return { ok: true, data: organization };
    } catch (error) {
      if (error instanceof OrganizationError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }

  @Get("me")
  @UseGuards(RequireOrgMemberGuard)
  async getMe(
    @AuthUser() user: AuthContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const organization =
      await this.organizationsService.getOrganizationByUserId(user.id);
    if (!organization) {
      res.status(404);
      return { ok: false, error: "Organization not found." };
    }
    return { ok: true, data: organization };
  }

  @Put("me")
  @UseGuards(RequireOrgMemberGuard, new RequireRoleGuard(["admin"]))
  async updateMe(
    @AuthUser() user: AuthContext,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = organizationInputSchema.partial().safeParse(body);
    if (!input.success) {
      res.status(400);
      return { ok: false, error: "Invalid organization details." };
    }

    try {
      const organization = await this.organizationsService.updateOrganization(
        user.id,
        input.data,
      );
      if (!organization) {
        res.status(404);
        return { ok: false, error: "Organization not found." };
      }
      return { ok: true, data: organization };
    } catch (error) {
      if (error instanceof OrganizationError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }

  @Get("members")
  @UseGuards(RequireOrgMemberGuard)
  async getMembers(@AuthUser() user: AuthContext) {
    const members = await this.organizationsService.getOrganizationMembers(
      user.id,
    );
    return { ok: true, data: members };
  }

  @Post("invites")
  @UseGuards(RequireOrgMemberGuard, new RequireRoleGuard(["admin"]))
  async invite(
    @AuthUser() user: AuthContext,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = inviteStaffSchema.safeParse(body);
    if (!input.success) {
      res.status(400);
      return { ok: false, error: "Invalid invite details." };
    }

    try {
      const invite = await this.organizationsService.inviteStaff(
        user.id,
        input.data,
      );
      res.status(201);
      return { ok: true, data: invite };
    } catch (error) {
      if (error instanceof OrganizationError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }

  @Post("staff-profiles")
  @UseGuards(RequireOrgMemberGuard, new RequireRoleGuard(["admin"]))
  async createStaffProfile(
    @AuthUser() user: AuthContext,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = createStaffProfileSchema.safeParse(body);
    if (!input.success) {
      res.status(400);
      return { ok: false, error: "Invalid staff profile details." };
    }

    try {
      const result = await this.organizationsService.createStaffProfile(
        user.id,
        input.data,
      );
      res.status(201);
      return { ok: true, data: result };
    } catch (error) {
      if (error instanceof OrganizationError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }
}
