import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { PlanService } from "../../common/services/plan.service";
import type {
  CRMTemplate,
  CRMTemplateInput,
} from "../../common/contracts/orbitone.v2";
import type { AuthContext } from "../../auth/types";
import { CRMScope, getCRMScope } from "../crm.types";

@Injectable()
export class TemplatesService {
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
    return this.planService.getPlanLimit(plan).maxTemplates;
  }

  async listTemplates(user: AuthContext): Promise<CRMTemplate[]> {
    const scope = getCRMScope(user);
    const result = await this.databaseService.query(
      `SELECT * FROM crm_templates
       WHERE ${this.scopeClause("crm_templates", 1)}
       ORDER BY type ASC, name ASC`,
      this.scopeParams(scope),
    );
    return result.rows.map((row) => this.mapTemplate(row));
  }

  async getTemplate(
    user: AuthContext,
    id: string,
  ): Promise<CRMTemplate | null> {
    const scope = getCRMScope(user);
    const result = await this.databaseService.query(
      `SELECT * FROM crm_templates
       WHERE id = $1 AND (${this.scopeClause("crm_templates", 2)})`,
      [id, ...this.scopeParams(scope)],
    );
    if (result.rowCount === 0) return null;
    return this.mapTemplate(result.rows[0]);
  }

  async createTemplate(
    user: AuthContext,
    input: CRMTemplateInput,
  ): Promise<CRMTemplate> {
    const scope = getCRMScope(user);
    const limit = this.assertPlanLimit(scope, user);
    if (limit !== null) {
      const countResult = await this.databaseService.query(
        `SELECT COUNT(*) FROM crm_templates WHERE ${this.scopeClause("crm_templates", 1)}`,
        this.scopeParams(scope),
      );
      if (Number(countResult.rows[0].count) >= limit) {
        throw new TemplateError(
          `Templates limited to ${limit} on your plan.`,
          402,
        );
      }
    }

    const result = await this.databaseService.query(
      `INSERT INTO crm_templates
         (organization_id, owner_user_id, name, type, subject, body)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        scope.organizationId,
        scope.ownerUserId,
        input.name,
        input.type,
        input.subject ?? null,
        input.body,
      ],
    );
    return this.mapTemplate(result.rows[0]);
  }

  async updateTemplate(
    user: AuthContext,
    id: string,
    input: Partial<CRMTemplateInput>,
  ): Promise<CRMTemplate | null> {
    const scope = getCRMScope(user);
    const existing = await this.getTemplate(user, id);
    if (!existing) return null;

    const result = await this.databaseService.query(
      `UPDATE crm_templates
       SET name = $1, type = $2, subject = $3, body = $4, updated_at = now()
       WHERE id = $5 AND (${this.scopeClause("crm_templates", 6)})
       RETURNING *`,
      [
        input.name ?? existing.name,
        input.type ?? existing.type,
        input.subject !== undefined ? input.subject : existing.subject,
        input.body ?? existing.body,
        id,
        ...this.scopeParams(scope),
      ],
    );
    if (result.rowCount === 0) return null;
    return this.mapTemplate(result.rows[0]);
  }

  async deleteTemplate(user: AuthContext, id: string): Promise<boolean> {
    const scope = getCRMScope(user);
    const result = await this.databaseService.query(
      `DELETE FROM crm_templates
       WHERE id = $1 AND (${this.scopeClause("crm_templates", 2)})
       RETURNING id`,
      [id, ...this.scopeParams(scope)],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  private mapTemplate(row: Record<string, unknown>): CRMTemplate {
    return {
      id: row.id as string,
      organizationId: (row.organization_id as string | null) ?? null,
      ownerUserId: (row.owner_user_id as string | null) ?? null,
      name: row.name as string,
      type: row.type as CRMTemplate["type"],
      subject: (row.subject as string | null) ?? null,
      body: row.body as string,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    };
  }
}

export class TemplateError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "TemplateError";
  }
}
