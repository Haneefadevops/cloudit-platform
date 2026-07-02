import { Router } from "express";
import { requireUser, getUser } from "../../middleware/auth.js";
import { meetingTypeInputSchema, availabilityInputSchema } from "./schemas.js";
import {
  getMeetingTypes,
  createMeetingType,
  updateMeetingType,
  deleteMeetingType,
  getAvailability,
  updateAvailability,
  getBookings,
  getBooking,
  cancelBooking,
  approveBooking,
  declineBooking
} from "./service.js";

export const schedulingRouter = Router();

schedulingRouter.use(requireUser);

schedulingRouter.get("/meeting-types", async (req, res, next) => {
  try {
    const user = getUser(req);
    const meetingTypes = await getMeetingTypes(user.id);
    res.json({ ok: true, data: meetingTypes });
  } catch (error) {
    next(error);
  }
});

schedulingRouter.post("/meeting-types", async (req, res, next) => {
  try {
    const user = getUser(req);
    const input = meetingTypeInputSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid meeting type details." });
      return;
    }

    const meetingType = await createMeetingType(user.id, input.data);
    res.status(201).json({ ok: true, data: meetingType });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ ok: false, error: "A meeting type with this slug already exists." });
      return;
    }
    next(error);
  }
});

schedulingRouter.put("/meeting-types/:id", async (req, res, next) => {
  try {
    const user = getUser(req);
    const input = meetingTypeInputSchema.partial().safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid meeting type details." });
      return;
    }

    const meetingType = await updateMeetingType(user.id, req.params.id, input.data);
    if (!meetingType) {
      res.status(404).json({ ok: false, error: "Meeting type not found." });
      return;
    }
    res.json({ ok: true, data: meetingType });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ ok: false, error: "A meeting type with this slug already exists." });
      return;
    }
    next(error);
  }
});

schedulingRouter.delete("/meeting-types/:id", async (req, res, next) => {
  try {
    const user = getUser(req);
    const deleted = await deleteMeetingType(user.id, req.params.id);
    if (!deleted) {
      res.status(404).json({ ok: false, error: "Meeting type not found." });
      return;
    }
    res.json({ ok: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});

schedulingRouter.get("/availability", async (req, res, next) => {
  try {
    const user = getUser(req);
    const availability = await getAvailability(user.id);
    res.json({ ok: true, data: availability });
  } catch (error) {
    next(error);
  }
});

schedulingRouter.put("/availability", async (req, res, next) => {
  try {
    const user = getUser(req);
    const input = availabilityInputSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid availability details." });
      return;
    }

    const availability = await updateAvailability(user.id, input.data.rules, input.data.exceptions);
    res.json({ ok: true, data: availability });
  } catch (error) {
    next(error);
  }
});

schedulingRouter.get("/bookings", async (req, res, next) => {
  try {
    const user = getUser(req);
    const bookings = await getBookings(user.id);
    res.json({ ok: true, data: bookings });
  } catch (error) {
    next(error);
  }
});

schedulingRouter.get("/bookings/:id", async (req, res, next) => {
  try {
    const user = getUser(req);
    const booking = await getBooking(user.id, req.params.id);
    if (!booking) {
      res.status(404).json({ ok: false, error: "Booking not found." });
      return;
    }
    res.json({ ok: true, data: booking });
  } catch (error) {
    next(error);
  }
});

schedulingRouter.post("/bookings/:id/cancel", async (req, res, next) => {
  try {
    const user = getUser(req);
    const booking = await cancelBooking(user.id, req.params.id, req.body?.reason);
    if (!booking) {
      res.status(404).json({ ok: false, error: "Booking not found." });
      return;
    }
    res.json({ ok: true, data: booking });
  } catch (error) {
    next(error);
  }
});

schedulingRouter.post("/bookings/:id/approve", async (req, res, next) => {
  try {
    const user = getUser(req);
    const booking = await approveBooking(user.id, req.params.id);
    if (!booking) {
      res.status(404).json({ ok: false, error: "Booking not found or already approved." });
      return;
    }
    res.json({ ok: true, data: booking });
  } catch (error) {
    next(error);
  }
});

schedulingRouter.post("/bookings/:id/decline", async (req, res, next) => {
  try {
    const user = getUser(req);
    const booking = await declineBooking(user.id, req.params.id, req.body?.reason);
    if (!booking) {
      res.status(404).json({ ok: false, error: "Booking not found or already approved." });
      return;
    }
    res.json({ ok: true, data: booking });
  } catch (error) {
    next(error);
  }
});
