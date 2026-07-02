import { Router } from "express";
import { requireUser, getUser } from "../../middleware/auth.js";
import { requireRatings } from "../../middleware/plan.js";
import { submitRating, RatingError } from "./service.js";
import { submitRatingSchema } from "./schemas.js";

export const ratingsRouter = Router();

ratingsRouter.use(requireUser, requireRatings);

ratingsRouter.post("/", async (req, res, next) => {
  try {
    const input = submitRatingSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid rating details." });
      return;
    }

    const user = getUser(req);
    const rating = await submitRating(input.data, user);
    res.status(201).json({ ok: true, data: rating });
  } catch (error) {
    if (error instanceof RatingError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});
