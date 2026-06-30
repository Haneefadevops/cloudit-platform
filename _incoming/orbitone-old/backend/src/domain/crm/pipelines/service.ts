import { pool } from "../../../db/postgres.js";
import type {
  Pipeline,
  PipelineStage,
  PipelineInput,
  PipelineStageInput
} from "../../../../../contracts/orbitone.v2.js";
import type { CRMScope } from "../custom-fields/service.js";

const defaultStageNames = [
  "New",
  "Contacted",
  "Qualified",
  "Meeting",
  "Proposal",
  "Customer",
  "Lost",
  "Archived"
];

function scopeClause(alias: string, offset: number) {
  return `${alias}.organization_id = $${offset} OR ${alias}.owner_user_id = $${offset + 1}`;
}

function scopeParams(scope: CRMScope): [string | null, string | null] {
  return [scope.organizationId, scope.ownerUserId];
}

export async function getDefaultPipeline(scope: CRMScope): Promise<Pipeline> {
  const existing = await pool.query(
    `SELECT id FROM pipelines
     WHERE is_default = TRUE AND (${scopeClause("pipelines", 1)})
     LIMIT 1`,
    scopeParams(scope)
  );

  if (existing.rowCount !== 0) {
    return getPipeline(scope, existing.rows[0].id as string) as Promise<Pipeline>;
  }

  return createDefaultPipeline(scope);
}

async function createDefaultPipeline(scope: CRMScope): Promise<Pipeline> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const pipelineResult = await client.query(
      `INSERT INTO pipelines (organization_id, owner_user_id, name, is_default, "order")
       VALUES ($1, $2, 'Default pipeline', TRUE, 0)
       RETURNING *`,
      [scope.organizationId, scope.ownerUserId]
    );
    const pipelineId = pipelineResult.rows[0].id as string;

    for (let i = 0; i < defaultStageNames.length; i++) {
      await client.query(
        `INSERT INTO pipeline_stages (pipeline_id, name, "order", color, probability)
         VALUES ($1, $2, $3, NULL, NULL)`,
        [pipelineId, defaultStageNames[i], i]
      );
    }

    await client.query("COMMIT");
    return mapPipeline(pipelineResult.rows[0], await fetchStages(pipelineId));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getPipeline(scope: CRMScope, id: string): Promise<Pipeline | null> {
  const result = await pool.query(
    `SELECT * FROM pipelines WHERE id = $1 AND (${scopeClause("pipelines", 2)})`,
    [id, ...scopeParams(scope)]
  );
  if (result.rowCount === 0) return null;
  const stages = await fetchStages(id);
  return mapPipeline(result.rows[0], stages);
}

export async function listPipelines(scope: CRMScope): Promise<Pipeline[]> {
  const result = await pool.query(
    `SELECT * FROM pipelines
     WHERE ${scopeClause("pipelines", 1)}
     ORDER BY "order" ASC, name ASC`,
    scopeParams(scope)
  );
  const pipelines: Pipeline[] = [];
  for (const row of result.rows) {
    const stages = await fetchStages(row.id as string);
    pipelines.push(mapPipeline(row, stages));
  }
  return pipelines;
}

export async function updatePipeline(
  scope: CRMScope,
  id: string,
  input: Partial<Pick<PipelineInput, "name">>
): Promise<Pipeline | null> {
  if (!input.name) {
    return getPipeline(scope, id);
  }
  const result = await pool.query(
    `UPDATE pipelines SET name = $1, updated_at = now()
     WHERE id = $2 AND (${scopeClause("pipelines", 3)})
     RETURNING *`,
    [input.name, id, ...scopeParams(scope)]
  );
  if (result.rowCount === 0) return null;
  const stages = await fetchStages(id);
  return mapPipeline(result.rows[0], stages);
}

export async function createStage(
  scope: CRMScope,
  pipelineId: string,
  input: PipelineStageInput
): Promise<PipelineStage> {
  const pipeline = await getPipeline(scope, pipelineId);
  if (!pipeline) {
    throw new PipelineError("Pipeline not found.", 404);
  }

  const maxOrderResult = await pool.query(
    "SELECT COALESCE(MAX(\"order\"), -1) AS max_order FROM pipeline_stages WHERE pipeline_id = $1",
    [pipelineId]
  );
  const order = input.order ?? Number(maxOrderResult.rows[0].max_order) + 1;

  const result = await pool.query(
    `INSERT INTO pipeline_stages (pipeline_id, name, "order", color, probability)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [pipelineId, input.name, order, input.color ?? null, input.probability ?? null]
  );
  return mapStage(result.rows[0]);
}

export async function updateStage(
  scope: CRMScope,
  stageId: string,
  input: Partial<PipelineStageInput>
): Promise<PipelineStage | null> {
  const stageResult = await pool.query(
    `SELECT s.* FROM pipeline_stages s
     JOIN pipelines p ON p.id = s.pipeline_id
     WHERE s.id = $1 AND (${scopeClause("p", 2)})`,
    [stageId, ...scopeParams(scope)]
  );
  if (stageResult.rowCount === 0) return null;
  const existing = stageResult.rows[0];

  const name = input.name ?? existing.name;
  const order = input.order ?? existing.order;
  const color = input.color !== undefined ? input.color : existing.color;
  const probability = input.probability !== undefined ? input.probability : existing.probability;

  const result = await pool.query(
    `UPDATE pipeline_stages SET name = $1, "order" = $2, color = $3, probability = $4, updated_at = now()
     WHERE id = $5
     RETURNING *`,
    [name, order, color, probability, stageId]
  );
  return mapStage(result.rows[0]);
}

export async function deleteStage(
  scope: CRMScope,
  stageId: string,
  fallbackStageId?: string
): Promise<boolean> {
  const stageResult = await pool.query(
    `SELECT s.* FROM pipeline_stages s
     JOIN pipelines p ON p.id = s.pipeline_id
     WHERE s.id = $1 AND (${scopeClause("p", 2)})`,
    [stageId, ...scopeParams(scope)]
  );
  if (stageResult.rowCount === 0) return false;
  const stage = stageResult.rows[0];
  const pipelineId = stage.pipeline_id as string;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let targetStageId = fallbackStageId;
    if (!targetStageId) {
      const firstStageResult = await client.query(
        "SELECT id FROM pipeline_stages WHERE pipeline_id = $1 AND id != $2 ORDER BY \"order\" ASC LIMIT 1",
        [pipelineId, stageId]
      );
      if (firstStageResult.rowCount === 0) {
        throw new PipelineError("Cannot delete the only stage in a pipeline.", 400);
      }
      targetStageId = firstStageResult.rows[0].id as string;
    }

    await client.query(
      "UPDATE customers SET pipeline_stage_id = $1 WHERE pipeline_stage_id = $2",
      [targetStageId, stageId]
    );

    await client.query("DELETE FROM pipeline_stages WHERE id = $1", [stageId]);
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function fetchStages(pipelineId: string): Promise<PipelineStage[]> {
  const result = await pool.query(
    "SELECT * FROM pipeline_stages WHERE pipeline_id = $1 ORDER BY \"order\" ASC",
    [pipelineId]
  );
  return result.rows.map(mapStage);
}

function mapPipeline(row: Record<string, unknown>, stages: PipelineStage[]): Pipeline {
  return {
    id: row.id as string,
    organizationId: (row.organization_id as string | null) ?? null,
    ownerUserId: (row.owner_user_id as string | null) ?? null,
    name: row.name as string,
    isDefault: (row.is_default as boolean) ?? false,
    stages
  };
}

function mapStage(row: Record<string, unknown>): PipelineStage {
  return {
    id: row.id as string,
    pipelineId: row.pipeline_id as string,
    name: row.name as string,
    order: Number(row.order),
    color: (row.color as string | null) ?? null,
    probability: row.probability === null || row.probability === undefined ? null : Number(row.probability)
  };
}

export class PipelineError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "PipelineError";
  }
}
