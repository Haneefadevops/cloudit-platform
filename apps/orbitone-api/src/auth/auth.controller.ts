import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import type { Response, Request } from "express";
import { Public } from "../common/decorators/public.decorator";
import { AuthUser } from "../common/decorators/auth-user.decorator";
import { AuthService, AuthError } from "./auth.service";
import { SessionService } from "./session.service";
import type { AuthContext } from "./types";
import { DatabaseService } from "../database/database.service";
import {
  OrganizationsService,
  OrganizationError,
} from "../organizations/organizations.service";
import {
  mapUser,
  mapProfile,
  mapOrganization,
  buildAuthMe,
} from "../common/lib/mappers";
import { LoginInput, RegisterInput } from "../common/contracts/orbitone.v2";
import { z } from "zod";

const registerSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

const acceptInviteSchema = z.object({
  token: z.string().trim().min(1),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(1).max(120).optional(),
});

@Controller("v2/auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly databaseService: DatabaseService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  @Public()
  @Post("register")
  async register(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = registerSchema.safeParse(body);
    if (!input.success) {
      return { ok: false, error: "Invalid registration details." };
    }
    try {
      const user = await this.authService.register(input.data, res);
      return { ok: true, data: user };
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = loginSchema.safeParse(body);
    if (!input.success) {
      return { ok: false, error: "Invalid login details." };
    }
    try {
      const user = await this.authService.login(input.data, res);
      return { ok: true, data: user };
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req, res);
    return { ok: true, data: { loggedOut: true } };
  }

  @Public()
  @Post("accept-invite")
  async acceptInvite(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = acceptInviteSchema.safeParse(body);
    if (!input.success) {
      return { ok: false, error: "Invalid invite details." };
    }

    try {
      const user = await this.organizationsService.acceptInvite(
        input.data.token,
        input.data.password,
        input.data.fullName,
      );
      this.sessionService.setSessionCookie(
        res,
        await this.sessionService.signSession(user),
      );
      res.status(HttpStatus.CREATED);
      return { ok: true, data: user };
    } catch (error) {
      if (error instanceof OrganizationError || error instanceof AuthError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }

  @Get("me")
  async me(@AuthUser() auth: AuthContext) {
    const [profileResult, orgResult] = await Promise.all([
      this.databaseService.query("SELECT * FROM profiles WHERE user_id = $1", [
        auth.id,
      ]),
      auth.organizationId
        ? this.databaseService.query(
            "SELECT * FROM organizations WHERE id = $1",
            [auth.organizationId],
          )
        : Promise.resolve({ rows: [] }),
    ]);

    const profile = profileResult.rows[0]
      ? mapProfile(profileResult.rows[0])
      : null;
    const organization = orgResult.rows[0]
      ? mapOrganization(orgResult.rows[0])
      : null;

    return {
      ok: true,
      data: buildAuthMe({
        user: mapUser({
          id: auth.id,
          email: auth.email,
          full_name: auth.fullName,
          role: auth.role,
          organization_id: auth.organizationId,
          is_billing_contact: auth.isBillingContact,
          plan: auth.plan,
          created_at: auth.createdAt ? new Date(auth.createdAt) : undefined,
          updated_at: auth.updatedAt ? new Date(auth.updatedAt) : undefined,
        }),
        profile,
        organization,
      }),
    };
  }
}
