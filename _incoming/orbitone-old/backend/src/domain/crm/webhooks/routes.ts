import { Router } from "express";
import { requireUser, getUser } from "../../../middleware/auth.js";
import { requireCRM } from "../../../middleware/plan.js";
import type { AuthContext } from "../../../lib/auth.js";
import { getCRMScope } from "../custom-fields/service.js";
import {
  listWebhookSubscriptions,
  createWebhookSubscription,
  updateWebhookSubscription,
  deleteWebhookSubscription,
  listWebhookDeliveries,
  WebhookError
} from "./service.js";
import { webhookSubscriptionInputSchema } from "./schemas.js";

export const webhooksRouter = Router();

webhooksRouter.use(requireUser, requireCRM);

function getScope(req: Parameters<typeof getUser>[0]) {
  return getCRMScope(getUser(req));
}

function getAuth(req: Parameters<typeof getUser>[0]): AuthContext {
  return getUser(req);
}

webhooksRouter.get("/", async (req, res, next) => {
  try {
    const subscriptions = await listWebhookSubscriptions(getScope(req));
    res.json({ ok: true, data: subscriptions });
  } catch (error) {
    next(error);
  }
});

webhooksRouter.post("/", async (req, res, next) => {
  try {
    const parsed = webhookSubscriptionInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "Invalid webhook details." });
      return;
    }
    const subscription = await createWebhookSubscription(getScope(req), getAuth(req), parsed.data);
    res.status(201).json({ ok: true, data: subscription });
  } catch (error) {
    if (error instanceof WebhookError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

webhooksRouter.put("/:id", async (req, res, next) => {
  try {
    const parsed = webhookSubscriptionInputSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "Invalid webhook details." });
      return;
    }
    const subscription = await updateWebhookSubscription(getScope(req), req.params.id, parsed.data);
    if (!subscription) {
      res.status(404).json({ ok: false, error: "Webhook not found." });
      return;
    }
    res.json({ ok: true, data: subscription });
  } catch (error) {
    if (error instanceof WebhookError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

webhooksRouter.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await deleteWebhookSubscription(getScope(req), req.params.id);
    if (!deleted) {
      res.status(404).json({ ok: false, error: "Webhook not found." });
      return;
    }
    res.json({ ok: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});

webhooksRouter.get("/:id/deliveries", async (req, res, next) => {
  try {
    const deliveries = await listWebhookDeliveries(getScope(req), req.params.id);
    res.json({ ok: true, data: deliveries });
  } catch (error) {
    next(error);
  }
});
