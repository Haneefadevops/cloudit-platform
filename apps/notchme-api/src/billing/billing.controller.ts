import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  type RawBodyRequest,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthUser } from "../common/decorators/auth-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import type { AuthContext } from "../auth/types";
import { BillingService } from "./billing.service";
import { checkoutSchema } from "./billing.schemas";
import { StripeWebhookService } from "./stripe-webhook.service";

@Controller("v2/billing")
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly webhooks: StripeWebhookService,
  ) {}

  @Get("status")
  async status(@AuthUser() user: AuthContext) {
    return { ok: true, data: await this.billing.status(user) };
  }

  @Post("checkout")
  async checkout(@AuthUser() user: AuthContext, @Req() request: Request) {
    const input = checkoutSchema.safeParse(request.body);
    if (!input.success) {
      throw new BadRequestException("Invalid checkout selection.");
    }
    return { ok: true, data: await this.billing.checkout(user, input.data) };
  }

  @Post("portal")
  async portal(@AuthUser() user: AuthContext) {
    return { ok: true, data: await this.billing.portal(user) };
  }

  @Post("webhook")
  @Public()
  @HttpCode(200)
  async webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string | undefined,
  ) {
    const event = this.webhooks.verify(request.rawBody, signature);
    const result = await this.webhooks.process(event);
    return { ok: true, data: { received: true, duplicate: result.duplicate } };
  }
}
