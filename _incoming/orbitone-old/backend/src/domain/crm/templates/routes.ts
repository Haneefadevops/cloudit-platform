import { Router } from "express";
import { requireUser, getUser } from "../../../middleware/auth.js";
import { requireCRM } from "../../../middleware/plan.js";
import type { AuthContext } from "../../../lib/auth.js";
import { getCRMScope } from "../custom-fields/service.js";
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  TemplateError
} from "./service.js";
import { templateInputSchema } from "./schemas.js";

export const templatesRouter = Router();

templatesRouter.use(requireUser, requireCRM);

function getScope(req: Parameters<typeof getUser>[0]) {
  return getCRMScope(getUser(req));
}

function getAuth(req: Parameters<typeof getUser>[0]): AuthContext {
  return getUser(req);
}

templatesRouter.get("/", async (req, res, next) => {
  try {
    const templates = await listTemplates(getScope(req));
    res.json({ ok: true, data: templates });
  } catch (error) {
    next(error);
  }
});

templatesRouter.post("/", async (req, res, next) => {
  try {
    const parsed = templateInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "Invalid template details." });
      return;
    }
    const template = await createTemplate(getScope(req), getAuth(req), parsed.data);
    res.status(201).json({ ok: true, data: template });
  } catch (error) {
    if (error instanceof TemplateError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

templatesRouter.put("/:id", async (req, res, next) => {
  try {
    const parsed = templateInputSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "Invalid template details." });
      return;
    }
    const template = await updateTemplate(getScope(req), req.params.id, parsed.data);
    if (!template) {
      res.status(404).json({ ok: false, error: "Template not found." });
      return;
    }
    res.json({ ok: true, data: template });
  } catch (error) {
    if (error instanceof TemplateError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

templatesRouter.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await deleteTemplate(getScope(req), req.params.id);
    if (!deleted) {
      res.status(404).json({ ok: false, error: "Template not found." });
      return;
    }
    res.json({ ok: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});
