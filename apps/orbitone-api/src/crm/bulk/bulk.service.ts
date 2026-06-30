import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import type {
  BulkActionInput,
  BulkActionResult,
  CRMContext,
  CustomerImportRow,
  CustomerImportResult,
  DuplicateGroup,
  CustomerMergeInput,
  LifecycleStage,
} from "../../common/contracts/orbitone.v2";
import type { AuthContext } from "../../auth/types";
import { CRMScope, getCRMScope } from "../crm.types";
import { PipelinesService } from "../pipelines/pipelines.service";
import { CustomersService } from "../../customers/customers.service";

const lifecycleStages: LifecycleStage[] = [
  "new",
  "contacted",
  "qualified",
  "meeting",
  "proposal",
  "customer",
  "lost",
  "archived",
];

@Injectable()
export class BulkService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly pipelinesService: PipelinesService,
    @Inject(forwardRef(() => CustomersService))
    private readonly customersService: CustomersService,
  ) {}

  private toCRMContext(user: AuthContext): CRMContext {
    return {
      userId: user.id,
      organizationId: user.organizationId,
    };
  }

  private toCRMScope(context: CRMContext): CRMScope {
    return {
      organizationId: context.organizationId,
      ownerUserId: context.organizationId ? null : context.userId,
    };
  }

  private scopeWhere(
    alias: string,
    orgId: string | null,
    userId: string,
  ): string {
    return orgId
      ? `${alias}.organization_id = '${orgId}'`
      : `${alias}.assigned_to_user_id = '${userId}'`;
  }

  private baseWhere(context: CRMContext): { where: string; params: unknown[] } {
    return context.organizationId
      ? {
          where: "id = $1 AND organization_id = $2",
          params: [context.organizationId],
        }
      : {
          where: "id = $1 AND assigned_to_user_id = $2",
          params: [context.userId],
        };
  }

  private baseWhereWithOffset(
    context: CRMContext,
    offset: number,
  ): { where: string; params: unknown[] } {
    return context.organizationId
      ? {
          where: `id = $${offset} AND organization_id = $${offset + 1}`,
          params: [context.organizationId],
        }
      : {
          where: `id = $${offset} AND assigned_to_user_id = $${offset + 1}`,
          params: [context.userId],
        };
  }

  async bulkAction(
    user: AuthContext,
    input: BulkActionInput,
  ): Promise<BulkActionResult> {
    const context = this.toCRMContext(user);
    const result: BulkActionResult = { processed: 0, errors: [] };

    for (const id of input.ids) {
      try {
        await this.applyBulkAction(context, id, input.action, input.payload);
        result.processed++;
      } catch (error) {
        result.errors.push({
          id,
          error: error instanceof Error ? error.message : "Action failed",
        });
      }
    }

    return result;
  }

  private async applyBulkAction(
    context: CRMContext,
    customerId: string,
    action: BulkActionInput["action"],
    payload: Record<string, unknown>,
  ): Promise<void> {
    const { where, params } = this.baseWhere(context);
    const baseParams = [customerId, ...params];

    switch (action) {
      case "delete": {
        const result = await this.databaseService.query(
          `DELETE FROM customers WHERE ${where} RETURNING id`,
          baseParams,
        );
        if (result.rowCount === 0) throw new Error("Customer not found.");
        return;
      }

      case "assign": {
        const assignedToUserId = payload.assignedToUserId as string;
        if (!assignedToUserId) throw new Error("assignedToUserId is required.");
        if (!context.organizationId)
          throw new Error("Cannot assign outside an organization.");
        const member = await this.databaseService.query(
          "SELECT id FROM users WHERE id = $1 AND organization_id = $2",
          [assignedToUserId, context.organizationId],
        );
        if (member.rowCount === 0) throw new Error("Assignee is not a member.");
        const result = await this.databaseService.query(
          `UPDATE customers SET assigned_to_user_id = $3, updated_at = now() WHERE ${where} RETURNING id`,
          [...baseParams, assignedToUserId],
        );
        if (result.rowCount === 0) throw new Error("Customer not found.");
        return;
      }

      case "set_stage": {
        const pipelineStageId = payload.pipelineStageId as string;
        if (!pipelineStageId) throw new Error("pipelineStageId is required.");
        const current = await this.databaseService.query(
          `SELECT pipeline_id FROM customers WHERE ${where}`,
          baseParams,
        );
        if (current.rowCount === 0) throw new Error("Customer not found.");
        const pipelineId = current.rows[0].pipeline_id as string | null;
        const stageResult = await this.databaseService.query(
          "SELECT name FROM pipeline_stages WHERE id = $1 AND pipeline_id = $2",
          [pipelineStageId, pipelineId],
        );
        if (stageResult.rowCount === 0)
          throw new Error("Stage not found in pipeline.");
        const stageName = stageResult.rows[0].name as string;
        const lifecycle = this.stageNameToLifecycle(stageName);
        const { where: updateWhere, params: whereParams } =
          this.baseWhereWithOffset(context, lifecycle ? 3 : 2);
        const update = await this.databaseService.query(
          `UPDATE customers SET pipeline_stage_id = $1${
            lifecycle ? `, lifecycle_stage = $2` : ""
          }, updated_at = now() WHERE ${updateWhere} RETURNING id`,
          lifecycle
            ? [pipelineStageId, lifecycle, customerId, ...whereParams]
            : [pipelineStageId, customerId, ...whereParams],
        );
        if (update.rowCount === 0) throw new Error("Customer not found.");
        return;
      }

      case "set_lifecycle": {
        const lifecycleStage = payload.lifecycleStage as LifecycleStage;
        if (!lifecycleStage) throw new Error("lifecycleStage is required.");
        const pipelineStageId = await this.resolveStageForLifecycle(
          context,
          lifecycleStage,
        );
        const { where: updateWhere, params: whereParams } =
          this.baseWhereWithOffset(context, pipelineStageId ? 3 : 2);
        const update = await this.databaseService.query(
          `UPDATE customers SET lifecycle_stage = $1${
            pipelineStageId ? `, pipeline_stage_id = $2` : ""
          }, updated_at = now() WHERE ${updateWhere} RETURNING id`,
          pipelineStageId
            ? [lifecycleStage, pipelineStageId, customerId, ...whereParams]
            : [lifecycleStage, customerId, ...whereParams],
        );
        if (update.rowCount === 0) throw new Error("Customer not found.");
        return;
      }

      case "set_priority": {
        const priority = payload.priority as "low" | "medium" | "high";
        if (!priority) throw new Error("priority is required.");
        const result = await this.databaseService.query(
          `UPDATE customers SET priority = $3, updated_at = now() WHERE ${where} RETURNING id`,
          [...baseParams, priority],
        );
        if (result.rowCount === 0) throw new Error("Customer not found.");
        return;
      }

      case "set_outcome": {
        const outcome = payload.outcome as
          "in_progress" | "won" | "lost" | "nurture";
        if (!outcome) throw new Error("outcome is required.");
        const closedAt =
          outcome === "in_progress" || outcome === "nurture"
            ? null
            : new Date().toISOString();
        const result = await this.databaseService.query(
          `UPDATE customers SET outcome = $3, closed_at = $4, updated_at = now() WHERE ${where} RETURNING id`,
          [...baseParams, outcome, closedAt],
        );
        if (result.rowCount === 0) throw new Error("Customer not found.");
        return;
      }

      default:
        throw new Error("Unsupported bulk action.");
    }
  }

  private async resolveStageForLifecycle(
    context: CRMContext,
    lifecycleStage: LifecycleStage,
  ): Promise<string | null> {
    try {
      const pipeline = await this.pipelinesService.getDefaultPipelineByScope(
        this.toCRMScope(context),
      );
      const targetName = this.lifecycleToStageName(lifecycleStage);
      const stage = pipeline.stages.find(
        (s) => s.name.toLowerCase() === targetName.toLowerCase(),
      );
      return stage?.id ?? pipeline.stages[0]?.id ?? null;
    } catch {
      return null;
    }
  }

  private stageNameToLifecycle(name: string): LifecycleStage | null {
    const normalized = name.toLowerCase().replace(/\s+/g, "_");
    if (lifecycleStages.includes(normalized as LifecycleStage)) {
      return normalized as LifecycleStage;
    }
    return null;
  }

  private lifecycleToStageName(stage: LifecycleStage): string {
    return stage.charAt(0).toUpperCase() + stage.slice(1).replace(/_/g, " ");
  }

  async findDuplicateGroups(user: AuthContext): Promise<DuplicateGroup[]> {
    const context = this.toCRMContext(user);
    const orgWhere = this.scopeWhere(
      "c",
      context.organizationId,
      context.userId,
    );

    const groups: DuplicateGroup[] = [];
    const seenIds = new Set<string>();

    const emailResult = await this.databaseService.query(
      `SELECT c.id, c.full_name, c.email, c.company, lower(c.email) AS match_key
       FROM customers c
       WHERE ${orgWhere} AND c.email IS NOT NULL AND c.email <> ''
         AND lower(c.email) IN (
           SELECT lower(email) FROM customers
           WHERE ${orgWhere} AND email IS NOT NULL AND email <> ''
           GROUP BY lower(email) HAVING COUNT(*) > 1
         )
       ORDER BY lower(c.email), c.created_at ASC`,
      [],
    );
    this.addGroupsFromRows(emailResult.rows, "Same email", groups, seenIds);

    const nameResult = await this.databaseService.query(
      `SELECT c.id, c.full_name, c.email, c.company, lower(c.full_name) AS match_key
       FROM customers c
       WHERE ${orgWhere} AND c.full_name IS NOT NULL AND c.full_name <> ''
         AND lower(c.full_name) IN (
           SELECT lower(full_name) FROM customers
           WHERE ${orgWhere} AND full_name IS NOT NULL AND full_name <> ''
           GROUP BY lower(full_name) HAVING COUNT(*) > 1
         )
       ORDER BY lower(c.full_name), c.created_at ASC`,
      [],
    );
    this.addGroupsFromRows(nameResult.rows, "Same name", groups, seenIds);

    return groups;
  }

  private addGroupsFromRows(
    rows: Record<string, unknown>[],
    reason: string,
    groups: DuplicateGroup[],
    seenIds: Set<string>,
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
          reason,
        })),
      });
    }
  }

  async mergeCustomers(
    user: AuthContext,
    input: CustomerMergeInput,
  ): Promise<void> {
    const context = this.toCRMContext(user);
    const { where, params } = this.baseWhere(context);
    const baseParams = (id: string) => [id, ...params];

    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");

      const primaryCheck = await client.query(
        `SELECT id FROM customers WHERE ${where}`,
        [...baseParams(input.primaryCustomerId)],
      );
      const secondaryCheck = await client.query(
        `SELECT id FROM customers WHERE ${where}`,
        [...baseParams(input.secondaryCustomerId)],
      );
      if (primaryCheck.rowCount === 0 || secondaryCheck.rowCount === 0) {
        throw new CustomerError("Customer not found.", 404);
      }

      await client.query(
        "UPDATE customer_activities SET customer_id = $1 WHERE customer_id = $2",
        [input.primaryCustomerId, input.secondaryCustomerId],
      );
      await client.query(
        "UPDATE customer_follow_ups SET customer_id = $1 WHERE customer_id = $2",
        [input.primaryCustomerId, input.secondaryCustomerId],
      );
      await client.query(
        "UPDATE documents SET customer_id = $1 WHERE customer_id = $2",
        [input.primaryCustomerId, input.secondaryCustomerId],
      );
      await client.query(
        "UPDATE feedback_requests SET customer_id = $1 WHERE customer_id = $2",
        [input.primaryCustomerId, input.secondaryCustomerId],
      );
      await client.query(
        "UPDATE ratings SET customer_id = $1 WHERE customer_id = $2",
        [input.primaryCustomerId, input.secondaryCustomerId],
      );

      const customFields = await client.query(
        "SELECT custom_field_definition_id, value FROM custom_field_values WHERE customer_id = $1",
        [input.secondaryCustomerId],
      );
      for (const row of customFields.rows) {
        await client.query(
          `INSERT INTO custom_field_values (customer_id, custom_field_definition_id, value)
           VALUES ($1, $2, $3)
           ON CONFLICT (customer_id, custom_field_definition_id)
           DO NOTHING`,
          [input.primaryCustomerId, row.custom_field_definition_id, row.value],
        );
      }

      await client.query("DELETE FROM customers WHERE id = $1", [
        input.secondaryCustomerId,
      ]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async importCustomers(
    user: AuthContext,
    rows: CustomerImportRow[],
  ): Promise<CustomerImportResult> {
    const context = this.toCRMContext(user);
    const result: CustomerImportResult = { created: 0, updated: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.fullName || row.fullName.trim().length === 0) {
          throw new Error("fullName is required.");
        }
        let existingId: string | null = null;
        if (row.email) {
          const existing = await this.databaseService.query(
            context.organizationId
              ? "SELECT id FROM customers WHERE organization_id = $1 AND lower(email) = lower($2)"
              : "SELECT id FROM customers WHERE assigned_to_user_id = $1 AND lower(email) = lower($2)",
            [context.organizationId ?? context.userId, row.email],
          );
          if (existing.rowCount !== 0) {
            existingId = existing.rows[0].id as string;
          }
        }

        if (existingId) {
          await this.databaseService.query(
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
              row.notes ?? null,
            ],
          );
          result.updated++;
        } else {
          await this.customersService.createCustomer(user, {
            fullName: row.fullName,
            email: row.email ?? null,
            phone: row.phone ?? null,
            company: row.company ?? null,
            lifecycleStage: row.lifecycleStage ?? "new",
            priority: row.priority ?? "medium",
            source: row.source ?? "import",
            notes: row.notes ?? null,
          });
          result.created++;
        }
      } catch (error) {
        result.errors.push({
          row: i + 1,
          error: error instanceof Error ? error.message : "Import failed",
        });
      }
    }

    return result;
  }
}

export class CustomerError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "CustomerError";
  }
}
