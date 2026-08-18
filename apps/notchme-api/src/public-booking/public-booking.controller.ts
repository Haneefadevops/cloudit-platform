import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";
import { Public } from "../common/decorators/public.decorator";
import {
  SchedulingService,
  BookingError,
} from "../scheduling/scheduling.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { z } from "zod";

const slotsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  timezone: z.string().min(1).max(80).default("UTC"),
});

const publicBookingInputSchema = z.object({
  guestName: z.string().trim().min(1).max(120),
  guestEmail: z.string().trim().email().max(254),
  guestCompany: z.string().trim().max(120).nullable().optional(),
  guestMessage: z.string().trim().max(1000).nullable().optional(),
  startAt: z.string().datetime(),
  timezone: z.string().min(1).max(80),
  source: z.enum(["profile", "connection", "event", "direct"]).optional(),
});

@Public()
@Controller("v2/book")
export class PublicBookingController {
  constructor(
    private readonly schedulingService: SchedulingService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @Get(":profileSlug")
  async getProfile(@Param("profileSlug") profileSlug: string) {
    const profile =
      await this.schedulingService.getPublicBookingProfile(profileSlug);
    if (!profile) {
      return { ok: false, error: "Booking profile not found." };
    }
    await this.analyticsService.trackEvent(
      profile.profile.id,
      "booking_page_view",
    );
    return { ok: true, data: profile };
  }

  @Get(":profileSlug/:meetingTypeSlug/slots")
  async getSlots(
    @Param("profileSlug") profileSlug: string,
    @Param("meetingTypeSlug") meetingTypeSlug: string,
    @Query() query: unknown,
  ) {
    const parsed = slotsQuerySchema.safeParse(query);
    if (!parsed.success) {
      return { ok: false, error: "Invalid slot lookup details." };
    }

    const now = new Date();
    const from = parsed.data.from ? new Date(parsed.data.from) : now;
    const to = parsed.data.to
      ? new Date(parsed.data.to)
      : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      to <= from
    ) {
      return { ok: false, error: "Invalid slot date range." };
    }

    if (to.getTime() - from.getTime() > 60 * 24 * 60 * 60 * 1000) {
      return { ok: false, error: "Slot range cannot exceed 60 days." };
    }

    const result = await this.schedulingService.getBookingSlots(
      profileSlug,
      meetingTypeSlug,
      from,
      to,
      parsed.data.timezone,
    );

    if (!result) {
      return { ok: false, error: "Booking page not found." };
    }

    return { ok: true, data: result };
  }

  @Post(":profileSlug/:meetingTypeSlug/bookings")
  async createBooking(
    @Param("profileSlug") profileSlug: string,
    @Param("meetingTypeSlug") meetingTypeSlug: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = publicBookingInputSchema.safeParse(body);
    if (!input.success) {
      return { ok: false, error: "Invalid booking details." };
    }

    try {
      const confirmation = await this.schedulingService.createPublicBooking(
        profileSlug,
        meetingTypeSlug,
        input.data,
      );
      await this.analyticsService.trackEvent(
        confirmation.profile.id,
        "booking_created",
      );
      res.status(HttpStatus.CREATED);
      return { ok: true, data: confirmation };
    } catch (error) {
      if (error instanceof BookingError) {
        res.status(error.statusCode);
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }
}
