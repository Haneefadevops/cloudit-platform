import { Router } from "express";
import { requireUser, getUser } from "../../middleware/auth.js";
import { requireCRM } from "../../middleware/plan.js";
import { getCRMSummary } from "../customers/service.js";
import { customFieldsRouter } from "./custom-fields/routes.js";
import { pipelinesRouter } from "./pipelines/routes.js";
import { activityTypesRouter } from "./activity-types/routes.js";
import { templatesRouter } from "./templates/routes.js";
import { automationRouter } from "./automation/routes.js";
import { webhooksRouter } from "./webhooks/routes.js";

export const crmRouter = Router();

crmRouter.use(requireUser, requireCRM);

crmRouter.get("/summary", async (req, res, next) => {
  try {
    const user = getUser(req);
    const summary = await getCRMSummary({
      userId: user.id,
      organizationId: user.organizationId
    });
    res.json({ ok: true, data: summary });
  } catch (error) {
    next(error);
  }
});

crmRouter.use("/custom-fields", customFieldsRouter);
crmRouter.use("/pipelines", pipelinesRouter);
crmRouter.use("/activity-types", activityTypesRouter);
crmRouter.use("/templates", templatesRouter);
crmRouter.use("/automation", automationRouter);
crmRouter.use("/webhooks", webhooksRouter);
