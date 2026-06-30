import { pool } from "../../db/postgres.js";
import type {
  Account,
  AccountInput,
  AccountLifecycleStage,
  AccountConnection,
  Customer,
} from "../../../../contracts/orbitone.v2.js";

export type AccountContext = {
  userId: string;
  organizationId: string;
};

export class AccountError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const lifecycleStages: AccountLifecycleStage[] = ["prospect", "qualified", "customer", "churned", "archived"];

function mapAccount(row: Record<string, unknown>): Account {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    assignedToUserId: (row.assigned_to_user_id as string | null) ?? null,
    name: row.name as string,
    slug: row.slug as string,
    industry: (row.industry as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    billingAddress: (row.billing_address as string | null) ?? null,
    taxId: (row.tax_id as string | null) ?? null,
    lifecycleStage: row.lifecycle_stage as AccountLifecycleStage,
    isPublic: row.is_public as boolean,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

function mapCustomer(row: Record<string, unknown>): Customer {
  return {
    id: row.id as string,
    organizationId: (row.organization_id as string | null) ?? null,
    assignedToUserId: (row.assigned_to_user_id as string | null) ?? null,
    fullName: row.full_name as string,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    company: (row.company as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    lifecycleStage: row.lifecycle_stage as Customer["lifecycleStage"],
    priority: row.priority as Customer["priority"],
    nextStep: (row.next_step as string | null) ?? null,
    lastContactedAt: row.last_contacted_at ? (row.last_contacted_at as Date).toISOString() : null,
    source: row.source as Customer["source"],
    sourceProfileId: (row.source_profile_id as string | null) ?? null,
    valueAmount: row.value_amount ? Number(row.value_amount) : null,
    valueCurrency: (row.value_currency as string) ?? "LKR",
    expectedCloseDate: row.expected_close_date ? (row.expected_close_date as Date).toISOString().slice(0, 10) : null,
    outcome: row.outcome as Customer["outcome"],
    closedAt: row.closed_at ? (row.closed_at as Date).toISOString() : null,
    closedReason: (row.closed_reason as string | null) ?? null,
    sourceUserId: (row.source_user_id as string | null) ?? null,
    sourceBookingId: (row.source_booking_id as string | null) ?? null,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    accountId: (row.account_id as string | null) ?? null,
    pipelineId: (row.pipeline_id as string | null) ?? null,
    pipelineStageId: (row.pipeline_stage_id as string | null) ?? null,
    customFieldValues: [],
  };
}

function mapConnection(row: Record<string, unknown>, otherAccount: Account): AccountConnection {
  return {
    id: row.id as string,
    fromAccountId: row.from_account_id as string,
    toAccountId: row.to_account_id as string,
    status: row.status as AccountConnection["status"],
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    otherAccount,
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

export async function listAccounts(context: AccountContext): Promise<Account[]> {
  const result = await pool.query(
    `SELECT * FROM business_accounts
     WHERE organization_id = $1
     ORDER BY created_at DESC`,
    [context.organizationId]
  );
  return result.rows.map(mapAccount);
}

export async function createAccount(context: AccountContext, input: AccountInput): Promise<Account> {
  const slug = input.slug?.trim() || slugify(input.name);
  if (!slug || slug.length < 1) {
    throw new AccountError("A valid slug is required.");
  }

  const existing = await pool.query(
    "SELECT id FROM business_accounts WHERE organization_id = $1 AND slug = $2",
    [context.organizationId, slug]
  );
  if (existing.rowCount && existing.rowCount > 0) {
    throw new AccountError("An account with this slug already exists.");
  }

  const stage: AccountLifecycleStage = input.lifecycleStage && lifecycleStages.includes(input.lifecycleStage)
    ? input.lifecycleStage
    : "prospect";

  const result = await pool.query(
    `INSERT INTO business_accounts
       (organization_id, assigned_to_user_id, name, slug, industry, website, billing_address, tax_id, lifecycle_stage, is_public)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      context.organizationId,
      input.assignedToUserId ?? null,
      input.name.trim(),
      slug,
      input.industry ?? null,
      input.website ?? null,
      input.billingAddress ?? null,
      input.taxId ?? null,
      stage,
      input.isPublic ?? false,
    ]
  );
  return mapAccount(result.rows[0]);
}

export async function getAccount(context: AccountContext, id: string): Promise<Account | null> {
  const result = await pool.query(
    `SELECT * FROM business_accounts WHERE id = $1 AND organization_id = $2`,
    [id, context.organizationId]
  );
  if (result.rowCount === 0) return null;
  return mapAccount(result.rows[0]);
}

export async function getAccountWithContacts(
  context: AccountContext,
  id: string
): Promise<{ account: Account; contacts: Customer[] } | null> {
  const account = await getAccount(context, id);
  if (!account) return null;
  const contactsResult = await pool.query(
    `SELECT * FROM customers WHERE account_id = $1 ORDER BY full_name ASC`,
    [id]
  );
  return { account, contacts: contactsResult.rows.map(mapCustomer) };
}

export async function updateAccount(
  context: AccountContext,
  id: string,
  input: Partial<AccountInput>
): Promise<Account | null> {
  const existing = await getAccount(context, id);
  if (!existing) return null;

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${idx++}`);
    values.push(input.name.trim());
  }
  if (input.slug !== undefined) {
    const slug = input.slug.trim() || slugify(input.name ?? existing.name);
    if (slug !== existing.slug) {
      const duplicate = await pool.query(
        "SELECT id FROM business_accounts WHERE organization_id = $1 AND slug = $2 AND id != $3",
        [context.organizationId, slug, id]
      );
      if (duplicate.rowCount && duplicate.rowCount > 0) {
        throw new AccountError("An account with this slug already exists.");
      }
    }
    updates.push(`slug = $${idx++}`);
    values.push(slug);
  }
  if (input.industry !== undefined) {
    updates.push(`industry = $${idx++}`);
    values.push(input.industry ?? null);
  }
  if (input.website !== undefined) {
    updates.push(`website = $${idx++}`);
    values.push(input.website ?? null);
  }
  if (input.billingAddress !== undefined) {
    updates.push(`billing_address = $${idx++}`);
    values.push(input.billingAddress ?? null);
  }
  if (input.taxId !== undefined) {
    updates.push(`tax_id = $${idx++}`);
    values.push(input.taxId ?? null);
  }
  if (input.assignedToUserId !== undefined) {
    updates.push(`assigned_to_user_id = $${idx++}`);
    values.push(input.assignedToUserId ?? null);
  }
  if (input.lifecycleStage !== undefined && lifecycleStages.includes(input.lifecycleStage)) {
    updates.push(`lifecycle_stage = $${idx++}`);
    values.push(input.lifecycleStage);
  }
  if (input.isPublic !== undefined) {
    updates.push(`is_public = $${idx++}`);
    values.push(input.isPublic);
  }

  if (updates.length === 0) return existing;

  values.push(id);
  values.push(context.organizationId);
  const result = await pool.query(
    `UPDATE business_accounts SET ${updates.join(", ")}, updated_at = now()
     WHERE id = $${idx++} AND organization_id = $${idx++}
     RETURNING *`,
    values
  );
  if (result.rowCount === 0) return null;
  return mapAccount(result.rows[0]);
}

export async function deleteAccount(context: AccountContext, id: string): Promise<boolean> {
  const result = await pool.query(
    "DELETE FROM business_accounts WHERE id = $1 AND organization_id = $2 RETURNING id",
    [id, context.organizationId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listDirectory(
  context: AccountContext,
  options: { search?: string; industry?: string; limit?: number; offset?: number } = {}
): Promise<Account[]> {
  const conditions = ["is_public = true", "organization_id != $1"];
  const params: unknown[] = [context.organizationId];
  let idx = 2;

  if (options.search) {
    conditions.push(`(name ILIKE $${idx} OR industry ILIKE $${idx} OR website ILIKE $${idx})`);
    params.push(`%${options.search}%`);
    idx++;
  }
  if (options.industry) {
    conditions.push(`industry ILIKE $${idx}`);
    params.push(`%${options.industry}%`);
    idx++;
  }

  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  params.push(limit, offset);

  const result = await pool.query(
    `SELECT * FROM business_accounts
     WHERE ${conditions.join(" AND ")}
     ORDER BY name ASC
     LIMIT $${idx++} OFFSET $${idx++}`,
    params
  );
  return result.rows.map(mapAccount);
}

export async function getPublicAccountBySlug(slug: string): Promise<Account | null> {
  const result = await pool.query(
    `SELECT * FROM business_accounts WHERE slug = $1 AND is_public = true`,
    [slug]
  );
  if (result.rowCount === 0) return null;
  return mapAccount(result.rows[0]);
}

export async function requestConnection(
  context: AccountContext,
  fromAccountId: string,
  toAccountId: string
): Promise<AccountConnection> {
  if (fromAccountId === toAccountId) {
    throw new AccountError("Cannot connect an account to itself.");
  }

  const fromResult = await pool.query(
    "SELECT id, organization_id FROM business_accounts WHERE id = $1",
    [fromAccountId]
  );
  if (fromResult.rowCount === 0) throw new AccountError("From account not found.", 404);
  if (fromResult.rows[0].organization_id !== context.organizationId) {
    throw new AccountError("You can only connect from an account your organization owns.");
  }

  const toResult = await pool.query(
    "SELECT id, is_public FROM business_accounts WHERE id = $1",
    [toAccountId]
  );
  if (toResult.rowCount === 0) throw new AccountError("Target account not found.", 404);

  const existing = await pool.query(
    `SELECT * FROM business_account_connections
     WHERE (from_account_id = $1 AND to_account_id = $2)
        OR (from_account_id = $2 AND to_account_id = $1)`,
    [fromAccountId, toAccountId]
  );
  if (existing.rowCount && existing.rowCount > 0) {
    const row = existing.rows[0];
    const otherId = row.from_account_id === fromAccountId ? row.to_account_id : row.from_account_id;
    const otherAccount = await getPublicAccountById(otherId);
    if (!otherAccount) throw new AccountError("Target account not found.", 404);
    return mapConnection(row, otherAccount);
  }

  const result = await pool.query(
    `INSERT INTO business_account_connections (from_account_id, to_account_id, status)
     VALUES ($1, $2, 'pending')
     RETURNING *`,
    [fromAccountId, toAccountId]
  );
  const otherAccount = await getPublicAccountById(toAccountId);
  if (!otherAccount) throw new AccountError("Target account not found.", 404);
  return mapConnection(result.rows[0], otherAccount);
}

export async function getPublicAccountById(id: string): Promise<Account | null> {
  const result = await pool.query("SELECT * FROM business_accounts WHERE id = $1", [id]);
  if (result.rowCount === 0) return null;
  return mapAccount(result.rows[0]);
}

export async function listConnections(context: AccountContext, accountId: string): Promise<AccountConnection[]> {
  const account = await getAccount(context, accountId);
  if (!account) throw new AccountError("Account not found.", 404);

  const result = await pool.query(
    `SELECT * FROM business_account_connections
     WHERE from_account_id = $1 OR to_account_id = $1
     ORDER BY created_at DESC`,
    [accountId]
  );

  const connections = await Promise.all(
    result.rows.map(async (row) => {
      const otherId = row.from_account_id === accountId ? row.to_account_id : row.from_account_id;
      const otherAccount = await getPublicAccountById(otherId);
      if (!otherAccount) throw new AccountError("Connected account not found.", 404);
      return mapConnection(row, otherAccount);
    })
  );
  return connections;
}

export async function respondConnection(
  context: AccountContext,
  connectionId: string,
  status: "accepted" | "rejected"
): Promise<AccountConnection | null> {
  const connectionResult = await pool.query(
    `SELECT c.*, a.organization_id
     FROM business_account_connections c
     JOIN business_accounts a ON a.id = c.to_account_id
     WHERE c.id = $1`,
    [connectionId]
  );
  if (connectionResult.rowCount === 0) return null;
  const connection = connectionResult.rows[0];
  if (connection.organization_id !== context.organizationId) {
    throw new AccountError("You can only respond to requests sent to your organization's account.");
  }

  const result = await pool.query(
    `UPDATE business_account_connections SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [connectionId, status]
  );
  const otherId = result.rows[0].from_account_id;
  const otherAccount = await getPublicAccountById(otherId);
  if (!otherAccount) throw new AccountError("Connected account not found.", 404);
  return mapConnection(result.rows[0], otherAccount);
}

export async function linkCustomerToAccount(
  context: AccountContext,
  customerId: string,
  accountId: string | null
): Promise<Customer | null> {
  if (accountId) {
    const account = await getAccount(context, accountId);
    if (!account) throw new AccountError("Account not found.", 404);
  }
  const result = await pool.query(
    `UPDATE customers SET account_id = $3, updated_at = now()
     WHERE id = $1 AND organization_id = $2
     RETURNING *`,
    [customerId, context.organizationId, accountId]
  );
  if (result.rowCount === 0) return null;
  return mapCustomer(result.rows[0]);
}
