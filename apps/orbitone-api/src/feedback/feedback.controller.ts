import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import {
  FeedbackService,
  FeedbackError,
  type FeedbackContext,
} from "./feedback.service";
import { feedbackRequestInputSchema } from "./feedback.schemas";
import { AuthUser } from "../common/decorators/auth-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireCRMGuard } from "../common/guards/require-crm.guard";
import type { AuthContext } from "../auth/types";

@Controller("v2/feedback")
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  private getContext(user: AuthContext): FeedbackContext {
    return { userId: user.id, organizationId: user.organizationId };
  }

  @Get(":token")
  @Public()
  async getByToken(
    @Param("token") token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const info = await this.feedbackService.getFeedbackByToken(token);
    if (!info) {
      res.status(404);
      return { ok: false, error: "Feedback request not found." };
    }
    return { ok: true, data: info };
  }

  @Post(":token/sent")
  @Public()
  async markSent(
    @Param("token") token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const updated = await this.feedbackService.markFeedbackSent(token);
    if (!updated) {
      res.status(404);
      return {
        ok: false,
        error: "Feedback request not found or already sent.",
      };
    }
    return { ok: true, data: { sent: true } };
  }

  @Get("customers/:id/feedback")
  @UseGuards(SessionAuthGuard, RequireCRMGuard)
  async listForCustomer(
    @AuthUser() user: AuthContext,
    @Param("id") customerId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const requests = await this.feedbackService.listFeedbackRequests(
        this.getContext(user),
        customerId,
      );
      return { ok: true, data: requests };
    } catch (error) {
      if (error instanceof FeedbackError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }

  @Post("customers/:id/feedback")
  @UseGuards(SessionAuthGuard, RequireCRMGuard)
  async createForCustomer(
    @AuthUser() user: AuthContext,
    @Param("id") customerId: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = feedbackRequestInputSchema.safeParse(body);
    if (!input.success) {
      res.status(400);
      return { ok: false, error: "Invalid feedback details." };
    }

    try {
      const request = await this.feedbackService.createFeedbackRequest(
        this.getContext(user),
        customerId,
        input.data,
      );
      res.status(201);
      return { ok: true, data: request };
    } catch (error) {
      if (error instanceof FeedbackError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }
}
