import { Router } from "express";
import { requireUser } from "../../middleware/auth.js";
import { requireCRM } from "../../middleware/plan.js";
import { getUser } from "../../middleware/auth.js";
import {
  listFeedbackRequests,
  createFeedbackRequest,
  getFeedbackByToken,
  markFeedbackSent,
  FeedbackError,
  type FeedbackContext,
} from "./service.js";
import { feedbackRequestInputSchema } from "./schemas.js";

export const feedbackRouter = Router();

function getContext(req: Parameters<typeof getUser>[0]): FeedbackContext {
  const user = getUser(req);
  return { userId: user.id, organizationId: user.organizationId };
}

feedbackRouter.get("/:token", async (req, res, next) => {
  try {
    const info = await getFeedbackByToken(req.params.token);
    if (!info) {
      res.status(404).json({ ok: false, error: "Feedback request not found." });
      return;
    }
    res.json({ ok: true, data: info });
  } catch (error) {
    next(error);
  }
});

feedbackRouter.post("/:token/sent", async (req, res, next) => {
  try {
    const updated = await markFeedbackSent(req.params.token);
    if (!updated) {
      res.status(404).json({ ok: false, error: "Feedback request not found or already sent." });
      return;
    }
    res.json({ ok: true, data: { sent: true } });
  } catch (error) {
    next(error);
  }
});

export function addCustomerFeedbackRoutes(router: Router) {
  router.use(requireUser, requireCRM);

  router.get("/:id/feedback", async (req, res, next) => {
    try {
      const requests = await listFeedbackRequests(getContext(req), req.params.id);
      res.json({ ok: true, data: requests });
    } catch (error) {
      if (error instanceof FeedbackError) {
        res.status(error.statusCode).json({ ok: false, error: error.message });
        return;
      }
      next(error);
    }
  });

  router.post("/:id/feedback", async (req, res, next) => {
    try {
      const input = feedbackRequestInputSchema.safeParse(req.body);
      if (!input.success) {
        res.status(400).json({ ok: false, error: "Invalid feedback details." });
        return;
      }
      const request = await createFeedbackRequest(getContext(req), req.params.id, input.data);
      res.status(201).json({ ok: true, data: request });
    } catch (error) {
      if (error instanceof FeedbackError) {
        res.status(error.statusCode).json({ ok: false, error: error.message });
        return;
      }
      next(error);
    }
  });
}
