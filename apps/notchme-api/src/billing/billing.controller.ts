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
import { LemonSqueezyWebhookService } from "./lemon-squeezy-webhook.service";

@Controller("v2/billing")
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly stripeWebhooks: StripeWebhookService,
    private readonly lemonSqueezyWebhooks: LemonSqueezyWebhookService,
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

  @Post("webhooks/lemon-squeezy")
  @Public()
  @HttpCode(200)
  async lemonSqueezyWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers("x-signature") signature: string | undefined,
    @Headers("x-event-name") eventName: string | undefined,
  ) {
    const event = this.lemonSqueezyWebhooks.verify(
      request.rawBody,
      signature,
      eventName,
    );
    const result = await this.lemonSqueezyWebhooks.process(event);
    return { ok: true, data: { received: true, duplicate: result.duplicate } };
  }

  @Post("webhooks/stripe")
  @Public()
  @HttpCode(200)
  async stripeWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string | undefined,
  ) {
    const event = this.stripeWebhooks.verify(request.rawBody, signature);
    const result = await this.stripeWebhooks.process(event);
    return { ok: true, data: { received: true, duplicate: result.duplicate } };
  }
}
