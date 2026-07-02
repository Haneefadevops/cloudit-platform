import { Router } from "express";
import { requireUser, getUser } from "../../middleware/auth.js";
import { getProfileMetrics, getUsageSummary } from "./service.js";
import { pool } from "../../db/postgres.js";
import { getPlanLimit } from "../../middleware/plan.js";
import { getProfilePlan } from "../scheduling/service.js";

export const analyticsRouter = Router();

analyticsRouter.post("/events", (_req, res) => {
  res.status(204).send();
});

analyticsRouter.use(requireUser);

analyticsRouter.get("/me", async (req, res, next) => {
  try {
    const user = getUser(req);
    const profileResult = await pool.query("SELECT id FROM profiles WHERE user_id = $1", [user.id]);
    const profileId = profileResult.rows[0]?.id;

    if (!profileId) {
      res.status(404).json({ ok: false, error: "No profile found." });
      return;
    }

    const [metrics, plan] = await Promise.all([
      getProfileMetrics(profileId),
      getProfilePlan(user.id)
    ]);

    const usage = await getUsageSummary(profileId, getPlanLimit(plan).maxBookingsPerWeek);

    res.json({
      ok: true,
      data: {
        profileMetrics: metrics,
        usage
      }
    });
  } catch (error) {
    next(error);
  }
});
