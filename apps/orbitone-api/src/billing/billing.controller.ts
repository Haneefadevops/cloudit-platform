import { Controller, Post, Body, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { BillingService, BillingError } from "./billing.service";
import { upgradePlanSchema } from "./billing.schemas";
import { AuthUser } from "../common/decorators/auth-user.decorator";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import type { AuthContext } from "../auth/types";

@Controller("v2/billing")
@UseGuards(SessionAuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post("upgrade")
  async upgrade(
    @AuthUser() user: AuthContext,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = upgradePlanSchema.safeParse(body);
    if (!input.success) {
      res.status(400);
      return { ok: false, error: "Invalid plan upgrade request." };
    }

    try {
      const updatedUser = await this.billingService.upgradeUserPlan(
        user.id,
        input.data.plan,
      );
      return { ok: true, data: updatedUser };
    } catch (error) {
      if (error instanceof BillingError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }
}
