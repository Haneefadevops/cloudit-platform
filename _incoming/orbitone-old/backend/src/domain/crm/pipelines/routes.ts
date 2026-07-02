import { Router } from "express";
import { requireUser, getUser } from "../../../middleware/auth.js";
import { requireCRM } from "../../../middleware/plan.js";
import {
  getDefaultPipeline,
  listPipelines,
  updatePipeline,
  createStage,
  updateStage,
  deleteStage,
  PipelineError
} from "./service.js";
import { getCRMScope } from "../custom-fields/service.js";
import { pipelineInputSchema, pipelineStageInputSchema } from "./schemas.js";

export const pipelinesRouter = Router();

pipelinesRouter.use(requireUser, requireCRM);

function getScope(req: Parameters<typeof getUser>[0]) {
  return getCRMScope(getUser(req));
}

pipelinesRouter.get("/", async (req, res, next) => {
  try {
    const pipelines = await listPipelines(getScope(req));
    res.json({ ok: true, data: pipelines });
  } catch (error) {
    next(error);
  }
});

pipelinesRouter.get("/default", async (req, res, next) => {
  try {
    const pipeline = await getDefaultPipeline(getScope(req));
    res.json({ ok: true, data: pipeline });
  } catch (error) {
    next(error);
  }
});

pipelinesRouter.put("/:id", async (req, res, next) => {
  try {
    const parsed = pipelineInputSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "Invalid pipeline details." });
      return;
    }
    const pipeline = await updatePipeline(getScope(req), req.params.id, parsed.data);
    if (!pipeline) {
      res.status(404).json({ ok: false, error: "Pipeline not found." });
      return;
    }
    res.json({ ok: true, data: pipeline });
  } catch (error) {
    next(error);
  }
});

pipelinesRouter.post("/:id/stages", async (req, res, next) => {
  try {
    const parsed = pipelineStageInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "Invalid stage details." });
      return;
    }
    const stage = await createStage(getScope(req), req.params.id, parsed.data);
    res.status(201).json({ ok: true, data: stage });
  } catch (error) {
    if (error instanceof PipelineError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

pipelinesRouter.put("/stages/:stageId", async (req, res, next) => {
  try {
    const parsed = pipelineStageInputSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "Invalid stage details." });
      return;
    }
    const stage = await updateStage(getScope(req), req.params.stageId, parsed.data);
    if (!stage) {
      res.status(404).json({ ok: false, error: "Stage not found." });
      return;
    }
    res.json({ ok: true, data: stage });
  } catch (error) {
    next(error);
  }
});

pipelinesRouter.delete("/stages/:stageId", async (req, res, next) => {
  try {
    const fallbackStageId = typeof req.body?.fallbackStageId === "string" ? req.body.fallbackStageId : undefined;
    const deleted = await deleteStage(getScope(req), req.params.stageId, fallbackStageId);
    if (!deleted) {
      res.status(404).json({ ok: false, error: "Stage not found." });
      return;
    }
    res.json({ ok: true, data: { deleted: true } });
  } catch (error) {
    if (error instanceof PipelineError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});
