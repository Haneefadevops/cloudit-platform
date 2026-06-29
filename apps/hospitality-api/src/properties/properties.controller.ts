import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { PropertiesService } from "./properties.service";
import { CreatePropertyDto } from "./dto/create-property.dto";
import { UpdatePropertyDto } from "./dto/update-property.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";

@ApiTags("properties")
@Controller("properties")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  @ApiOperation({ summary: "List properties" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "search", required: false })
  async findAll(
    @CurrentOrganization() organizationId: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
  ) {
    return this.propertiesService.findAll(
      organizationId,
      Number(page) || 1,
      Number(limit) || 20,
      search,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get property by ID" })
  async findOne(
    @Param("id") id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.propertiesService.findOne(id, organizationId);
  }

  @Post()
  @ApiOperation({ summary: "Create property" })
  async create(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreatePropertyDto,
  ) {
    return this.propertiesService.create(organizationId, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update property" })
  async update(
    @Param("id") id: string,
    @CurrentOrganization() organizationId: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.propertiesService.update(id, organizationId, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete property" })
  async remove(
    @Param("id") id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.propertiesService.remove(id, organizationId);
  }
}
