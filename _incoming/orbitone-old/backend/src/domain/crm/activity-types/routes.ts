import { Router } from "express";
import { requireUser, getUser } from "../../../middleware/auth.js";
import { requireCRM } from "../../../middleware/plan.js";
import type { AuthContext } from "../../../lib/auth.js";
import { getCRMScope } from "../custom-fields/service.js";
import {
  listActivityTypes,
  createActivityType,
  updateActivityType,
  deleteActivityType,
  ActivityTypeError
} from "./service.js";
import { activityTypeInputSchema } from "./schemas.js";

export const activityTypesRouter = Router();

activityTypesRouter.use(requireUser, requireCRM);

function getScope(req: Parameters<typeof getUser>[0]) {
  return getCRMScope(getUser(req));
}

function getAuth(req: Parameters<typeof getUser>[0]): AuthContext {
  return getUser(req);
}

activityTypesRouter.get("/", async (req, res, next) => {
  try {
    const types = await listActivityTypes(getScope(req));
    res.json({ ok: true, data: types });
  } catch (error) {
    next(error);
  }
});

activityTypesRouter.post("/", async (req, res, next) => {
  try {
    const parsed = activityTypeInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "Invalid activity type details." });
      return;
    }
    const type = await createActivityType(getScope(req), getAuth(req), parsed.data);
    res.status(201).json({ ok: true, data: type });
  } catch (error) {
    if (error instanceof ActivityTypeError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

activityTypesRouter.put("/:id", async (req, res, next) => {
  try {
    const parsed = activityTypeInputSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "Invalid activity type details." });
      return;
    }
    const type = await updateActivityType(getScope(req), req.params.id, parsed.data);
    if (!type) {
      res.status(404).json({ ok: false, error: "Activity type not found." });
      return;
    }
    res.json({ ok: true, data: type });
  } catch (error) {
    if (error instanceof ActivityTypeError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

activityTypesRouter.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await deleteActivityType(getScope(req), req.params.id);
    if (!deleted) {
      res.status(404).json({ ok: false, error: "Activity type not found." });
      return;
    }
    res.json({ ok: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});
