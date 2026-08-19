import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { StripeBillingProvider } from "./stripe-billing.provider";
import { StripeWebhookService } from "./stripe-webhook.service";
import { LemonSqueezyBillingProvider } from "./lemon-squeezy-billing.provider";
import { LemonSqueezyWebhookService } from "./lemon-squeezy-webhook.service";

@Module({
  controllers: [BillingController],
  providers: [
    BillingService,
    LemonSqueezyBillingProvider,
    LemonSqueezyWebhookService,
    StripeBillingProvider,
    StripeWebhookService,
  ],
  exports: [BillingService],
})
export class BillingModule {}
