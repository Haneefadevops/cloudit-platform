import { Router } from "express";
import { requireUser, getUser } from "../../middleware/auth.js";
import { upgradePlanSchema } from "./schemas.js";
import { upgradeUserPlan, BillingError } from "./service.js";

export const billingRouter = Router();

billingRouter.use(requireUser);

billingRouter.post("/upgrade", async (req, res, next) => {
  try {
    const user = getUser(req);
    const input = upgradePlanSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid plan upgrade request." });
      return;
    }

    const updatedUser = await upgradeUserPlan(user.id, input.data.plan);
    res.json({ ok: true, data: updatedUser });
  } catch (error) {
    if (error instanceof BillingError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});
