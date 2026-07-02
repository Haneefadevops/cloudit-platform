import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { CreateIntegrationDto } from "./dto/create-integration.dto";
import { SyncIntegrationDto } from "./dto/sync-integration.dto";
import { UpdateIntegrationDto } from "./dto/update-integration.dto";
import { IntegrationsService } from "./integrations.service";

@ApiTags("integrations")
@Controller("integrations")
@RequireModule("hospitality", "reports")
@ApiBearerAuth()
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  @ApiOperation({ summary: "List channel manager and POS integrations" })
  @ApiQuery({ name: "provider", required: false })
  @ApiQuery({ name: "propertyId", required: false })
  async findAll(
    @CurrentOrganization() organizationId: string,
    @Query("provider") provider?: string,
    @Query("propertyId") propertyId?: string,
  ) {
    return this.integrationsService.findAll(organizationId, {
      provider,
      propertyId,
    });
  }

  @Get("summary")
  @ApiOperation({ summary: "Growth integration summary" })
  async summary(@CurrentOrganization() organizationId: string) {
    return this.integrationsService.summary(organizationId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get integration connection" })
  async findOne(
    @Param("id") id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.integrationsService.findOne(id, organizationId);
  }

  @Post()
  @ApiOperation({ summary: "Create integration connection" })
  async create(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreateIntegrationDto,
  ) {
    return this.integrationsService.create(organizationId, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update integration connection" })
  async update(
    @Param("id") id: string,
    @CurrentOrganization() organizationId: string,
    @Body() dto: UpdateIntegrationDto,
  ) {
    return this.integrationsService.update(id, organizationId, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete integration connection" })
  async remove(
    @Param("id") id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.integrationsService.remove(id, organizationId);
  }

  @Post(":id/sync")
  @ApiOperation({ summary: "Create integration sync log" })
  async sync(
    @Param("id") id: string,
    @CurrentOrganization() organizationId: string,
    @Body() dto: SyncIntegrationDto,
  ) {
    return this.integrationsService.sync(id, organizationId, dto);
  }

  @Get(":id/logs")
  @ApiOperation({ summary: "List integration sync logs" })
  async logs(
    @Param("id") id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.integrationsService.logs(id, organizationId);
  }
}
