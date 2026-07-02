import { Router } from "express";
import { requireUser, getUser } from "../../middleware/auth.js";
import { getDashboardSummary } from "./service.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireUser);

dashboardRouter.get("/summary", async (req, res, next) => {
  try {
    const user = getUser(req);
    const summary = await getDashboardSummary(user);
    res.json({ ok: true, data: summary });
  } catch (error) {
    next(error);
  }
});
