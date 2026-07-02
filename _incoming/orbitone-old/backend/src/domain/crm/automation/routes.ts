import { Router } from "express";
import { requireUser, getUser } from "../../../middleware/auth.js";
import { requireCRM } from "../../../middleware/plan.js";
import type { AuthContext } from "../../../lib/auth.js";
import { getCRMScope } from "../custom-fields/service.js";
import {
  listAutomationRules,
  createAutomationRule,
  updateAutomationRule,
  deleteAutomationRule,
  AutomationError
} from "./service.js";
import { automationRuleInputSchema } from "./schemas.js";

export const automationRouter = Router();

automationRouter.use(requireUser, requireCRM);

function getScope(req: Parameters<typeof getUser>[0]) {
  return getCRMScope(getUser(req));
}

function getAuth(req: Parameters<typeof getUser>[0]): AuthContext {
  return getUser(req);
}

automationRouter.get("/", async (req, res, next) => {
  try {
    const rules = await listAutomationRules(getScope(req));
    res.json({ ok: true, data: rules });
  } catch (error) {
    next(error);
  }
});

automationRouter.post("/", async (req, res, next) => {
  try {
    const parsed = automationRuleInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "Invalid automation rule details." });
      return;
    }
    const rule = await createAutomationRule(getScope(req), getAuth(req), parsed.data);
    res.status(201).json({ ok: true, data: rule });
  } catch (error) {
    if (error instanceof AutomationError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

automationRouter.put("/:id", async (req, res, next) => {
  try {
    const parsed = automationRuleInputSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "Invalid automation rule details." });
      return;
    }
    const rule = await updateAutomationRule(getScope(req), req.params.id, parsed.data);
    if (!rule) {
      res.status(404).json({ ok: false, error: "Automation rule not found." });
      return;
    }
    res.json({ ok: true, data: rule });
  } catch (error) {
    if (error instanceof AutomationError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

automationRouter.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await deleteAutomationRule(getScope(req), req.params.id);
    if (!deleted) {
      res.status(404).json({ ok: false, error: "Automation rule not found." });
      return;
    }
    res.json({ ok: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});
