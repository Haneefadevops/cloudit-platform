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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentOrganization } from '../common/decorators/current-organization.decorator';

@ApiTags('reservations')
@Controller('reservations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  @ApiOperation({ summary: 'List reservations' })
  @ApiQuery({ name: 'propertyId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'guestId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findAll(
    @CurrentOrganization() organizationId: string,
    @Query('propertyId') propertyId?: string,
    @Query('status') status?: string,
    @Query('guestId') guestId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reservationsService.findAll(
      organizationId,
      Number(page) || 1,
      Number(limit) || 20,
      { propertyId, status, guestId, startDate, endDate },
    );
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Get booking calendar for a month' })
  async getCalendar(
    @CurrentOrganization() organizationId: string,
    @Query() query: CalendarQueryDto,
  ) {
    return this.reservationsService.getCalendar(
      organizationId,
      query.propertyId,
      query.month,
      query.year,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get reservation by ID' })
  async findOne(
    @Param('id') id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.reservationsService.findOne(id, organizationId);
  }

  @Post()
  @ApiOperation({ summary: 'Create reservation' })
  async create(
    @CurrentOrganization() organizationId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateReservationDto,
  ) {
    return this.reservationsService.create(organizationId, userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update reservation' })
  async update(
    @Param('id') id: string,
    @CurrentOrganization() organizationId: string,
    @Body() dto: UpdateReservationDto,
  ) {
    return this.reservationsService.update(id, organizationId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete reservation' })
  async remove(
    @Param('id') id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.reservationsService.remove(id, organizationId);
  }

  @Post(':id/check-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check in a reservation' })
  async checkIn(
    @Param('id') id: string,
    @CurrentOrganization() organizationId: string,
    @Body() dto: CheckInDto,
  ) {
    return this.reservationsService.checkIn(id, organizationId, dto.notes);
  }

  @Post(':id/check-out')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check out a reservation' })
  async checkOut(
    @Param('id') id: string,
    @CurrentOrganization() organizationId: string,
    @Body() dto: CheckOutDto,
  ) {
    return this.reservationsService.checkOut(
      id,
      organizationId,
      dto.finalAmount,
    );
  }
}
