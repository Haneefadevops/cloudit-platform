import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { StripeBillingProvider } from "./stripe-billing.provider";
import { StripeWebhookService } from "./stripe-webhook.service";

@Module({
  controllers: [BillingController],
  providers: [BillingService, StripeBillingProvider, StripeWebhookService],
  exports: [BillingService],
})
export class BillingModule {}
