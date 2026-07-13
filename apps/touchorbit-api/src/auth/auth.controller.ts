import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import type { Response, Request } from "express";
import { Public } from "../common/decorators/public.decorator";
import { AuthUser } from "../common/decorators/auth-user.decorator";
import { AuthService, AuthError } from "./auth.service";
import { SessionService } from "./session.service";
import type { AuthContext } from "./types";
import { z } from "zod";

const registerSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  organizationName: z.string().trim().min(1).max(120),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

const setPasswordSchema = z.object({
  token: z.string().trim().min(1),
  password: z.string().min(8).max(128),
});

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
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
  @Post("set-password")
  @HttpCode(HttpStatus.OK)
  async setPassword(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = setPasswordSchema.safeParse(body);
    if (!input.success) {
      return { ok: false, error: "Invalid set-password details." };
    }
    try {
      const user = await this.authService.setPassword(input.data, res);
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
    @Req() req: Request,
  ) {
    const input = loginSchema.safeParse(body);
    if (!input.success) {
      return { ok: false, error: "Invalid login details." };
    }
    try {
      const { token, user } = await this.authService.login(
        input.data,
        res,
        req,
      );
      return { ok: true, data: { token, user } };
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

  @Get("me")
  me(@AuthUser() auth: AuthContext) {
    return {
      ok: true,
      data: auth,
    };
  }
}
