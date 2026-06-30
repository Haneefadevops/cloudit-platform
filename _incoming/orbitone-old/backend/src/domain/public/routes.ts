import { Router } from "express";
import { z } from "zod";
import {
  getPublicBookingProfile,
  getBookingSlots,
  createPublicBooking,
  BookingError
} from "../scheduling/service.js";
import { trackEvent } from "../analytics/service.js";

export const publicRouter = Router();

const slotsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  timezone: z.string().min(1).max(80).default("UTC")
});

const publicBookingInputSchema = z.object({
  guestName: z.string().trim().min(1).max(120),
  guestEmail: z.string().trim().email().max(254),
  guestCompany: z.string().trim().max(120).nullable().optional(),
  guestMessage: z.string().trim().max(1000).nullable().optional(),
  startAt: z.string().datetime(),
  timezone: z.string().min(1).max(80),
  source: z.enum(["profile", "connection", "event", "direct"]).optional()
});

publicRouter.get("/:profileSlug", async (req, res, next) => {
  try {
    const profile = await getPublicBookingProfile(req.params.profileSlug);
    if (!profile) {
      res.status(404).json({ ok: false, error: "Booking profile not found." });
      return;
    }
    await trackEvent(profile.profile.id, "booking_page_view");
    res.json({ ok: true, data: profile });
  } catch (error) {
    next(error);
  }
});

publicRouter.get("/:profileSlug/:meetingTypeSlug/slots", async (req, res, next) => {
  try {
    const query = slotsQuerySchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ ok: false, error: "Invalid slot lookup details." });
      return;
    }

    const now = new Date();
    const from = query.data.from ? new Date(query.data.from) : now;
    const to = query.data.to ? new Date(query.data.to) : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      res.status(400).json({ ok: false, error: "Invalid slot date range." });
      return;
    }

    if (to.getTime() - from.getTime() > 60 * 24 * 60 * 60 * 1000) {
      res.status(400).json({ ok: false, error: "Slot range cannot exceed 60 days." });
      return;
    }

    const result = await getBookingSlots(
      req.params.profileSlug,
      req.params.meetingTypeSlug,
      from,
      to,
      query.data.timezone
    );

    if (!result) {
      res.status(404).json({ ok: false, error: "Booking page not found." });
      return;
    }

    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
});

publicRouter.post("/:profileSlug/:meetingTypeSlug/bookings", async (req, res, next) => {
  try {
    const input = publicBookingInputSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid booking details." });
      return;
    }

    const confirmation = await createPublicBooking(req.params.profileSlug, req.params.meetingTypeSlug, input.data);
    await trackEvent(confirmation.profile.id, "booking_created");
    res.status(201).json({ ok: true, data: confirmation });
  } catch (error) {
    if (error instanceof BookingError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});
