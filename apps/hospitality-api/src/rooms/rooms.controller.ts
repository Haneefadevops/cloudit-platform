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
import { RoomsService } from "./rooms.service";
import { CreateRoomDto } from "./dto/create-room.dto";
import { UpdateRoomDto } from "./dto/update-room.dto";
import { AvailabilityQueryDto } from "./dto/availability-query.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";

@ApiTags("rooms")
@Controller("rooms")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @ApiOperation({ summary: "List rooms" })
  @ApiQuery({ name: "propertyId", required: false })
  @ApiQuery({ name: "roomTypeId", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  async findAll(
    @CurrentOrganization() organizationId: string,
    @Query("propertyId") propertyId?: string,
    @Query("roomTypeId") roomTypeId?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.roomsService.findAll(
      organizationId,
      Number(page) || 1,
      Number(limit) || 20,
      { propertyId, roomTypeId, status },
    );
  }

  @Get("availability")
  @ApiOperation({ summary: "Get available rooms for date range" })
  async availability(
    @CurrentOrganization() organizationId: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.roomsService.findAvailable(
      organizationId,
      query.propertyId,
      new Date(query.checkIn),
      new Date(query.checkOut),
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get room by ID" })
  async findOne(
    @Param("id") id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.roomsService.findOne(id, organizationId);
  }

  @Post()
  @ApiOperation({ summary: "Create room" })
  async create(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreateRoomDto,
  ) {
    return this.roomsService.create(organizationId, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update room" })
  async update(
    @Param("id") id: string,
    @CurrentOrganization() organizationId: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.roomsService.update(id, organizationId, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete room" })
  async remove(
    @Param("id") id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.roomsService.remove(id, organizationId);
  }
}
