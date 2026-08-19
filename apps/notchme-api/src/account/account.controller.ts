import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Res,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { AuthUser } from "../common/decorators/auth-user.decorator";
import type { AuthContext } from "../auth/types";
import { SessionService } from "../auth/session.service";
import { AccountService } from "./account.service";
import { deleteAccountSchema } from "./account.schemas";

@Controller("v2/account")
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly sessions: SessionService,
  ) {}

  @Get("export")
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async export(@AuthUser() user: AuthContext) {
    return { ok: true, data: await this.account.export(user) };
  }

  @Delete()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async remove(
    @AuthUser() user: AuthContext,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const input = deleteAccountSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException("Invalid account deletion confirmation.");
    }
    await this.account.remove(user, input.data);
    this.sessions.clearSessionCookie(response);
    return { ok: true, data: { deleted: true } };
  }
}
