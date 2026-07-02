import { Router } from "express";
import { requireUser, getUser } from "../../../middleware/auth.js";
import { requireCRM } from "../../../middleware/plan.js";
import {
  listCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  getCRMScope,
  CustomFieldError
} from "./service.js";
import { customFieldInputSchema } from "./schemas.js";

export const customFieldsRouter = Router();

customFieldsRouter.use(requireUser, requireCRM);

function getScope(req: Parameters<typeof getUser>[0]) {
  return getCRMScope(getUser(req));
}

customFieldsRouter.get("/", async (req, res, next) => {
  try {
    const fields = await listCustomFields(getScope(req));
    res.json({ ok: true, data: fields });
  } catch (error) {
    next(error);
  }
});

customFieldsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = customFieldInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "Invalid custom field details." });
      return;
    }
    const user = getUser(req);
    const field = await createCustomField(getScope(req), user, parsed.data);
    res.status(201).json({ ok: true, data: field });
  } catch (error) {
    if (error instanceof CustomFieldError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

customFieldsRouter.put("/:id", async (req, res, next) => {
  try {
    const parsed = customFieldInputSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "Invalid custom field details." });
      return;
    }
    const field = await updateCustomField(getScope(req), req.params.id, parsed.data);
    if (!field) {
      res.status(404).json({ ok: false, error: "Custom field not found." });
      return;
    }
    res.json({ ok: true, data: field });
  } catch (error) {
    if (error instanceof CustomFieldError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

customFieldsRouter.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await deleteCustomField(getScope(req), req.params.id);
    if (!deleted) {
      res.status(404).json({ ok: false, error: "Custom field not found." });
      return;
    }
    res.json({ ok: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});
