import {
  Controller,
  Get,
  Put,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { RequireCRMGuard } from "../common/guards/require-crm.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { AuthUser } from "../common/decorators/auth-user.decorator";
import type { AuthContext } from "../auth/types";
import {
  CustomersService,
  CustomerError,
  type CustomerListFilters,
} from "./customers.service";
import { BulkService } from "../crm/bulk/bulk.service";
import {
  customerInputSchema,
  customerLifecycleInputSchema,
  customerAssignInputSchema,
  customerCloseInputSchema,
  customerActivityInputSchema,
  customerFollowUpInputSchema,
  customerStageMoveInputSchema,
  bulkActionInputSchema,
  customerMergeInputSchema,
  customerImportInputSchema,
} from "./customers.schemas";

@ApiTags("customers")
@Controller("v2/customers")
@UseGuards(RequireCRMGuard)
@RequireModule("orbitone", "crm")
@ApiBearerAuth()
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly bulkService: BulkService,
  ) {}

  @Get("summary")
  @ApiOperation({ summary: "Get CRM summary" })
  async summary(@AuthUser() user: AuthContext) {
    const summary = await this.customersService.getCRMSummary(user);
    return { ok: true, data: summary };
  }

  @Get()
  @ApiOperation({ summary: "List customers" })
  async findAll(
    @AuthUser() user: AuthContext,
    @Query("search") search?: string,
    @Query("lifecycleStage")
    lifecycleStage?: CustomerListFilters["lifecycleStage"],
    @Query("priority") priority?: CustomerListFilters["priority"],
    @Query("assignedTo") assignedTo?: string,
    @Query("source") source?: CustomerListFilters["source"],
    @Query("outcome") outcome?: CustomerListFilters["outcome"],
    @Query("sortBy") sortBy?: CustomerListFilters["sortBy"],
    @Query("sortOrder") sortOrder?: "asc" | "desc",
  ) {
    const filters: CustomerListFilters = {
      search,
      lifecycleStage,
      priority,
      assignedTo,
      source,
      outcome,
      sortBy,
      sortOrder,
    };
    const customers = await this.customersService.listCustomers(user, filters);
    return { ok: true, data: customers };
  }

  @Post("bulk")
  @HttpCode(200)
  @ApiOperation({ summary: "Run bulk action on customers" })
  async bulkActions(@AuthUser() user: AuthContext, @Body() body: unknown) {
    const input = bulkActionInputSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException("Invalid bulk action details.");
    }
    const result = await this.bulkService.bulkAction(user, input.data);
    return { ok: true, data: result };
  }

  @Get("duplicates")
  @ApiOperation({ summary: "Find duplicate customer groups" })
  async duplicates(@AuthUser() user: AuthContext) {
    const groups = await this.bulkService.findDuplicateGroups(user);
    return { ok: true, data: groups };
  }

  @Post("merge")
  @HttpCode(200)
  @ApiOperation({ summary: "Merge two customers" })
  async merge(@AuthUser() user: AuthContext, @Body() body: unknown) {
    const input = customerMergeInputSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException("Invalid merge details.");
    }
    try {
      await this.bulkService.mergeCustomers(user, input.data);
      return { ok: true, data: { merged: true } };
    } catch (error) {
      if (error instanceof CustomerError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Post("import")
  @HttpCode(200)
  @ApiOperation({ summary: "Import customers" })
  async import(@AuthUser() user: AuthContext, @Body() body: unknown) {
    const input = customerImportInputSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException("Invalid import payload.");
    }
    const result = await this.bulkService.importCustomers(
      user,
      input.data.rows,
    );
    return { ok: true, data: result };
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: "Create customer" })
  async create(@AuthUser() user: AuthContext, @Body() body: unknown) {
    const input = customerInputSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException("Invalid customer details.");
    }
    try {
      const customer = await this.customersService.createCustomer(
        user,
        input.data,
      );
      return { ok: true, data: customer };
    } catch (error) {
      if (error instanceof CustomerError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Get(":id")
  @ApiOperation({ summary: "Get customer" })
  async findOne(@AuthUser() user: AuthContext, @Param("id") id: string) {
    const customer = await this.customersService.getCustomer(user, id);
    if (!customer) {
      throw new NotFoundException("Customer not found.");
    }
    return { ok: true, data: customer };
  }

  @Put(":id")
  @ApiOperation({ summary: "Update customer" })
  async update(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = customerInputSchema.partial().safeParse(body);
    if (!input.success) {
      throw new BadRequestException("Invalid customer details.");
    }
    try {
      const customer = await this.customersService.updateCustomer(
        user,
        id,
        input.data,
      );
      if (!customer) {
        throw new NotFoundException("Customer not found.");
      }
      return { ok: true, data: customer };
    } catch (error) {
      if (error instanceof CustomerError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete customer" })
  async remove(@AuthUser() user: AuthContext, @Param("id") id: string) {
    const deleted = await this.customersService.deleteCustomer(user, id);
    if (!deleted) {
      throw new NotFoundException("Customer not found.");
    }
    return { ok: true, data: { deleted: true } };
  }

  @Put(":id/lifecycle")
  @ApiOperation({ summary: "Update customer lifecycle stage" })
  async updateLifecycle(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = customerLifecycleInputSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException("Invalid lifecycle details.");
    }
    const customer = await this.customersService.updateLifecycle(
      user,
      id,
      input.data.lifecycleStage,
      input.data.note,
    );
    if (!customer) {
      throw new NotFoundException("Customer not found.");
    }
    return { ok: true, data: customer };
  }

  @Put(":id/assign")
  @ApiOperation({ summary: "Assign customer" })
  async assign(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = customerAssignInputSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException("Invalid assign details.");
    }
    try {
      const customer = await this.customersService.assignCustomer(
        user,
        id,
        input.data.assignedToUserId,
      );
      if (!customer) {
        throw new NotFoundException("Customer not found.");
      }
      return { ok: true, data: customer };
    } catch (error) {
      if (error instanceof CustomerError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Put(":id/close")
  @ApiOperation({ summary: "Close customer" })
  async close(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = customerCloseInputSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException("Invalid close details.");
    }
    const customer = await this.customersService.closeCustomer(
      user,
      id,
      input.data.outcome,
      input.data.closedReason,
    );
    if (!customer) {
      throw new NotFoundException("Customer not found.");
    }
    return { ok: true, data: customer };
  }

  @Get(":id/history")
  @ApiOperation({ summary: "List customer lifecycle history" })
  async listStageHistory(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
  ) {
    try {
      const history = await this.customersService.listStageHistory(user, id);
      return { ok: true, data: history };
    } catch (error) {
      if (error instanceof CustomerError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  @Get(":id/stage-history")
  @ApiOperation({ summary: "List customer pipeline stage history" })
  async listPipelineStageHistory(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
  ) {
    try {
      const history = await this.customersService.listPipelineStageHistory(
        user,
        id,
      );
      return { ok: true, data: history };
    } catch (error) {
      if (error instanceof CustomerError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  @Put(":id/stage")
  @ApiOperation({ summary: "Move customer pipeline stage" })
  async moveStage(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = customerStageMoveInputSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException("Invalid stage move details.");
    }
    try {
      const customer = await this.customersService.moveCustomerStage(
        user,
        id,
        input.data.pipelineStageId,
        input.data.note,
      );
      if (!customer) {
        throw new NotFoundException("Customer not found.");
      }
      return { ok: true, data: customer };
    } catch (error) {
      if (error instanceof CustomerError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Get(":id/activities")
  @ApiOperation({ summary: "List customer activities" })
  async listActivities(@AuthUser() user: AuthContext, @Param("id") id: string) {
    try {
      const activities = await this.customersService.listActivities(user, id);
      return { ok: true, data: activities };
    } catch (error) {
      if (error instanceof CustomerError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  @Post(":id/activities")
  @HttpCode(201)
  @ApiOperation({ summary: "Create customer activity" })
  async createActivity(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = customerActivityInputSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException("Invalid activity details.");
    }
    try {
      const activity = await this.customersService.createActivity(
        user,
        id,
        input.data,
      );
      return { ok: true, data: activity };
    } catch (error) {
      if (error instanceof CustomerError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  @Delete(":id/activities/:activityId")
  @ApiOperation({ summary: "Delete customer activity" })
  async deleteActivity(
    @AuthUser() user: AuthContext,
    @Param("activityId") activityId: string,
  ) {
    const deleted = await this.customersService.deleteActivity(
      user,
      activityId,
    );
    if (!deleted) {
      throw new NotFoundException("Activity not found.");
    }
    return { ok: true, data: { deleted: true } };
  }

  @Get(":id/follow-ups")
  @ApiOperation({ summary: "List customer follow-ups" })
  async listFollowUps(@AuthUser() user: AuthContext, @Param("id") id: string) {
    try {
      const followUps = await this.customersService.listFollowUps(user, id);
      return { ok: true, data: followUps };
    } catch (error) {
      if (error instanceof CustomerError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  @Post(":id/follow-ups")
  @HttpCode(201)
  @ApiOperation({ summary: "Create customer follow-up" })
  async createFollowUp(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = customerFollowUpInputSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException("Invalid follow-up details.");
    }
    try {
      const followUp = await this.customersService.createFollowUp(
        user,
        id,
        input.data,
      );
      return { ok: true, data: followUp };
    } catch (error) {
      if (error instanceof CustomerError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  @Patch(":id/follow-ups/:followUpId")
  @ApiOperation({ summary: "Complete or reopen customer follow-up" })
  async completeFollowUp(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Param("followUpId") followUpId: string,
    @Body() body: { completed?: boolean },
  ) {
    if (typeof body?.completed !== "boolean") {
      throw new BadRequestException("Invalid completion state.");
    }
    try {
      const followUp = await this.customersService.completeFollowUp(
        user,
        followUpId,
        id,
        body.completed,
      );
      if (!followUp) {
        throw new NotFoundException("Follow-up not found.");
      }
      return { ok: true, data: followUp };
    } catch (error) {
      if (error instanceof CustomerError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  @Delete(":id/follow-ups/:followUpId")
  @ApiOperation({ summary: "Delete customer follow-up" })
  async deleteFollowUp(
    @AuthUser() user: AuthContext,
    @Param("followUpId") followUpId: string,
  ) {
    const deleted = await this.customersService.deleteFollowUp(
      user,
      followUpId,
    );
    if (!deleted) {
      throw new NotFoundException("Follow-up not found.");
    }
    return { ok: true, data: { deleted: true } };
  }
}
