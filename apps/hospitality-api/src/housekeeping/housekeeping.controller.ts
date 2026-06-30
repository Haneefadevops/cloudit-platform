import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { CreateHousekeepingTaskDto } from "./dto/create-housekeeping-task.dto";
import { UpdateHousekeepingTaskDto } from "./dto/update-housekeeping-task.dto";
import { HousekeepingService } from "./housekeeping.service";

@ApiTags("housekeeping")
@Controller("housekeeping")
@RequireModule("hospitality", "rooms")
@ApiBearerAuth()
export class HousekeepingController {
  constructor(private readonly housekeepingService: HousekeepingService) {}

  @Get()
  @ApiOperation({ summary: "List housekeeping tasks" })
  @ApiQuery({ name: "propertyId", required: false })
  @ApiQuery({ name: "roomId", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  async findAll(
    @CurrentOrganization() organizationId: string,
    @Query("propertyId") propertyId?: string,
    @Query("roomId") roomId?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.housekeepingService.findAll(
      organizationId,
      Number(page) || 1,
      Number(limit) || 20,
      { propertyId, roomId, status },
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get housekeeping task" })
  async findOne(
    @Param("id") id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.housekeepingService.findOne(id, organizationId);
  }

  @Post()
  @ApiOperation({ summary: "Create housekeeping task" })
  async create(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreateHousekeepingTaskDto,
  ) {
    return this.housekeepingService.create(organizationId, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update housekeeping task" })
  async update(
    @Param("id") id: string,
    @CurrentOrganization() organizationId: string,
    @Body() dto: UpdateHousekeepingTaskDto,
  ) {
    return this.housekeepingService.update(id, organizationId, dto);
  }
}
