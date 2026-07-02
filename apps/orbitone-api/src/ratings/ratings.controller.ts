import { Controller, Post, Body, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { RatingsService, RatingError } from "./ratings.service";
import { submitRatingSchema } from "./ratings.schemas";
import { AuthUser } from "../common/decorators/auth-user.decorator";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireRatingsGuard } from "../common/guards/require-ratings.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import type { AuthContext } from "../auth/types";

@Controller("v2/ratings")
@RequireModule("orbitone", "ratings")
@UseGuards(SessionAuthGuard, RequireRatingsGuard)
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post()
  async submit(
    @AuthUser() user: AuthContext,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = submitRatingSchema.safeParse(body);
    if (!input.success) {
      res.status(400);
      return { ok: false, error: "Invalid rating details." };
    }

    try {
      const rating = await this.ratingsService.submitRating(input.data, user);
      res.status(201);
      return { ok: true, data: rating };
    } catch (error) {
      if (error instanceof RatingError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }
}
