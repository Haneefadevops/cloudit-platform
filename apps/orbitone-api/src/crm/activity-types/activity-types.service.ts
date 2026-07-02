import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { PlanService } from "../../common/services/plan.service";
import type {
  ActivityTypeDefinition,
  ActivityTypeDefinitionInput,
} from "../../common/contracts/orbitone.v2";
import type { AuthContext } from "../../auth/types";
import { CRMScope, getCRMScope } from "../crm.types";

@Injectable()
export class ActivityTypesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly planService: PlanService,
  ) {}

  private scopeClause(alias: string, offset: number) {
    return `${alias}.organization_id = $${offset} OR ${alias}.owner_user_id = $${offset + 1}`;
  }

  private scopeParams(scope: CRMScope): [string | null, string | null] {
    return [scope.organizationId, scope.ownerUserId];
  }

  private assertPlanLimit(scope: CRMScope, user: AuthContext): number | null {
    const plan = this.planService.getUserEffectivePlan(user);
    return this.planService.getPlanLimit(plan).maxActivityTypes;
  }

  async listActivityTypes(
    user: AuthContext,
  ): Promise<ActivityTypeDefinition[]> {
    const scope = getCRMScope(user);
    const result = await this.databaseService.query(
      `SELECT * FROM activity_type_definitions
       WHERE ${this.scopeClause("activity_type_definitions", 1)}
       ORDER BY "order" ASC, name ASC`,
      this.scopeParams(scope),
    );
    return result.rows.map((row) => this.mapActivityType(row));
  }

  async getActivityType(
    user: AuthContext,
    id: string,
  ): Promise<ActivityTypeDefinition | null> {
    const scope = getCRMScope(user);
    const result = await this.databaseService.query(
      `SELECT * FROM activity_type_definitions
       WHERE id = $1 AND (${this.scopeClause("activity_type_definitions", 2)})`,
      [id, ...this.scopeParams(scope)],
    );
    if (result.rowCount === 0) return null;
    return this.mapActivityType(result.rows[0]);
  }

  async getActivityTypeByKey(
    user: AuthContext,
    key: string,
  ): Promise<ActivityTypeDefinition | null> {
    const scope = getCRMScope(user);
    const result = await this.databaseService.query(
      `SELECT * FROM activity_type_definitions
       WHERE key = $1 AND (${this.scopeClause("activity_type_definitions", 2)})`,
      [key, ...this.scopeParams(scope)],
    );
    if (result.rowCount === 0) return null;
    return this.mapActivityType(result.rows[0]);
  }

  async createActivityType(
    user: AuthContext,
    input: ActivityTypeDefinitionInput,
  ): Promise<ActivityTypeDefinition> {
    const scope = getCRMScope(user);
    const limit = this.assertPlanLimit(scope, user);
    if (limit !== null) {
      const countResult = await this.databaseService.query(
        `SELECT COUNT(*) FROM activity_type_definitions WHERE ${this.scopeClause("activity_type_definitions", 1)}`,
        this.scopeParams(scope),
      );
      if (Number(countResult.rows[0].count) >= limit) {
        throw new ActivityTypeError(
          `Activity types limited to ${limit} on your plan.`,
          402,
        );
      }
    }

    this.validateInput(input);

    const result = await this.databaseService.query(
      `INSERT INTO activity_type_definitions
         (organization_id, owner_user_id, key, name, icon, "order")
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        scope.organizationId,
        scope.ownerUserId,
        input.key,
        input.name,
        input.icon ?? null,
        input.order ?? 0,
      ],
    );
    return this.mapActivityType(result.rows[0]);
  }

  async updateActivityType(
    user: AuthContext,
    id: string,
    input: Partial<ActivityTypeDefinitionInput>,
  ): Promise<ActivityTypeDefinition | null> {
    const scope = getCRMScope(user);
    const existing = await this.getActivityType(user, id);
    if (!existing) return null;

    const merged: ActivityTypeDefinitionInput = {
      key: input.key ?? existing.key,
      name: input.name ?? existing.name,
      icon: input.icon !== undefined ? input.icon : existing.icon,
      order: input.order ?? existing.order,
    };
    this.validateInput(merged);

    const result = await this.databaseService.query(
      `UPDATE activity_type_definitions
       SET key = $1, name = $2, icon = $3, "order" = $4, updated_at = now()
       WHERE id = $5 AND (${this.scopeClause("activity_type_definitions", 6)})
       RETURNING *`,
      [
        merged.key,
        merged.name,
        merged.icon,
        merged.order,
        id,
        ...this.scopeParams(scope),
      ],
    );
    if (result.rowCount === 0) return null;
    return this.mapActivityType(result.rows[0]);
  }

  async deleteActivityType(user: AuthContext, id: string): Promise<boolean> {
    const scope = getCRMScope(user);
    const result = await this.databaseService.query(
      `DELETE FROM activity_type_definitions
       WHERE id = $1 AND (${this.scopeClause("activity_type_definitions", 2)})
       RETURNING id`,
      [id, ...this.scopeParams(scope)],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  private validateInput(input: ActivityTypeDefinitionInput) {
    if (!input.name || input.name.trim().length === 0) {
      throw new ActivityTypeError("Name is required.", 400);
    }
    if (!input.key || !/^[a-z0-9_]+$/.test(input.key)) {
      throw new ActivityTypeError(
        "Key must contain only lowercase letters, numbers, and underscores.",
        400,
      );
    }
  }

  private mapActivityType(
    row: Record<string, unknown>,
  ): ActivityTypeDefinition {
    return {
      id: row.id as string,
      organizationId: (row.organization_id as string | null) ?? null,
      ownerUserId: (row.owner_user_id as string | null) ?? null,
      key: row.key as string,
      name: row.name as string,
      icon: (row.icon as string | null) ?? null,
      order: Number(row.order ?? 0),
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    };
  }
}

export class ActivityTypeError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "ActivityTypeError";
  }
}
