import { pool } from "../../../db/postgres.js";
import type {
  BulkActionInput,
  BulkActionResult,
  CRMContext,
  CustomerImportRow,
  CustomerImportResult,
  DuplicateGroup,
  CustomerMergeInput,
  LifecycleStage
} from "../../../../../contracts/orbitone.v2.js";
import { CustomerError, createCustomer } from "../../customers/service.js";
import { getDefaultPipeline } from "../pipelines/service.js";
import type { CRMScope } from "../custom-fields/service.js";

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

function scopeWhere(alias: string, orgId: string | null, userId: string): string {
  return orgId ? `${alias}.organization_id = '${orgId}'` : `${alias}.assigned_to_user_id = '${userId}'`;
}

function toCRMScope(context: CRMContext): CRMScope {
  return {
    organizationId: context.organizationId,
    ownerUserId: context.organizationId ? null : context.userId
  };
}

export async function bulkAction(
  context: CRMContext,
  input: BulkActionInput
): Promise<BulkActionResult> {
  const result: BulkActionResult = { processed: 0, errors: [] };

  for (const id of input.ids) {
    try {
      await applyBulkAction(context, id, input.action, input.payload);
      result.processed++;
    } catch (error) {
      result.errors.push({
        id,
        error: error instanceof Error ? error.message : "Action failed"
      });
    }
  }

  return result;
}

async function applyBulkAction(
  context: CRMContext,
  customerId: string,
  action: BulkActionInput["action"],
  payload: Record<string, unknown>
): Promise<void> {
  const baseWhere = context.organizationId
    ? "id = $1 AND organization_id = $2"
    : "id = $1 AND assigned_to_user_id = $2";
  const baseParams = [customerId, context.organizationId ?? context.userId];

  switch (action) {
    case "delete": {
      const result = await pool.query(
        `DELETE FROM customers WHERE ${baseWhere} RETURNING id`,
        baseParams
      );
      if (result.rowCount === 0) throw new Error("Customer not found.");
      return;
    }

    case "assign": {
      const assignedToUserId = payload.assignedToUserId as string;
      if (!assignedToUserId) throw new Error("assignedToUserId is required.");
      if (!context.organizationId) throw new Error("Cannot assign outside an organization.");
      const member = await pool.query(
        "SELECT id FROM users WHERE id = $1 AND organization_id = $2",
        [assignedToUserId, context.organizationId]
      );
      if (member.rowCount === 0) throw new Error("Assignee is not a member.");
      const result = await pool.query(
        `UPDATE customers SET assigned_to_user_id = $3, updated_at = now() WHERE ${baseWhere} RETURNING id`,
        [...baseParams, assignedToUserId]
      );
      if (result.rowCount === 0) throw new Error("Customer not found.");
      return;
    }

    case "set_stage": {
      const pipelineStageId = payload.pipelineStageId as string;
      if (!pipelineStageId) throw new Error("pipelineStageId is required.");
      const current = await pool.query(
        `SELECT pipeline_id FROM customers WHERE ${baseWhere}`,
        baseParams
      );
      if (current.rowCount === 0) throw new Error("Customer not found.");
      const pipelineId = current.rows[0].pipeline_id as string | null;
      const stageResult = await pool.query(
        "SELECT name FROM pipeline_stages WHERE id = $1 AND pipeline_id = $2",
        [pipelineStageId, pipelineId]
      );
      if (stageResult.rowCount === 0) throw new Error("Stage not found in pipeline.");
      const stageName = stageResult.rows[0].name as string;
      const lifecycle = stageNameToLifecycle(stageName);
      const lifecycleSet = lifecycle ? `, lifecycle_stage = $3` : "";
      const lifecycleParam = lifecycle ?? null;
      const update = lifecycle
        ? await pool.query(
            `UPDATE customers SET pipeline_stage_id = $1${lifecycleSet}, updated_at = now() WHERE ${baseWhere} RETURNING id`,
            [pipelineStageId, lifecycleParam, ...baseParams]
          )
        : await pool.query(
            `UPDATE customers SET pipeline_stage_id = $1, updated_at = now() WHERE ${baseWhere} RETURNING id`,
            [pipelineStageId, ...baseParams]
          );
      if (update.rowCount === 0) throw new Error("Customer not found.");
      return;
    }

    case "set_lifecycle": {
      const lifecycleStage = payload.lifecycleStage as LifecycleStage;
      if (!lifecycleStage) throw new Error("lifecycleStage is required.");
      const pipelineStageId = await resolveStageForLifecycle(context, lifecycleStage);
      const stageSet = pipelineStageId ? `, pipeline_stage_id = $3` : "";
      const update = pipelineStageId
        ? await pool.query(
            `UPDATE customers SET lifecycle_stage = $1${stageSet}, updated_at = now() WHERE ${baseWhere} RETURNING id`,
            [lifecycleStage, pipelineStageId, ...baseParams]
          )
        : await pool.query(
            `UPDATE customers SET lifecycle_stage = $1, updated_at = now() WHERE ${baseWhere} RETURNING id`,
            [lifecycleStage, ...baseParams]
          );
      if (update.rowCount === 0) throw new Error("Customer not found.");
      return;
    }

    case "set_priority": {
      const priority = payload.priority as "low" | "medium" | "high";
      if (!priority) throw new Error("priority is required.");
      const result = await pool.query(
        `UPDATE customers SET priority = $3, updated_at = now() WHERE ${baseWhere} RETURNING id`,
        [...baseParams, priority]
      );
      if (result.rowCount === 0) throw new Error("Customer not found.");
      return;
    }

    case "set_outcome": {
      const outcome = payload.outcome as "in_progress" | "won" | "lost" | "nurture";
      if (!outcome) throw new Error("outcome is required.");
      const closedAt = outcome === "in_progress" || outcome === "nurture" ? null : new Date().toISOString();
      const result = await pool.query(
        `UPDATE customers SET outcome = $3, closed_at = $4, updated_at = now() WHERE ${baseWhere} RETURNING id`,
        [...baseParams, outcome, closedAt]
      );
      if (result.rowCount === 0) throw new Error("Customer not found.");
      return;
    }

    default:
      throw new Error("Unsupported bulk action.");
  }
}

async function resolveStageForLifecycle(
  context: CRMContext,
  lifecycleStage: LifecycleStage
): Promise<string | null> {
  try {
    const pipeline = await getDefaultPipeline(toCRMScope(context));
    const targetName = lifecycleToStageName(lifecycleStage);
    const stage = pipeline.stages.find(
      (s) => s.name.toLowerCase() === targetName.toLowerCase()
    );
    return stage?.id ?? pipeline.stages[0]?.id ?? null;
  } catch {
    return null;
  }
}

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

export async function findDuplicateGroups(context: CRMContext): Promise<DuplicateGroup[]> {
  const orgWhere = context.organizationId
    ? `c.organization_id = '${context.organizationId}'`
    : `c.assigned_to_user_id = '${context.userId}'`;

  const groups: DuplicateGroup[] = [];
  const seenIds = new Set<string>();

  const emailResult = await pool.query(
    `SELECT c.id, c.full_name, c.email, c.company, lower(c.email) AS match_key
     FROM customers c
     WHERE ${orgWhere} AND c.email IS NOT NULL AND c.email <> ''
       AND lower(c.email) IN (
         SELECT lower(email) FROM customers
         WHERE ${orgWhere} AND email IS NOT NULL AND email <> ''
         GROUP BY lower(email) HAVING COUNT(*) > 1
       )
     ORDER BY lower(c.email), c.created_at ASC`,
    []
  );
  addGroupsFromRows(emailResult.rows, "Same email", groups, seenIds);

  const nameResult = await pool.query(
    `SELECT c.id, c.full_name, c.email, c.company, lower(c.full_name) AS match_key
     FROM customers c
     WHERE ${orgWhere} AND c.full_name IS NOT NULL AND c.full_name <> ''
       AND lower(c.full_name) IN (
         SELECT lower(full_name) FROM customers
         WHERE ${orgWhere} AND full_name IS NOT NULL AND full_name <> ''
         GROUP BY lower(full_name) HAVING COUNT(*) > 1
       )
     ORDER BY lower(c.full_name), c.created_at ASC`,
    []
  );
  addGroupsFromRows(nameResult.rows, "Same name", groups, seenIds);

  return groups;
}

function addGroupsFromRows(
  rows: Record<string, unknown>[],
  reason: string,
  groups: DuplicateGroup[],
  seenIds: Set<string>
): void {
  const byKey = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = (row.match_key as string) ?? "";
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(row);
  }

  for (const groupRows of byKey.values()) {
    if (groupRows.length < 2) continue;
    const ids = groupRows.map((r) => r.id as string);
    if (ids.every((id) => seenIds.has(id))) continue;
    ids.forEach((id) => seenIds.add(id));
    const canonical = groupRows[0];
    groups.push({
      canonicalCustomerId: canonical.id as string,
      canonicalName: canonical.full_name as string,
      customers: groupRows.map((r) => ({
        id: r.id as string,
        fullName: r.full_name as string,
        email: (r.email as string | null) ?? null,
        company: (r.company as string | null) ?? null,
        reason
      }))
    });
  }
}

export async function mergeCustomers(
  context: CRMContext,
  input: CustomerMergeInput
): Promise<void> {
  const baseWhere = context.organizationId
    ? "id = $1 AND organization_id = $2"
    : "id = $1 AND assigned_to_user_id = $2";
  const baseParams = (id: string) => [id, context.organizationId ?? context.userId];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const primaryCheck = await client.query(
      `SELECT id FROM customers WHERE ${baseWhere}`,
      baseParams(input.primaryCustomerId)
    );
    const secondaryCheck = await client.query(
      `SELECT id FROM customers WHERE ${baseWhere}`,
      baseParams(input.secondaryCustomerId)
    );
    if (primaryCheck.rowCount === 0 || secondaryCheck.rowCount === 0) {
      throw new CustomerError("Customer not found.", 404);
    }

    await client.query(
      "UPDATE customer_activities SET customer_id = $1 WHERE customer_id = $2",
      [input.primaryCustomerId, input.secondaryCustomerId]
    );
    await client.query(
      "UPDATE customer_follow_ups SET customer_id = $1 WHERE customer_id = $2",
      [input.primaryCustomerId, input.secondaryCustomerId]
    );
    await client.query(
      "UPDATE documents SET customer_id = $1 WHERE customer_id = $2",
      [input.primaryCustomerId, input.secondaryCustomerId]
    );
    await client.query(
      "UPDATE feedback_requests SET customer_id = $1 WHERE customer_id = $2",
      [input.primaryCustomerId, input.secondaryCustomerId]
    );
    await client.query(
      "UPDATE ratings SET customer_id = $1 WHERE customer_id = $2",
      [input.primaryCustomerId, input.secondaryCustomerId]
    );

    const customFields = await client.query(
      "SELECT custom_field_definition_id, value FROM custom_field_values WHERE customer_id = $1",
      [input.secondaryCustomerId]
    );
    for (const row of customFields.rows) {
      await client.query(
        `INSERT INTO custom_field_values (customer_id, custom_field_definition_id, value)
         VALUES ($1, $2, $3)
         ON CONFLICT (customer_id, custom_field_definition_id)
         DO NOTHING`,
        [input.primaryCustomerId, row.custom_field_definition_id, row.value]
      );
    }

    await client.query("DELETE FROM customers WHERE id = $1", [input.secondaryCustomerId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function importCustomers(
  context: CRMContext,
  rows: CustomerImportRow[]
): Promise<CustomerImportResult> {
  const result: CustomerImportResult = { created: 0, updated: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.fullName || row.fullName.trim().length === 0) {
        throw new Error("fullName is required.");
      }
      let existingId: string | null = null;
      if (row.email) {
        const existing = await pool.query(
          context.organizationId
            ? "SELECT id FROM customers WHERE organization_id = $1 AND lower(email) = lower($2)"
            : "SELECT id FROM customers WHERE assigned_to_user_id = $1 AND lower(email) = lower($2)",
          [context.organizationId ?? context.userId, row.email]
        );
        if (existing.rowCount !== 0) {
          existingId = existing.rows[0].id as string;
        }
      }

      if (existingId) {
        await pool.query(
          `UPDATE customers SET
             full_name = COALESCE($3, full_name),
             phone = COALESCE($4, phone),
             company = COALESCE($5, company),
             lifecycle_stage = COALESCE($6, lifecycle_stage),
             priority = COALESCE($7, priority),
             source = COALESCE($8, source),
             notes = COALESCE($9, notes),
             updated_at = now()
           WHERE id = $1`,
          [
            existingId,
            null,
            row.fullName,
            row.phone ?? null,
            row.company ?? null,
            row.lifecycleStage ?? null,
            row.priority ?? null,
            row.source ?? null,
            row.notes ?? null
          ]
        );
        result.updated++;
      } else {
        await createCustomer(context, {
          fullName: row.fullName,
          email: row.email ?? null,
          phone: row.phone ?? null,
          company: row.company ?? null,
          lifecycleStage: row.lifecycleStage ?? "new",
          priority: row.priority ?? "medium",
          source: row.source ?? "import",
          notes: row.notes ?? null
        });
        result.created++;
      }
    } catch (error) {
      result.errors.push({
        row: i + 1,
        error: error instanceof Error ? error.message : "Import failed"
      });
    }
  }

  return result;
}
