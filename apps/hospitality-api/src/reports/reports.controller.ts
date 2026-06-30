import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ReportsService } from "./reports.service";
import { ReportQueryDto } from "./dto/report-query.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { RequireModule } from "../common/decorators/require-module.decorator";

@ApiTags("reports")
@Controller("reports")
@RequireModule("hospitality", "reports")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("occupancy")
  @ApiOperation({ summary: "Occupancy report" })
  async occupancy(
    @CurrentOrganization() organizationId: string,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportsService.occupancy(
      organizationId,
      query.propertyId,
      query.startDate,
      query.endDate,
    );
  }

  @Get("revenue")
  @ApiOperation({ summary: "Revenue report" })
  async revenue(
    @CurrentOrganization() organizationId: string,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportsService.revenue(
      organizationId,
      query.propertyId,
      query.startDate,
      query.endDate,
    );
  }

  @Get("guests")
  @ApiOperation({ summary: "Guest report" })
  async guests(
    @CurrentOrganization() organizationId: string,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportsService.guests(
      organizationId,
      query.propertyId,
      query.startDate,
      query.endDate,
    );
  }

  @Get("reservations")
  @ApiOperation({ summary: "Reservation report" })
  async reservations(
    @CurrentOrganization() organizationId: string,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportsService.reservations(
      organizationId,
      query.propertyId,
      query.startDate,
      query.endDate,
    );
  }
}
