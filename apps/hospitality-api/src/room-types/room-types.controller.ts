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
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { RoomTypesService } from "./room-types.service";
import { CreateRoomTypeDto } from "./dto/create-room-type.dto";
import { UpdateRoomTypeDto } from "./dto/update-room-type.dto";
import { CreateSeasonalRateDto } from "./dto/create-seasonal-rate.dto";
import { UpdateSeasonalRateDto } from "./dto/update-seasonal-rate.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { RequireModule } from "../common/decorators/require-module.decorator";

@ApiTags("room-types")
@Controller("room-types")
@RequireModule("hospitality", "room-types")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RoomTypesController {
  constructor(private readonly roomTypesService: RoomTypesService) {}

  @Get()
  @ApiOperation({ summary: "List room types" })
  @ApiQuery({ name: "propertyId", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  async findAll(
    @CurrentOrganization() organizationId: string,
    @Query("propertyId") propertyId?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.roomTypesService.findAll(
      organizationId,
      Number(page) || 1,
      Number(limit) || 20,
      propertyId,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get room type by ID" })
  async findOne(
    @Param("id") id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.roomTypesService.findOne(id, organizationId);
  }

  @Get(":id/seasonal-rates")
  @ApiOperation({ summary: "List seasonal rates for room type" })
  async listSeasonalRates(
    @Param("id") id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.roomTypesService.listSeasonalRates(id, organizationId);
  }

  @Post()
  @ApiOperation({ summary: "Create room type" })
  async create(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreateRoomTypeDto,
  ) {
    return this.roomTypesService.create(organizationId, dto);
  }

  @Post(":id/seasonal-rates")
  @ApiOperation({ summary: "Create seasonal rate for room type" })
  async createSeasonalRate(
    @Param("id") id: string,
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreateSeasonalRateDto,
  ) {
    return this.roomTypesService.createSeasonalRate(id, organizationId, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update room type" })
  async update(
    @Param("id") id: string,
    @CurrentOrganization() organizationId: string,
    @Body() dto: UpdateRoomTypeDto,
  ) {
    return this.roomTypesService.update(id, organizationId, dto);
  }

  @Patch(":id/seasonal-rates/:rateId")
  @ApiOperation({ summary: "Update seasonal rate" })
  async updateSeasonalRate(
    @Param("id") id: string,
    @Param("rateId") rateId: string,
    @CurrentOrganization() organizationId: string,
    @Body() dto: UpdateSeasonalRateDto,
  ) {
    return this.roomTypesService.updateSeasonalRate(
      id,
      rateId,
      organizationId,
      dto,
    );
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete room type" })
  async remove(
    @Param("id") id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.roomTypesService.remove(id, organizationId);
  }

  @Delete(":id/seasonal-rates/:rateId")
  @ApiOperation({ summary: "Delete seasonal rate" })
  async removeSeasonalRate(
    @Param("id") id: string,
    @Param("rateId") rateId: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.roomTypesService.removeSeasonalRate(
      id,
      rateId,
      organizationId,
    );
  }
}
