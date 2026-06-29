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
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";

@ApiTags("room-types")
@Controller("room-types")
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

  @Post()
  @ApiOperation({ summary: "Create room type" })
  async create(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreateRoomTypeDto,
  ) {
    return this.roomTypesService.create(organizationId, dto);
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

  @Delete(":id")
  @ApiOperation({ summary: "Delete room type" })
  async remove(
    @Param("id") id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.roomTypesService.remove(id, organizationId);
  }
}
