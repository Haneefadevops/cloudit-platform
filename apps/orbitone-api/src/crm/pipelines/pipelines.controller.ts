import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { RequireCRMGuard } from "../../common/guards/require-crm.guard";
import { RequireModule } from "../../common/decorators/require-module.decorator";
import { AuthUser } from "../../common/decorators/auth-user.decorator";
import type { AuthContext } from "../../auth/types";
import { PipelinesService } from "./pipelines.service";
import {
  pipelineInputSchema,
  pipelineStageInputSchema,
} from "./pipelines.schemas";

@ApiTags("crm-pipelines")
@Controller("v2/crm/pipelines")
@UseGuards(RequireCRMGuard)
@RequireModule("orbitone", "crm")
@ApiBearerAuth()
export class PipelinesController {
  constructor(private readonly pipelinesService: PipelinesService) {}

  @Get()
  @ApiOperation({ summary: "List pipelines" })
  async findAll(@AuthUser() user: AuthContext) {
    const pipelines = await this.pipelinesService.listPipelines(user);
    return { ok: true, data: pipelines };
  }

  @Get("default")
  @ApiOperation({ summary: "Get default pipeline" })
  async getDefault(@AuthUser() user: AuthContext) {
    const pipeline = await this.pipelinesService.getDefaultPipeline(user);
    return { ok: true, data: pipeline };
  }

  @Put(":id")
  @ApiOperation({ summary: "Update pipeline" })
  async update(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = pipelineInputSchema.partial().safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid pipeline details.");
    }
    const pipeline = await this.pipelinesService.updatePipeline(
      user,
      id,
      parsed.data,
    );
    if (!pipeline) {
      throw new NotFoundException("Pipeline not found.");
    }
    return { ok: true, data: pipeline };
  }

  @Post(":id/stages")
  @HttpCode(201)
  @ApiOperation({ summary: "Create pipeline stage" })
  async createStage(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = pipelineStageInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid stage details.");
    }
    const stage = await this.pipelinesService.createStage(
      user,
      id,
      parsed.data,
    );
    return { ok: true, data: stage };
  }

  @Put("stages/:stageId")
  @ApiOperation({ summary: "Update pipeline stage" })
  async updateStage(
    @AuthUser() user: AuthContext,
    @Param("stageId") stageId: string,
    @Body() body: unknown,
  ) {
    const parsed = pipelineStageInputSchema.partial().safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid stage details.");
    }
    const stage = await this.pipelinesService.updateStage(
      user,
      stageId,
      parsed.data,
    );
    if (!stage) {
      throw new NotFoundException("Stage not found.");
    }
    return { ok: true, data: stage };
  }

  @Delete("stages/:stageId")
  @ApiOperation({ summary: "Delete pipeline stage" })
  async removeStage(
    @AuthUser() user: AuthContext,
    @Param("stageId") stageId: string,
    @Body() body: { fallbackStageId?: string },
  ) {
    const fallbackStageId =
      typeof body?.fallbackStageId === "string"
        ? body.fallbackStageId
        : undefined;
    const deleted = await this.pipelinesService.deleteStage(
      user,
      stageId,
      fallbackStageId,
    );
    if (!deleted) {
      throw new NotFoundException("Stage not found.");
    }
    return { ok: true, data: { deleted: true } };
  }
}
