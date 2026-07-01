import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { z } from "zod";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { AssetsService } from "./assets.service";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const assetSchema = z.object({
  category_id: z.string().uuid().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  branch_id: z.string().uuid().optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  name: z.string().min(1),
  serial_number: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  model_number: z.string().optional().nullable(),
  modelNumber: z.string().optional().nullable(),
  purchase_date: dateSchema.optional().nullable(),
  purchaseDate: dateSchema.optional().nullable(),
  purchase_cost: z.coerce.number().nonnegative().optional().nullable(),
  purchaseCost: z.coerce.number().nonnegative().optional().nullable(),
  condition: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updateAssetSchema = assetSchema.partial();

const categorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
});

const assignmentSchema = z.object({
  asset_id: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  employee_id: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  assigned_at: z.string().optional().nullable(),
  assignedAt: z.string().optional().nullable(),
  expected_return_at: dateSchema.optional().nullable(),
  expectedReturnAt: dateSchema.optional().nullable(),
  condition_on_assignment: z.string().optional().nullable(),
  conditionOnAssignment: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

@ApiTags("assets")
@Controller("assets")
@UseGuards(SessionAuthGuard)
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @RequireModule("touchorbit", "assets")
  @ApiOperation({ summary: "List assets" })
  async findAll(@CurrentOrganization() organizationId: string) {
    const rows = await this.assetsService.findAll(organizationId);
    return { ok: true, data: rows };
  }

  @Post()
  @RequireModule("touchorbit", "assets")
  @ApiOperation({ summary: "Create asset" })
  async create(
    @CurrentOrganization() organizationId: string,
    @Body() body: unknown,
  ) {
    const parsed = assetSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid asset payload");
    }
    const row = await this.assetsService.create(organizationId, {
      categoryId: parsed.data.category_id ?? parsed.data.categoryId ?? null,
      branchId: parsed.data.branch_id ?? parsed.data.branchId ?? null,
      name: parsed.data.name,
      serialNumber:
        parsed.data.serial_number ?? parsed.data.serialNumber ?? null,
      modelNumber: parsed.data.model_number ?? parsed.data.modelNumber ?? null,
      purchaseDate:
        parsed.data.purchase_date ?? parsed.data.purchaseDate ?? null,
      purchaseCost:
        parsed.data.purchase_cost ?? parsed.data.purchaseCost ?? null,
      condition: parsed.data.condition ?? null,
      status: parsed.data.status ?? null,
      notes: parsed.data.notes ?? null,
    });
    return { ok: true, data: row };
  }

  @Get(":id")
  @RequireModule("touchorbit", "assets")
  @ApiOperation({ summary: "Get asset" })
  async findOne(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ) {
    const row = await this.assetsService.findOne(organizationId, id);
    return { ok: true, data: row };
  }

  @Patch(":id")
  @RequireModule("touchorbit", "assets")
  @ApiOperation({ summary: "Update asset" })
  async update(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateAssetSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid asset payload");
    }
    const row = await this.assetsService.update(organizationId, id, {
      categoryId: parsed.data.category_id ?? parsed.data.categoryId,
      branchId: parsed.data.branch_id ?? parsed.data.branchId,
      name: parsed.data.name,
      serialNumber: parsed.data.serial_number ?? parsed.data.serialNumber,
      modelNumber: parsed.data.model_number ?? parsed.data.modelNumber,
      purchaseDate: parsed.data.purchase_date ?? parsed.data.purchaseDate,
      purchaseCost: parsed.data.purchase_cost ?? parsed.data.purchaseCost,
      condition: parsed.data.condition,
      status: parsed.data.status,
      notes: parsed.data.notes,
    });
    return { ok: true, data: row };
  }

  @Delete(":id")
  @RequireModule("touchorbit", "assets")
  @ApiOperation({ summary: "Delete asset" })
  async delete(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ) {
    const result = await this.assetsService.delete(organizationId, id);
    return { ok: true, data: result };
  }
}

@ApiTags("asset-categories")
@Controller("asset-categories")
@UseGuards(SessionAuthGuard)
export class AssetCategoriesController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @RequireModule("touchorbit", "assets")
  @ApiOperation({ summary: "List asset categories" })
  async findAll(@CurrentOrganization() organizationId: string) {
    const rows = await this.assetsService.findCategories(organizationId);
    return { ok: true, data: rows };
  }

  @Post()
  @RequireModule("touchorbit", "assets")
  @ApiOperation({ summary: "Create asset category" })
  async create(
    @CurrentOrganization() organizationId: string,
    @Body() body: unknown,
  ) {
    const parsed = categorySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid asset category payload");
    }
    const row = await this.assetsService.createCategory(
      organizationId,
      parsed.data,
    );
    return { ok: true, data: row };
  }
}

@ApiTags("asset-assignments")
@Controller("asset-assignments")
@UseGuards(SessionAuthGuard)
export class AssetAssignmentsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @RequireModule("touchorbit", "assets")
  @ApiOperation({ summary: "List asset assignments" })
  async findAll(@CurrentOrganization() organizationId: string) {
    const rows = await this.assetsService.findAssignments(organizationId);
    return { ok: true, data: rows };
  }

  @Post()
  @RequireModule("touchorbit", "assets")
  @ApiOperation({ summary: "Create asset assignment" })
  async create(
    @CurrentOrganization() organizationId: string,
    @Body() body: unknown,
  ) {
    const parsed = assignmentSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid asset assignment payload");
    }
    const assetId = parsed.data.asset_id ?? parsed.data.assetId;
    const employeeId = parsed.data.employee_id ?? parsed.data.employeeId;
    if (!assetId || !employeeId) {
      throw new BadRequestException("asset_id and employee_id are required");
    }
    const row = await this.assetsService.createAssignment(organizationId, {
      assetId,
      employeeId,
      assignedAt: parsed.data.assigned_at ?? parsed.data.assignedAt ?? null,
      expectedReturnAt:
        parsed.data.expected_return_at ??
        parsed.data.expectedReturnAt ??
        null,
      conditionOnAssignment:
        parsed.data.condition_on_assignment ??
        parsed.data.conditionOnAssignment ??
        null,
      notes: parsed.data.notes ?? null,
    });
    return { ok: true, data: row };
  }
}
