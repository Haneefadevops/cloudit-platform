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
import { GuestsService } from "./guests.service";
import { CreateGuestDto } from "./dto/create-guest.dto";
import { UpdateGuestDto } from "./dto/update-guest.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";

@ApiTags("guests")
@Controller("guests")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GuestsController {
  constructor(private readonly guestsService: GuestsService) {}

  @Get()
  @ApiOperation({ summary: "List guests" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "search", required: false })
  async findAll(
    @CurrentOrganization() organizationId: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
  ) {
    return this.guestsService.findAll(
      organizationId,
      Number(page) || 1,
      Number(limit) || 20,
      search,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get guest by ID" })
  async findOne(
    @Param("id") id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.guestsService.findOne(id, organizationId);
  }

  @Post()
  @ApiOperation({ summary: "Create guest" })
  async create(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreateGuestDto,
  ) {
    return this.guestsService.create(organizationId, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update guest" })
  async update(
    @Param("id") id: string,
    @CurrentOrganization() organizationId: string,
    @Body() dto: UpdateGuestDto,
  ) {
    return this.guestsService.update(id, organizationId, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete guest" })
  async remove(
    @Param("id") id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.guestsService.remove(id, organizationId);
  }
}
