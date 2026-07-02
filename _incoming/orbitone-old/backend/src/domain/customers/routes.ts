import { Router } from "express";
import { requireUser, getUser } from "../../middleware/auth.js";
import { requireCRM } from "../../middleware/plan.js";
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  moveCustomerStage,
  listPipelineStageHistory,
  listActivities,
  createActivity,
  deleteActivity,
  listFollowUps,
  createFollowUp,
  completeFollowUp,
  deleteFollowUp,
  getCRMSummary,
  updateLifecycle,
  assignCustomer,
  closeCustomer,
  listStageHistory,
  CustomerError,
  type CustomerListFilters,
  type CustomerContext
} from "./service.js";
import {
  customerInputSchema,
  customerLifecycleInputSchema,
  customerAssignInputSchema,
  customerCloseInputSchema,
  customerActivityInputSchema,
  customerFollowUpInputSchema,
  customerStageMoveInputSchema,
  bulkActionInputSchema,
  customerMergeInputSchema,
  customerImportInputSchema,
  type CustomerInput
} from "./schemas.js";
import {
  bulkAction,
  findDuplicateGroups,
  mergeCustomers,
  importCustomers
} from "../crm/bulk/service.js";

export const customersRouter = Router();

customersRouter.use(requireUser, requireCRM);

function getCustomerContext(req: Parameters<typeof getUser>[0]): CustomerContext {
  const user = getUser(req);
  return {
    userId: user.id,
    organizationId: user.organizationId
  };
}

customersRouter.get("/summary", async (req, res, next) => {
  try {
    const summary = await getCRMSummary(getCustomerContext(req));
    res.json({ ok: true, data: summary });
  } catch (error) {
    next(error);
  }
});

customersRouter.get("/", async (req, res, next) => {
  try {
    const filters: CustomerListFilters = {
      search: req.query.search as string | undefined,
      lifecycleStage: req.query.lifecycleStage as CustomerListFilters["lifecycleStage"],
      priority: req.query.priority as CustomerListFilters["priority"],
      assignedTo: req.query.assignedTo as string | undefined,
      source: req.query.source as CustomerListFilters["source"],
      outcome: req.query.outcome as CustomerListFilters["outcome"],
      sortBy: req.query.sortBy as CustomerListFilters["sortBy"],
      sortOrder: req.query.sortOrder as "asc" | "desc" | undefined
    };
    const customers = await listCustomers(getCustomerContext(req), filters);
    res.json({ ok: true, data: customers });
  } catch (error) {
    next(error);
  }
});

customersRouter.post("/", async (req, res, next) => {
  try {
    const input = customerInputSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid customer details." });
      return;
    }
    const customer = await createCustomer(getCustomerContext(req), input.data as any);
    res.status(201).json({ ok: true, data: customer });
  } catch (error) {
    if (error instanceof CustomerError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

customersRouter.get("/:id", async (req, res, next) => {
  try {
    const customer = await getCustomer({ ...getCustomerContext(req), customerId: req.params.id });
    if (!customer) {
      res.status(404).json({ ok: false, error: "Customer not found." });
      return;
    }
    res.json({ ok: true, data: customer });
  } catch (error) {
    next(error);
  }
});

customersRouter.put("/:id", async (req, res, next) => {
  try {
    const input = customerInputSchema.partial().safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid customer details." });
      return;
    }
    const customer = await updateCustomer(getCustomerContext(req), req.params.id, input.data as any);
    if (!customer) {
      res.status(404).json({ ok: false, error: "Customer not found." });
      return;
    }
    res.json({ ok: true, data: customer });
  } catch (error) {
    if (error instanceof CustomerError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

customersRouter.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await deleteCustomer(getCustomerContext(req), req.params.id);
    if (!deleted) {
      res.status(404).json({ ok: false, error: "Customer not found." });
      return;
    }
    res.json({ ok: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});

customersRouter.put("/:id/lifecycle", async (req, res, next) => {
  try {
    const input = customerLifecycleInputSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid lifecycle details." });
      return;
    }
    const customer = await updateLifecycle(
      getCustomerContext(req),
      req.params.id,
      input.data.lifecycleStage,
      input.data.note
    );
    if (!customer) {
      res.status(404).json({ ok: false, error: "Customer not found." });
      return;
    }
    res.json({ ok: true, data: customer });
  } catch (error) {
    next(error);
  }
});

customersRouter.put("/:id/assign", async (req, res, next) => {
  try {
    const input = customerAssignInputSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid assign details." });
      return;
    }
    const customer = await assignCustomer(getCustomerContext(req), req.params.id, input.data.assignedToUserId);
    if (!customer) {
      res.status(404).json({ ok: false, error: "Customer not found." });
      return;
    }
    res.json({ ok: true, data: customer });
  } catch (error) {
    if (error instanceof CustomerError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

customersRouter.put("/:id/close", async (req, res, next) => {
  try {
    const input = customerCloseInputSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid close details." });
      return;
    }
    const customer = await closeCustomer(
      getCustomerContext(req),
      req.params.id,
      input.data.outcome,
      input.data.closedReason
    );
    if (!customer) {
      res.status(404).json({ ok: false, error: "Customer not found." });
      return;
    }
    res.json({ ok: true, data: customer });
  } catch (error) {
    next(error);
  }
});

customersRouter.get("/:id/history", async (req, res, next) => {
  try {
    const history = await listStageHistory(getCustomerContext(req), req.params.id);
    res.json({ ok: true, data: history });
  } catch (error) {
    if (error instanceof CustomerError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

customersRouter.get("/:id/stage-history", async (req, res, next) => {
  try {
    const history = await listPipelineStageHistory(getCustomerContext(req), req.params.id);
    res.json({ ok: true, data: history });
  } catch (error) {
    if (error instanceof CustomerError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

customersRouter.put("/:id/stage", async (req, res, next) => {
  try {
    const input = customerStageMoveInputSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid stage move details." });
      return;
    }
    const customer = await moveCustomerStage(
      getCustomerContext(req),
      req.params.id,
      input.data.pipelineStageId,
      input.data.note
    );
    if (!customer) {
      res.status(404).json({ ok: false, error: "Customer not found." });
      return;
    }
    res.json({ ok: true, data: customer });
  } catch (error) {
    if (error instanceof CustomerError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

customersRouter.get("/:id/activities", async (req, res, next) => {
  try {
    const activities = await listActivities(getCustomerContext(req), req.params.id);
    res.json({ ok: true, data: activities });
  } catch (error) {
    if (error instanceof CustomerError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

customersRouter.post("/:id/activities", async (req, res, next) => {
  try {
    const input = customerActivityInputSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid activity details." });
      return;
    }
    const activity = await createActivity(getCustomerContext(req), req.params.id, input.data);
    res.status(201).json({ ok: true, data: activity });
  } catch (error) {
    if (error instanceof CustomerError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

customersRouter.delete("/:id/activities/:activityId", async (req, res, next) => {
  try {
    const deleted = await deleteActivity(getCustomerContext(req), req.params.activityId);
    if (!deleted) {
      res.status(404).json({ ok: false, error: "Activity not found." });
      return;
    }
    res.json({ ok: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});

customersRouter.get("/:id/follow-ups", async (req, res, next) => {
  try {
    const followUps = await listFollowUps(getCustomerContext(req), req.params.id);
    res.json({ ok: true, data: followUps });
  } catch (error) {
    if (error instanceof CustomerError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

customersRouter.post("/:id/follow-ups", async (req, res, next) => {
  try {
    const input = customerFollowUpInputSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid follow-up details." });
      return;
    }
    const followUp = await createFollowUp(getCustomerContext(req), req.params.id, input.data);
    res.status(201).json({ ok: true, data: followUp });
  } catch (error) {
    if (error instanceof CustomerError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

customersRouter.patch("/:id/follow-ups/:followUpId", async (req, res, next) => {
  try {
    const completed = req.body?.completed;
    if (typeof completed !== "boolean") {
      res.status(400).json({ ok: false, error: "Invalid completion state." });
      return;
    }
    const followUp = await completeFollowUp(
      getCustomerContext(req),
      req.params.followUpId,
      req.params.id,
      completed
    );
    if (!followUp) {
      res.status(404).json({ ok: false, error: "Follow-up not found." });
      return;
    }
    res.json({ ok: true, data: followUp });
  } catch (error) {
    if (error instanceof CustomerError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

customersRouter.delete("/:id/follow-ups/:followUpId", async (req, res, next) => {
  try {
    const deleted = await deleteFollowUp(getCustomerContext(req), req.params.followUpId);
    if (!deleted) {
      res.status(404).json({ ok: false, error: "Follow-up not found." });
      return;
    }
    res.json({ ok: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});


customersRouter.post("/bulk", async (req, res, next) => {
  try {
    const input = bulkActionInputSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid bulk action details." });
      return;
    }
    const result = await bulkAction(getCustomerContext(req), input.data);
    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
});

customersRouter.get("/duplicates", async (req, res, next) => {
  try {
    const groups = await findDuplicateGroups(getCustomerContext(req));
    res.json({ ok: true, data: groups });
  } catch (error) {
    next(error);
  }
});

customersRouter.post("/merge", async (req, res, next) => {
  try {
    const input = customerMergeInputSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid merge details." });
      return;
    }
    await mergeCustomers(getCustomerContext(req), input.data);
    res.json({ ok: true, data: { merged: true } });
  } catch (error) {
    if (error instanceof CustomerError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

customersRouter.post("/import", async (req, res, next) => {
  try {
    const input = customerImportInputSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid import payload." });
      return;
    }
    const result = await importCustomers(getCustomerContext(req), input.data.rows);
    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
});
