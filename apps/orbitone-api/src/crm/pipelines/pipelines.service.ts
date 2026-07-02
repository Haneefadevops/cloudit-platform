import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import type {
  Pipeline,
  PipelineStage,
  PipelineInput,
  PipelineStageInput,
} from "../../common/contracts/orbitone.v2";
import type { AuthContext } from "../../auth/types";
import { CRMScope, getCRMScope } from "../crm.types";

const defaultStageNames = [
  "New",
  "Contacted",
  "Qualified",
  "Meeting",
  "Proposal",
  "Customer",
  "Lost",
  "Archived",
];

@Injectable()
export class PipelinesService {
  constructor(private readonly databaseService: DatabaseService) {}

  private scopeClause(alias: string, offset: number) {
    return `${alias}.organization_id = $${offset} OR ${alias}.owner_user_id = $${offset + 1}`;
  }

  private scopeParams(scope: CRMScope): [string | null, string | null] {
    return [scope.organizationId, scope.ownerUserId];
  }

  async getDefaultPipeline(user: AuthContext): Promise<Pipeline> {
    return this.getDefaultPipelineByScope(getCRMScope(user));
  }

  async getDefaultPipelineByScope(scope: CRMScope): Promise<Pipeline> {
    const existing = await this.databaseService.query(
      `SELECT id FROM pipelines
       WHERE is_default = TRUE AND (${this.scopeClause("pipelines", 1)})
       LIMIT 1`,
      this.scopeParams(scope),
    );

    if (existing.rowCount !== 0) {
      return this.getPipelineByScope(
        scope,
        existing.rows[0].id as string,
      ) as Promise<Pipeline>;
    }

    return this.createDefaultPipelineByScope(scope);
  }

  private async createDefaultPipelineByScope(
    scope: CRMScope,
  ): Promise<Pipeline> {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");

      const pipelineResult = await client.query(
        `INSERT INTO pipelines (organization_id, owner_user_id, name, is_default, "order")
         VALUES ($1, $2, 'Default pipeline', TRUE, 0)
         RETURNING *`,
        [scope.organizationId, scope.ownerUserId],
      );
      const pipelineId = pipelineResult.rows[0].id as string;

      for (let i = 0; i < defaultStageNames.length; i++) {
        await client.query(
          `INSERT INTO pipeline_stages (pipeline_id, name, "order", color, probability)
           VALUES ($1, $2, $3, NULL, NULL)`,
          [pipelineId, defaultStageNames[i], i],
        );
      }

      await client.query("COMMIT");
      return this.mapPipeline(
        pipelineResult.rows[0],
        await this.fetchStages(pipelineId),
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getPipeline(user: AuthContext, id: string): Promise<Pipeline | null> {
    return this.getPipelineByScope(getCRMScope(user), id);
  }

  async getPipelineByScope(
    scope: CRMScope,
    id: string,
  ): Promise<Pipeline | null> {
    const result = await this.databaseService.query(
      `SELECT * FROM pipelines WHERE id = $1 AND (${this.scopeClause("pipelines", 2)})`,
      [id, ...this.scopeParams(scope)],
    );
    if (result.rowCount === 0) return null;
    const stages = await this.fetchStages(id);
    return this.mapPipeline(result.rows[0], stages);
  }

  async listPipelines(user: AuthContext): Promise<Pipeline[]> {
    const scope = getCRMScope(user);
    const result = await this.databaseService.query(
      `SELECT * FROM pipelines
       WHERE ${this.scopeClause("pipelines", 1)}
       ORDER BY "order" ASC, name ASC`,
      this.scopeParams(scope),
    );
    const pipelines: Pipeline[] = [];
    for (const row of result.rows) {
      const stages = await this.fetchStages(row.id as string);
      pipelines.push(this.mapPipeline(row, stages));
    }
    return pipelines;
  }

  async updatePipeline(
    user: AuthContext,
    id: string,
    input: Partial<Pick<PipelineInput, "name">>,
  ): Promise<Pipeline | null> {
    const scope = getCRMScope(user);
    if (!input.name) {
      return this.getPipeline(user, id);
    }
    const result = await this.databaseService.query(
      `UPDATE pipelines SET name = $1, updated_at = now()
       WHERE id = $2 AND (${this.scopeClause("pipelines", 3)})
       RETURNING *`,
      [input.name, id, ...this.scopeParams(scope)],
    );
    if (result.rowCount === 0) return null;
    const stages = await this.fetchStages(id);
    return this.mapPipeline(result.rows[0], stages);
  }

  async createStage(
    user: AuthContext,
    pipelineId: string,
    input: PipelineStageInput,
  ): Promise<PipelineStage> {
    const scope = getCRMScope(user);
    const pipeline = await this.getPipeline(user, pipelineId);
    if (!pipeline) {
      throw new PipelineError("Pipeline not found.", 404);
    }

    const maxOrderResult = await this.databaseService.query(
      'SELECT COALESCE(MAX("order"), -1) AS max_order FROM pipeline_stages WHERE pipeline_id = $1',
      [pipelineId],
    );
    const order = input.order ?? Number(maxOrderResult.rows[0].max_order) + 1;

    const result = await this.databaseService.query(
      `INSERT INTO pipeline_stages (pipeline_id, name, "order", color, probability)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        pipelineId,
        input.name,
        order,
        input.color ?? null,
        input.probability ?? null,
      ],
    );
    return this.mapStage(result.rows[0]);
  }

  async updateStage(
    user: AuthContext,
    stageId: string,
    input: Partial<PipelineStageInput>,
  ): Promise<PipelineStage | null> {
    const scope = getCRMScope(user);
    const stageResult = await this.databaseService.query(
      `SELECT s.* FROM pipeline_stages s
       JOIN pipelines p ON p.id = s.pipeline_id
       WHERE s.id = $1 AND (${this.scopeClause("p", 2)})`,
      [stageId, ...this.scopeParams(scope)],
    );
    if (stageResult.rowCount === 0) return null;
    const existing = stageResult.rows[0];

    const name = input.name ?? existing.name;
    const order = input.order ?? existing.order;
    const color = input.color !== undefined ? input.color : existing.color;
    const probability =
      input.probability !== undefined
        ? input.probability
        : existing.probability;

    const result = await this.databaseService.query(
      `UPDATE pipeline_stages SET name = $1, "order" = $2, color = $3, probability = $4, updated_at = now()
       WHERE id = $5
       RETURNING *`,
      [name, order, color, probability, stageId],
    );
    return this.mapStage(result.rows[0]);
  }

  async deleteStage(
    user: AuthContext,
    stageId: string,
    fallbackStageId?: string,
  ): Promise<boolean> {
    const scope = getCRMScope(user);
    const stageResult = await this.databaseService.query(
      `SELECT s.* FROM pipeline_stages s
       JOIN pipelines p ON p.id = s.pipeline_id
       WHERE s.id = $1 AND (${this.scopeClause("p", 2)})`,
      [stageId, ...this.scopeParams(scope)],
    );
    if (stageResult.rowCount === 0) return false;
    const stage = stageResult.rows[0];
    const pipelineId = stage.pipeline_id as string;

    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");

      let targetStageId = fallbackStageId;
      if (!targetStageId) {
        const firstStageResult = await client.query(
          'SELECT id FROM pipeline_stages WHERE pipeline_id = $1 AND id != $2 ORDER BY "order" ASC LIMIT 1',
          [pipelineId, stageId],
        );
        if (firstStageResult.rowCount === 0) {
          throw new PipelineError(
            "Cannot delete the only stage in a pipeline.",
            400,
          );
        }
        targetStageId = firstStageResult.rows[0].id as string;
      }

      await client.query(
        "UPDATE customers SET pipeline_stage_id = $1 WHERE pipeline_stage_id = $2",
        [targetStageId, stageId],
      );

      await client.query("DELETE FROM pipeline_stages WHERE id = $1", [
        stageId,
      ]);
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async fetchStages(pipelineId: string): Promise<PipelineStage[]> {
    const result = await this.databaseService.query(
      'SELECT * FROM pipeline_stages WHERE pipeline_id = $1 ORDER BY "order" ASC',
      [pipelineId],
    );
    return result.rows.map((row) => this.mapStage(row));
  }

  private mapPipeline(
    row: Record<string, unknown>,
    stages: PipelineStage[],
  ): Pipeline {
    return {
      id: row.id as string,
      organizationId: (row.organization_id as string | null) ?? null,
      ownerUserId: (row.owner_user_id as string | null) ?? null,
      name: row.name as string,
      isDefault: (row.is_default as boolean) ?? false,
      stages,
    };
  }

  private mapStage(row: Record<string, unknown>): PipelineStage {
    return {
      id: row.id as string,
      pipelineId: row.pipeline_id as string,
      name: row.name as string,
      order: Number(row.order),
      color: (row.color as string | null) ?? null,
      probability:
        row.probability === null || row.probability === undefined
          ? null
          : Number(row.probability),
    };
  }
}

export class PipelineError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "PipelineError";
  }
}
