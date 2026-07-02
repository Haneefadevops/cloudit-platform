import { Router } from "express";
import { requireUser } from "../../middleware/auth.js";
import { requireBusiness } from "../../middleware/plan.js";
import { getUser } from "../../middleware/auth.js";
import {
  listAccounts,
  createAccount,
  getAccountWithContacts,
  updateAccount,
  deleteAccount,
  listDirectory,
  getPublicAccountBySlug,
  requestConnection,
  listConnections,
  respondConnection,
  linkCustomerToAccount,
  AccountError,
  type AccountContext,
} from "./service.js";
import { accountInputSchema, connectionResponseSchema } from "./schemas.js";

export const accountsRouter = Router();

function getContext(req: Parameters<typeof getUser>[0]): AccountContext {
  const user = getUser(req);
  if (!user.organizationId) {
    throw new AccountError("Business accounts require an organization.", 403);
  }
  return { userId: user.id, organizationId: user.organizationId };
}

accountsRouter.use(requireUser, requireBusiness);

accountsRouter.get("/", async (req, res, next) => {
  try {
    const accounts = await listAccounts(getContext(req));
    res.json({ ok: true, data: accounts });
  } catch (error) {
    if (error instanceof AccountError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

accountsRouter.post("/", async (req, res, next) => {
  try {
    const input = accountInputSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid account details." });
      return;
    }
    const account = await createAccount(getContext(req), input.data);
    res.status(201).json({ ok: true, data: account });
  } catch (error) {
    if (error instanceof AccountError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

accountsRouter.get("/directory", async (req, res, next) => {
  try {
    const accounts = await listDirectory(getContext(req), {
      search: req.query.search as string | undefined,
      industry: req.query.industry as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    });
    res.json({ ok: true, data: accounts });
  } catch (error) {
    if (error instanceof AccountError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

accountsRouter.get("/public/:slug", async (req, res, next) => {
  try {
    const account = await getPublicAccountBySlug(req.params.slug);
    if (!account) {
      res.status(404).json({ ok: false, error: "Account not found." });
      return;
    }
    res.json({ ok: true, data: account });
  } catch (error) {
    next(error);
  }
});

accountsRouter.get("/:id", async (req, res, next) => {
  try {
    const result = await getAccountWithContacts(getContext(req), req.params.id);
    if (!result) {
      res.status(404).json({ ok: false, error: "Account not found." });
      return;
    }
    res.json({ ok: true, data: result });
  } catch (error) {
    if (error instanceof AccountError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

accountsRouter.put("/:id", async (req, res, next) => {
  try {
    const input = accountInputSchema.partial().safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid account details." });
      return;
    }
    const account = await updateAccount(getContext(req), req.params.id, input.data);
    if (!account) {
      res.status(404).json({ ok: false, error: "Account not found." });
      return;
    }
    res.json({ ok: true, data: account });
  } catch (error) {
    if (error instanceof AccountError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

accountsRouter.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await deleteAccount(getContext(req), req.params.id);
    if (!deleted) {
      res.status(404).json({ ok: false, error: "Account not found." });
      return;
    }
    res.json({ ok: true, data: { deleted: true } });
  } catch (error) {
    if (error instanceof AccountError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

accountsRouter.post("/:id/connect", async (req, res, next) => {
  try {
    const { toAccountId } = req.body;
    if (!toAccountId || typeof toAccountId !== "string") {
      res.status(400).json({ ok: false, error: "Target account ID is required." });
      return;
    }
    const connection = await requestConnection(getContext(req), req.params.id, toAccountId);
    res.status(201).json({ ok: true, data: connection });
  } catch (error) {
    if (error instanceof AccountError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

accountsRouter.get("/:id/connections", async (req, res, next) => {
  try {
    const connections = await listConnections(getContext(req), req.params.id);
    res.json({ ok: true, data: connections });
  } catch (error) {
    if (error instanceof AccountError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

accountsRouter.put("/connections/:connectionId", async (req, res, next) => {
  try {
    const input = connectionResponseSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid status." });
      return;
    }
    const connection = await respondConnection(getContext(req), req.params.connectionId, input.data.status);
    if (!connection) {
      res.status(404).json({ ok: false, error: "Connection not found." });
      return;
    }
    res.json({ ok: true, data: connection });
  } catch (error) {
    if (error instanceof AccountError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

accountsRouter.put("/:id/customers/:customerId", async (req, res, next) => {
  try {
    const customer = await linkCustomerToAccount(getContext(req), req.params.customerId, req.params.id);
    if (!customer) {
      res.status(404).json({ ok: false, error: "Customer not found." });
      return;
    }
    res.json({ ok: true, data: customer });
  } catch (error) {
    if (error instanceof AccountError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

accountsRouter.delete("/:id/customers/:customerId", async (req, res, next) => {
  try {
    const customer = await linkCustomerToAccount(getContext(req), req.params.customerId, null);
    if (!customer) {
      res.status(404).json({ ok: false, error: "Customer not found." });
      return;
    }
    res.json({ ok: true, data: customer });
  } catch (error) {
    if (error instanceof AccountError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});
