import { pool } from "../../db/postgres.js";
import {
  mapCustomer,
  mapCustomerActivity,
  mapCustomerFollowUp,
  mapCustomerStageHistory
} from "../../lib/mappers.js";
import {
  getCustomFieldValuesForCustomer,
  setCustomFieldValues,
  type CRMScope
} from "../crm/custom-fields/service.js";
import { getDefaultPipeline, getPipeline } from "../crm/pipelines/service.js";
import { runAutomationRules } from "../crm/automation/service.js";
import { dispatchWebhook } from "../crm/webhooks/service.js";
import { getActivityType } from "../crm/activity-types/service.js";
import type {
  Customer,
  CustomerInput,
  CustomerStageHistory,
  CustomerActivity,
  CustomerActivityInput,
  CustomerFollowUp,
  CustomerFollowUpInput,
  CRMSummary,
  LifecycleStage,
  CRMContext
} from "../../../../contracts/orbitone.v2.js";

export type CustomerListFilters = {
  search?: string;
  lifecycleStage?: LifecycleStage;
  priority?: "low" | "medium" | "high";
  assignedTo?: string;
  source?: Customer["source"];
  outcome?: Customer["outcome"];
  sortBy?: "createdAt" | "lastContactedAt" | "expectedCloseDate" | "valueAmount";
  sortOrder?: "asc" | "desc";
};

export type CustomerContext = CRMContext;

export function toCRMScope(context: CustomerContext): CRMScope {
  return {
    organizationId: context.organizationId,
    ownerUserId: context.organizationId ? null : context.userId
  };
}

const lifecycleStages: LifecycleStage[] = [
  "new",
  "contacted",
  "qualified",
  "meeting",
  "proposal",
  "customer",
  "lost",
  "archived"
];

function stageNameToLifecycle(name: string): LifecycleStage | null {
  const normalized = name.toLowerCase().replace(/\s+/g, "_");
  if (lifecycleStages.includes(normalized as LifecycleStage)) {
    return normalized as LifecycleStage;
  }
  return null;
}

function lifecycleToStageName(stage: LifecycleStage): string {
  return stage.charAt(0).toUpperCase() + stage.slice(1).replace(/_/g, " ");
}

async function resolvePipelineStageForLifecycle(
  context: CustomerContext,
  lifecycleStage: LifecycleStage,
  currentPipelineId?: string | null
): Promise<string | null> {
  try {
    const pipeline = currentPipelineId
      ? (await getPipeline(toCRMScope(context), currentPipelineId)) ?? (await getDefaultPipeline(toCRMScope(context)))
      : await getDefaultPipeline(toCRMScope(context));
    const targetName = lifecycleToStageName(lifecycleStage);
    const stage = pipeline.stages.find(
      (s) => s.name.toLowerCase() === targetName.toLowerCase()
    );
    return stage?.id ?? pipeline.stages[0]?.id ?? null;
  } catch {
    return null;
  }
}

function buildListWhere(context: CustomerContext, filters: CustomerListFilters) {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (context.organizationId) {
    conditions.push(`organization_id = $${values.length + 1}`);
    values.push(context.organizationId);
  } else {
    conditions.push(`assigned_to_user_id = $${values.length + 1}`);
    values.push(context.userId);
  }

  if (filters.lifecycleStage) {
    conditions.push(`lifecycle_stage = $${values.length + 1}`);
    values.push(filters.lifecycleStage);
  }
  if (filters.priority) {
    conditions.push(`priority = $${values.length + 1}`);
    values.push(filters.priority);
  }
  if (filters.assignedTo) {
    conditions.push(`assigned_to_user_id = $${values.length + 1}`);
    values.push(filters.assignedTo);
  }
  if (filters.source) {
    conditions.push(`source = $${values.length + 1}`);
    values.push(filters.source);
  }
  if (filters.outcome) {
    conditions.push(`outcome = $${values.length + 1}`);
    values.push(filters.outcome);
  }
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    conditions.push(
      `(full_name ILIKE $${values.length + 1} OR email ILIKE $${values.length + 2} OR company ILIKE $${values.length + 3})`
    );
    values.push(term, term, term);
  }

  return { where: conditions.join(" AND "), values };
}

function buildOrderClause(filters: CustomerListFilters) {
  const columnMap = {
    createdAt: "created_at",
    lastContactedAt: "last_contacted_at",
    expectedCloseDate: "expected_close_date",
    valueAmount: "value_amount"
  };
  const column = columnMap[filters.sortBy ?? "createdAt"] ?? "created_at";
  const order = filters.sortOrder === "asc" ? "ASC" : "DESC";
  return `${column} ${order}`;
}

export async function listCustomers(
  context: CustomerContext,
  filters: CustomerListFilters = {}
): Promise<Customer[]> {
  const { where, values } = buildListWhere(context, filters);
  const orderBy = buildOrderClause(filters);
  const result = await pool.query(
    `SELECT * FROM customers WHERE ${where} ORDER BY ${orderBy}`,
    values
  );
  const customers = result.rows.map(mapCustomer);
  if (customers.length > 0) {
    const ids = customers.map((c) => c.id);
    const valuesResult = await pool.query(
      `SELECT customer_id, custom_field_definition_id AS definition_id, value
       FROM custom_field_values
       WHERE customer_id = ANY($1::uuid[])`,
      [ids]
    );
    const byCustomer = new Map<string, Customer["customFieldValues"]>();
    for (const row of valuesResult.rows) {
      const customerId = row.customer_id as string;
      if (!byCustomer.has(customerId)) {
        byCustomer.set(customerId, []);
      }
      byCustomer.get(customerId)!.push({
        definitionId: row.definition_id as string,
        value: row.value as unknown
      });
    }
    for (const customer of customers) {
      customer.customFieldValues = byCustomer.get(customer.id) ?? [];
    }
  }
  return customers;
}

export async function getCustomer(context: {
  userId: string;
  organizationId: string | null;
  customerId: string;
}): Promise<Customer | null> {
  const result = context.organizationId
    ? await pool.query(
        "SELECT * FROM customers WHERE id = $1 AND organization_id = $2",
        [context.customerId, context.organizationId]
      )
    : await pool.query(
        "SELECT * FROM customers WHERE id = $1 AND assigned_to_user_id = $2",
        [context.customerId, context.userId]
      );
  if (result.rowCount === 0) return null;
  const customer = mapCustomer(result.rows[0]);
  customer.customFieldValues = await getCustomFieldValuesForCustomer(customer.id);
  return customer;
}

async function ensureCustomerAccess(context: CustomerContext, customerId: string) {
  const customer = await getCustomer({ ...context, customerId });
  if (!customer) {
    throw new CustomerError("Customer not found.", 404);
  }
  return customer;
}

async function ensureAssigneeInOrganization(
  organizationId: string,
  assignedToUserId: string
) {
  const result = await pool.query(
    "SELECT id FROM users WHERE id = $1 AND organization_id = $2",
    [assignedToUserId, organizationId]
  );
  if (result.rowCount === 0) {
    throw new CustomerError("Assignee is not a member of this organization.", 400);
  }
}

function resolveAssignedToUserId(
  context: CustomerContext,
  inputAssignedTo?: string | null
): string | null {
  if (context.organizationId) {
    return inputAssignedTo ?? context.userId;
  }
  return context.userId;
}

export async function createCustomer(
  context: CustomerContext,
  input: CustomerInput
): Promise<Customer> {
  const assignedToUserId = resolveAssignedToUserId(context, input.assignedToUserId);
  if (context.organizationId && input.assignedToUserId) {
    await ensureAssigneeInOrganization(context.organizationId, input.assignedToUserId);
  }

  let pipelineId: string | null = null;
  let pipelineStageId: string | null = null;

  try {
    const defaultPipeline = await getDefaultPipeline(toCRMScope(context));
    pipelineId = defaultPipeline.id;
    const targetStage =
      defaultPipeline.stages.find(
        (s) => s.name.toLowerCase() === lifecycleToStageName(input.lifecycleStage ?? "new").toLowerCase()
      ) ?? defaultPipeline.stages[0];
    pipelineStageId = targetStage?.id ?? null;
  } catch {
    // No pipeline configured for this scope; leave null.
  }

  const result = await pool.query(
    `INSERT INTO customers (
      organization_id, assigned_to_user_id, full_name, email, phone, company, notes,
      lifecycle_stage, priority, next_step, source, source_profile_id,
      value_amount, value_currency, expected_close_date, outcome,
      pipeline_id, pipeline_stage_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    RETURNING *`,
    [
      context.organizationId,
      assignedToUserId,
      input.fullName,
      input.email ?? null,
      input.phone ?? null,
      input.company ?? null,
      input.notes ?? null,
      input.lifecycleStage ?? "new",
      input.priority ?? "medium",
      input.nextStep ?? null,
      input.source ?? "manual",
      null,
      input.valueAmount ?? null,
      input.valueCurrency ?? "LKR",
      input.expectedCloseDate ?? null,
      input.outcome ?? "in_progress",
      pipelineId,
      pipelineStageId
    ]
  );
  const customer = mapCustomer(result.rows[0]);
  customer.customFieldValues = [];

  try {
    const payload = {
      customerId: customer.id,
      lifecycleStage: customer.lifecycleStage,
      pipelineStageId: customer.pipelineStageId,
      source: customer.source
    };
    void runAutomationRules(context, "customer_created", payload);
    void dispatchWebhook(context, "customer_created", payload);
  } catch {
    // Non-blocking triggers.
  }

  return customer;
}

export async function updateCustomer(
  context: CustomerContext,
  customerId: string,
  input: Partial<CustomerInput>
): Promise<Customer | null> {
  if (input.assignedToUserId !== undefined) {
    if (!context.organizationId) {
      throw new CustomerError("Cannot reassign customers outside an organization.", 400);
    }
    if (input.assignedToUserId !== null) {
      await ensureAssigneeInOrganization(context.organizationId, input.assignedToUserId);
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const baseWhere = context.organizationId
      ? "id = $1 AND organization_id = $2"
      : "id = $1 AND assigned_to_user_id = $2";

    const currentResult = await client.query(
      `SELECT pipeline_id, pipeline_stage_id, lifecycle_stage FROM customers WHERE ${baseWhere}`,
      [customerId, context.organizationId ?? context.userId]
    );
    if (currentResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }
    const currentPipelineId = currentResult.rows[0].pipeline_id as string | null;
    const currentStageId = currentResult.rows[0].pipeline_stage_id as string | null;
    const currentLifecycleStage = currentResult.rows[0].lifecycle_stage as LifecycleStage;

    let lifecycleStage = input.lifecycleStage;
    let pipelineStageId = input.pipelineStageId;

    if (lifecycleStage !== undefined) {
      const resolved = await resolvePipelineStageForLifecycle(context, lifecycleStage, currentPipelineId);
      if (resolved) {
        pipelineStageId = resolved;
      }
    }

    if (pipelineStageId !== undefined && lifecycleStage === undefined) {
      const stageResult = await client.query(
        "SELECT id, name FROM pipeline_stages WHERE id = $1 AND pipeline_id = $2",
        [pipelineStageId, currentPipelineId]
      );
      if (stageResult.rowCount === 0) {
        throw new CustomerError("Pipeline stage not found.", 404);
      }
      const derivedLifecycle = stageNameToLifecycle(stageResult.rows[0].name as string);
      if (derivedLifecycle && derivedLifecycle !== currentLifecycleStage) {
        lifecycleStage = derivedLifecycle;
      }
    }

    if (pipelineStageId !== undefined && pipelineStageId !== currentStageId) {
      const stageResult = await client.query(
        "SELECT id FROM pipeline_stages WHERE id = $1 AND pipeline_id = $2",
        [pipelineStageId, currentPipelineId]
      );
      if (stageResult.rowCount === 0) {
        throw new CustomerError("Pipeline stage not found.", 404);
      }
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    const add = (col: string, val: unknown) => {
      values.push(val);
      fields.push(`${col} = $${values.length}`);
    };

    if (input.fullName !== undefined) add("full_name", input.fullName);
    if (input.email !== undefined) add("email", input.email);
    if (input.phone !== undefined) add("phone", input.phone);
    if (input.company !== undefined) add("company", input.company);
    if (input.notes !== undefined) add("notes", input.notes);
    if (lifecycleStage !== undefined) add("lifecycle_stage", lifecycleStage);
    if (input.priority !== undefined) add("priority", input.priority);
    if (input.nextStep !== undefined) add("next_step", input.nextStep);
    if (input.assignedToUserId !== undefined) add("assigned_to_user_id", input.assignedToUserId);
    if (input.valueAmount !== undefined) add("value_amount", input.valueAmount);
    if (input.valueCurrency !== undefined) add("value_currency", input.valueCurrency);
    if (input.expectedCloseDate !== undefined) add("expected_close_date", input.expectedCloseDate);
    if (input.outcome !== undefined) add("outcome", input.outcome);
    if (input.closedReason !== undefined) add("closed_reason", input.closedReason);
    if (pipelineStageId !== undefined) add("pipeline_stage_id", pipelineStageId);

    let updated: Customer | null = null;
    if (fields.length > 0) {
      values.push(customerId, context.organizationId ?? context.userId);
      const result = await client.query(
        `UPDATE customers SET ${fields.join(", ")}, updated_at = now() WHERE ${baseWhere} RETURNING *`,
        values
      );
      updated = mapCustomer(result.rows[0]);
    } else {
      const result = await client.query(`SELECT * FROM customers WHERE ${baseWhere}`, [
        customerId,
        context.organizationId ?? context.userId
      ]);
      updated = mapCustomer(result.rows[0]);
    }

    if (input.customFieldValues && input.customFieldValues.length > 0) {
      await setCustomFieldValues(customerId, input.customFieldValues);
    }

    await client.query("COMMIT");

    return getCustomer({ ...context, customerId });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function moveCustomerStage(
  context: CustomerContext,
  customerId: string,
  pipelineStageId: string,
  note?: string | null
): Promise<Customer | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const baseWhere = context.organizationId
      ? "id = $1 AND organization_id = $2"
      : "id = $1 AND assigned_to_user_id = $2";

    const customerResult = await client.query(
      `SELECT pipeline_id, pipeline_stage_id FROM customers WHERE ${baseWhere}`,
      [customerId, context.organizationId ?? context.userId]
    );
    if (customerResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }
    const pipelineId = customerResult.rows[0].pipeline_id as string | null;
    const fromStageId = customerResult.rows[0].pipeline_stage_id as string | null;

    const stageResult = await client.query(
      "SELECT id, name FROM pipeline_stages WHERE id = $1 AND pipeline_id = $2",
      [pipelineStageId, pipelineId]
    );
    if (stageResult.rowCount === 0) {
      await client.query("ROLLBACK");
      throw new CustomerError("Pipeline stage not found.", 404);
    }
    const toStageName = stageResult.rows[0].name as string;

    let fromStageName: string | null = null;
    if (fromStageId) {
      const fromResult = await client.query("SELECT name FROM pipeline_stages WHERE id = $1", [fromStageId]);
      if (fromResult.rowCount !== 0) {
        fromStageName = fromResult.rows[0].name as string;
      }
    }

    const derivedLifecycle = stageNameToLifecycle(toStageName);
    const lifecycleSet = derivedLifecycle ? `, lifecycle_stage = $4` : "";
    const lifecycleParam = derivedLifecycle ?? null;
    await client.query(
      `UPDATE customers SET pipeline_stage_id = $1, updated_at = now()${lifecycleSet} WHERE ${baseWhere}`,
      derivedLifecycle
        ? [pipelineStageId, customerId, context.organizationId ?? context.userId, lifecycleParam]
        : [pipelineStageId, customerId, context.organizationId ?? context.userId]
    );

    await client.query(
      `INSERT INTO customer_pipeline_stage_history
         (customer_id, from_stage_name, to_stage_name, note, changed_by_user_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [customerId, fromStageName, toStageName, note ?? null, context.userId]
    );

    await client.query("COMMIT");
    const updated = await getCustomer({ ...context, customerId });

    try {
      const payload = {
        customerId,
        fromStageName,
        toStageName,
        pipelineStageId,
        lifecycleStage: updated?.lifecycleStage
      };
      void runAutomationRules(context, "stage_changed", payload);
      void dispatchWebhook(context, "stage_changed", payload);
    } catch {
      // Non-blocking triggers.
    }

    return updated;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listPipelineStageHistory(
  context: CustomerContext,
  customerId: string
): Promise<import("../../../../contracts/orbitone.v2.js").CustomerPipelineStageHistory[]> {
  const baseWhere = context.organizationId
    ? "id = $1 AND organization_id = $2"
    : "id = $1 AND assigned_to_user_id = $2";
  const access = await pool.query(`SELECT id FROM customers WHERE ${baseWhere}`, [
    customerId,
    context.organizationId ?? context.userId
  ]);
  if (access.rowCount === 0) {
    throw new CustomerError("Customer not found.", 404);
  }

  const result = await pool.query(
    `SELECT id, customer_id, from_stage_name, to_stage_name, note, changed_by_user_id, created_at
     FROM customer_pipeline_stage_history
     WHERE customer_id = $1
     ORDER BY created_at DESC`,
    [customerId]
  );
  return result.rows.map((row) => ({
    id: row.id as string,
    customerId: row.customer_id as string,
    fromStageName: (row.from_stage_name as string | null) ?? null,
    toStageName: row.to_stage_name as string,
    note: (row.note as string | null) ?? null,
    changedByUserId: row.changed_by_user_id as string,
    createdAt: (row.created_at as Date).toISOString()
  }));
}

export async function deleteCustomer(
  context: CustomerContext,
  customerId: string
): Promise<boolean> {
  const result = context.organizationId
    ? await pool.query("DELETE FROM customers WHERE id = $1 AND organization_id = $2 RETURNING id", [
        customerId,
        context.organizationId
      ])
    : await pool.query("DELETE FROM customers WHERE id = $1 AND assigned_to_user_id = $2 RETURNING id", [
        customerId,
        context.userId
      ]);
  return result.rowCount !== null && result.rowCount > 0;
}

export async function updateLifecycle(
  context: CustomerContext,
  customerId: string,
  lifecycleStage: LifecycleStage,
  note?: string | null
): Promise<Customer | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const baseWhere = context.organizationId
      ? "id = $1 AND organization_id = $2"
      : "id = $1 AND assigned_to_user_id = $2";
    const baseParams = [customerId, context.organizationId ?? context.userId];

    const currentResult = await client.query(
      `SELECT lifecycle_stage, pipeline_id FROM customers WHERE ${baseWhere}`,
      baseParams
    );
    if (currentResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }
    const fromStage = currentResult.rows[0].lifecycle_stage as LifecycleStage;
    const currentPipelineId = currentResult.rows[0].pipeline_id as string | null;

    const pipelineStageId = await resolvePipelineStageForLifecycle(context, lifecycleStage, currentPipelineId);

    const updateResult = await client.query(
      `UPDATE customers SET lifecycle_stage = $3, ${
        pipelineStageId ? `pipeline_stage_id = $4, ` : ""
      }updated_at = now() WHERE ${baseWhere} RETURNING *`,
      pipelineStageId ? [...baseParams, lifecycleStage, pipelineStageId] : [...baseParams, lifecycleStage]
    );

    await client.query(
      `INSERT INTO customer_stage_history (customer_id, from_stage, to_stage, note, changed_by_user_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [customerId, fromStage, lifecycleStage, note ?? null, context.userId]
    );

    await client.query(
      `INSERT INTO customer_activities (customer_id, created_by_user_id, type, title, body, occurred_at)
       VALUES ($1, $2, 'other', $3, $4, now())`,
      [
        customerId,
        context.userId,
        `Stage changed: ${fromStage} → ${lifecycleStage}`,
        note ?? null
      ]
    );

    await client.query("COMMIT");
    const updated = await getCustomer({ ...context, customerId });

    try {
      const payload = {
        customerId,
        fromLifecycleStage: fromStage,
        toLifecycleStage: lifecycleStage,
        pipelineStageId
      };
      void runAutomationRules(context, "lifecycle_changed", payload);
      void dispatchWebhook(context, "lifecycle_changed", payload);
    } catch {
      // Non-blocking triggers.
    }

    return updated;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function assignCustomer(
  context: CustomerContext,
  customerId: string,
  assignedToUserId: string
): Promise<Customer | null> {
  if (!context.organizationId) {
    throw new CustomerError("Cannot reassign customers outside an organization.", 400);
  }
  await ensureAssigneeInOrganization(context.organizationId, assignedToUserId);

  const result = await pool.query(
    "UPDATE customers SET assigned_to_user_id = $3, updated_at = now() WHERE id = $1 AND organization_id = $2 RETURNING *",
    [customerId, context.organizationId, assignedToUserId]
  );
  if (result.rowCount === 0) return null;
  return mapCustomer(result.rows[0]);
}

export async function closeCustomer(
  context: CustomerContext,
  customerId: string,
  outcome: Customer["outcome"],
  closedReason?: string | null
): Promise<Customer | null> {
  const baseWhere = context.organizationId
    ? "id = $1 AND organization_id = $2"
    : "id = $1 AND assigned_to_user_id = $2";
  const closedAt = outcome === "in_progress" || outcome === "nurture" ? null : new Date().toISOString();
  const result = await pool.query(
    `UPDATE customers
     SET outcome = $3, closed_reason = $4, closed_at = $5, updated_at = now()
     WHERE ${baseWhere} RETURNING *`,
    [customerId, context.organizationId ?? context.userId, outcome, closedReason ?? null, closedAt]
  );
  if (result.rowCount === 0) return null;
  return mapCustomer(result.rows[0]);
}

export async function listStageHistory(
  context: CustomerContext,
  customerId: string
): Promise<CustomerStageHistory[]> {
  await ensureCustomerAccess(context, customerId);
  const result = await pool.query(
    "SELECT * FROM customer_stage_history WHERE customer_id = $1 ORDER BY created_at DESC",
    [customerId]
  );
  return result.rows.map(mapCustomerStageHistory);
}

export async function listActivities(
  context: CustomerContext,
  customerId: string
): Promise<CustomerActivity[]> {
  await ensureCustomerAccess(context, customerId);
  const result = await pool.query(
    "SELECT * FROM customer_activities WHERE customer_id = $1 ORDER BY occurred_at DESC",
    [customerId]
  );
  return result.rows.map(mapCustomerActivity);
}

export async function createActivity(
  context: CustomerContext,
  customerId: string,
  input: CustomerActivityInput
): Promise<CustomerActivity> {
  await ensureCustomerAccess(context, customerId);

  let type = input.type as string;
  let typeDefinitionId: string | null = null;
  if (input.activityTypeDefinitionId) {
    const definition = await getActivityType(toCRMScope(context), input.activityTypeDefinitionId);
    if (definition) {
      type = definition.key;
      typeDefinitionId = definition.id;
    }
  }

  const result = await pool.query(
    `INSERT INTO customer_activities (customer_id, created_by_user_id, activity_type_definition_id, type, title, body, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [customerId, context.userId, typeDefinitionId, type, input.title, input.body ?? null, input.occurredAt ?? new Date().toISOString()]
  );
  await pool.query(
    "UPDATE customers SET last_contacted_at = now(), updated_at = now() WHERE id = $1",
    [customerId]
  );

  const activity = mapCustomerActivity(result.rows[0]);

  try {
    const payload = {
      customerId,
      activityId: activity.id,
      type,
      title: input.title
    };
    void runAutomationRules(context, "activity_created", payload);
    void dispatchWebhook(context, "activity_created", payload);
  } catch {
    // Non-blocking triggers.
  }

  return activity;
}

export async function deleteActivity(
  context: CustomerContext,
  activityId: string
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM customer_activities a
     USING customers c
     WHERE a.id = $1
       AND a.created_by_user_id = $2
       AND a.customer_id = c.id
       AND (${
         context.organizationId
           ? "c.organization_id = $3"
           : "c.assigned_to_user_id = $3"
       })
     RETURNING a.id`,
    [activityId, context.userId, context.organizationId ?? context.userId]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function listFollowUps(
  context: CustomerContext,
  customerId: string
): Promise<CustomerFollowUp[]> {
  await ensureCustomerAccess(context, customerId);
  const result = await pool.query(
    "SELECT * FROM customer_follow_ups WHERE customer_id = $1 ORDER BY due_at ASC",
    [customerId]
  );
  return result.rows.map(mapCustomerFollowUp);
}

export async function createFollowUp(
  context: CustomerContext,
  customerId: string,
  input: CustomerFollowUpInput
): Promise<CustomerFollowUp> {
  await ensureCustomerAccess(context, customerId);
  const result = await pool.query(
    `INSERT INTO customer_follow_ups (customer_id, created_by_user_id, title, due_at)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [customerId, context.userId, input.title, input.dueAt]
  );
  const followUp = mapCustomerFollowUp(result.rows[0]);

  try {
    const payload = {
      customerId,
      followUpId: followUp.id,
      title: input.title,
      dueAt: input.dueAt
    };
    void runAutomationRules(context, "follow_up_created", payload);
    void dispatchWebhook(context, "follow_up_created", payload);
  } catch {
    // Non-blocking triggers.
  }

  return followUp;
}

export async function completeFollowUp(
  context: CustomerContext,
  followUpId: string,
  customerId: string,
  completed: boolean
): Promise<CustomerFollowUp | null> {
  await ensureCustomerAccess(context, customerId);
  const result = await pool.query(
    `UPDATE customer_follow_ups
     SET completed_at = CASE WHEN $1 THEN now() ELSE NULL END, updated_at = now()
     WHERE id = $2 AND customer_id = $3
     RETURNING *`,
    [completed, followUpId, customerId]
  );
  if (result.rowCount === 0) return null;
  const followUp = mapCustomerFollowUp(result.rows[0]);

  if (completed) {
    try {
      const payload = {
        customerId,
        followUpId,
        title: followUp.title,
        completedAt: followUp.completedAt
      };
      void runAutomationRules(context, "follow_up_completed", payload);
      void dispatchWebhook(context, "follow_up_completed", payload);
    } catch {
      // Non-blocking triggers.
    }
  }

  return followUp;
}

export async function deleteFollowUp(
  context: CustomerContext,
  followUpId: string
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM customer_follow_ups f
     USING customers c
     WHERE f.id = $1
       AND f.customer_id = c.id
       AND (${
         context.organizationId
           ? "c.organization_id = $2"
           : "c.assigned_to_user_id = $2 AND f.created_by_user_id = $3"
       })
     RETURNING f.id`,
    context.organizationId
      ? [followUpId, context.organizationId]
      : [followUpId, context.userId, context.userId]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function getCRMSummary(context: CustomerContext): Promise<CRMSummary> {
  const where = context.organizationId
    ? "organization_id = $1"
    : "assigned_to_user_id = $1";
  const params = [context.organizationId ?? context.userId];

  const [
    customersResult,
    highPriorityResult,
    openFollowUpsResult,
    overdueFollowUpsResult,
    forecastResult,
    staleResult,
    outcomeResult
  ] = await Promise.all([
    pool.query(`SELECT lifecycle_stage, COUNT(*) FROM customers WHERE ${where} GROUP BY lifecycle_stage`, params),
    pool.query(`SELECT COUNT(*) FROM customers WHERE ${where} AND priority = 'high'`, params),
    pool.query(
      `SELECT COUNT(*) FROM customer_follow_ups f
       JOIN customers c ON c.id = f.customer_id
       WHERE ${where.replace(/customers/g, "c")} AND f.completed_at IS NULL`,
      params
    ),
    pool.query(
      `SELECT COUNT(*) FROM customer_follow_ups f
       JOIN customers c ON c.id = f.customer_id
       WHERE ${where.replace(/customers/g, "c")} AND f.completed_at IS NULL AND f.due_at < now()`,
      params
    ),
    pool.query(
      `SELECT COALESCE(SUM(value_amount), 0) AS total, value_currency
       FROM customers
       WHERE ${where} AND outcome = 'in_progress'
       GROUP BY value_currency`,
      params
    ),
    pool.query(
      `SELECT COUNT(*) FROM customers
       WHERE ${where} AND outcome = 'in_progress'
       AND (last_contacted_at IS NULL OR last_contacted_at < now() - interval '7 days')`,
      params
    ),
    pool.query(
      `SELECT outcome, COUNT(*) FROM customers WHERE ${where} AND outcome IN ('won', 'lost') GROUP BY outcome`,
      params
    )
  ]);

  const lifecycle: CRMSummary["lifecycle"] = {
    new: 0,
    contacted: 0,
    qualified: 0,
    meeting: 0,
    proposal: 0,
    customer: 0,
    lost: 0,
    archived: 0
  };
  for (const row of customersResult.rows) {
    lifecycle[row.lifecycle_stage as keyof CRMSummary["lifecycle"]] = Number(row.count);
  }

  const totalCustomers = Object.values(lifecycle).reduce((a, b) => a + b, 0);

  const forecastRow = forecastResult.rows[0];
  const forecastValue = forecastRow ? Number(forecastRow.total) : 0;
  const forecastCurrency = (forecastRow?.value_currency as string) ?? "LKR";

  const wonRow = outcomeResult.rows.find((r) => r.outcome === "won");
  const lostRow = outcomeResult.rows.find((r) => r.outcome === "lost");
  const wonCount = wonRow ? Number(wonRow.count) : 0;
  const lostCount = lostRow ? Number(lostRow.count) : 0;
  const closedCount = wonCount + lostCount;
  const conversionRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;

  return {
    lifecycle,
    highPriority: Number(highPriorityResult.rows[0].count),
    openFollowUps: Number(openFollowUpsResult.rows[0].count),
    overdueFollowUps: Number(overdueFollowUpsResult.rows[0].count),
    totalCustomers,
    forecastValue,
    forecastCurrency,
    staleLeads: Number(staleResult.rows[0].count),
    wonCount,
    lostCount,
    conversionRate
  };
}

export async function upsertCustomerFromBooking(
  context: CustomerContext,
  input: {
    fullName: string;
    email: string;
    company: string | null;
    source: "booking";
    sourceProfileId: string | null;
  },
  bookingId?: string
): Promise<string> {
  const existing = input.email
    ? await pool.query(
        context.organizationId
          ? "SELECT id FROM customers WHERE organization_id = $1 AND email = $2"
          : "SELECT id FROM customers WHERE assigned_to_user_id = $1 AND email = $2",
        [context.organizationId ?? context.userId, input.email]
      )
    : { rowCount: 0, rows: [] };

  if (existing.rowCount !== 0) {
    await pool.query(
      "UPDATE customers SET last_contacted_at = now(), updated_at = now() WHERE id = $1",
      [existing.rows[0].id]
    );
    return existing.rows[0].id;
  }

  const result = await pool.query(
    `INSERT INTO customers (
      organization_id, assigned_to_user_id, full_name, email, company, source, source_profile_id,
      source_user_id, source_booking_id, lifecycle_stage
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'new')
    RETURNING id`,
    [
      context.organizationId,
      context.organizationId ? null : context.userId,
      input.fullName,
      input.email,
      input.company,
      input.source,
      input.sourceProfileId,
      context.userId,
      bookingId ?? null
    ]
  );
  return result.rows[0].id;
}

export async function createBookingMeetingActivity(
  bookingId: string,
  customerId: string,
  ownerUserId: string,
  startAt: string,
  endAt: string
): Promise<void> {
  await pool.query(
    `INSERT INTO customer_activities (customer_id, created_by_user_id, type, title, body, occurred_at)
     VALUES ($1, $2, 'meeting', $3, $4, $5)`,
    [
      customerId,
      ownerUserId,
      "Meeting booked",
      `Booking ${bookingId} confirmed. Meeting from ${startAt} to ${endAt}.`,
      startAt
    ]
  );
}

export class CustomerError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "CustomerError";
  }
}
