import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { RequireCRMGuard } from "../../common/guards/require-crm.guard";
import { RequireModule } from "../../common/decorators/require-module.decorator";
import { AuthUser } from "../../common/decorators/auth-user.decorator";
import type { AuthContext } from "../../auth/types";
import { WebhooksService } from "./webhooks.service";
import { webhookSubscriptionInputSchema } from "./webhooks.schemas";

@ApiTags("crm-webhooks")
@Controller("v2/crm/webhooks")
@UseGuards(RequireCRMGuard)
@RequireModule("orbitone", "crm")
@ApiBearerAuth()
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  @ApiOperation({ summary: "List webhook subscriptions" })
  async findAll(@AuthUser() user: AuthContext) {
    const subscriptions =
      await this.webhooksService.listWebhookSubscriptions(user);
    return { ok: true, data: subscriptions };
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: "Create webhook subscription" })
  async create(@AuthUser() user: AuthContext, @Body() body: unknown) {
    const parsed = webhookSubscriptionInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid webhook details.");
    }
    const subscription = await this.webhooksService.createWebhookSubscription(
      user,
      parsed.data,
    );
    return { ok: true, data: subscription };
  }

  @Put(":id")
  @ApiOperation({ summary: "Update webhook subscription" })
  async update(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = webhookSubscriptionInputSchema.partial().safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid webhook details.");
    }
    const subscription = await this.webhooksService.updateWebhookSubscription(
      user,
      id,
      parsed.data,
    );
    if (!subscription) {
      throw new NotFoundException("Webhook not found.");
    }
    return { ok: true, data: subscription };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete webhook subscription" })
  async remove(@AuthUser() user: AuthContext, @Param("id") id: string) {
    const deleted = await this.webhooksService.deleteWebhookSubscription(
      user,
      id,
    );
    if (!deleted) {
      throw new NotFoundException("Webhook not found.");
    }
    return { ok: true, data: { deleted: true } };
  }

  @Get(":id/deliveries")
  @ApiOperation({ summary: "List webhook deliveries" })
  async deliveries(@AuthUser() user: AuthContext, @Param("id") id: string) {
    const deliveries = await this.webhooksService.listWebhookDeliveries(
      user,
      id,
    );
    return { ok: true, data: deliveries };
  }
}
