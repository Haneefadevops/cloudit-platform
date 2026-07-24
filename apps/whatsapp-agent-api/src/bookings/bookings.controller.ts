import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import type { ServiceInput, StaffInput } from './bookings.service';
import { AvailabilityService } from './availability.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('bookings')
@UseGuards(JwtAuthGuard, AdminGuard)
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  @Get(':clientId/services')
  findServices(@Param('clientId') clientId: string) {
    return this.bookingsService.findServices(clientId);
  }

  @Post(':clientId/services')
  createService(
    @Param('clientId') clientId: string,
    @Body() body: ServiceInput,
  ) {
    return this.bookingsService.createService(clientId, body);
  }

  @Put(':clientId/services/:id')
  updateService(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @Body() body: ServiceInput,
  ) {
    return this.bookingsService.updateService(clientId, id, body);
  }

  @Delete(':clientId/services/:id')
  removeService(@Param('clientId') clientId: string, @Param('id') id: string) {
    return this.bookingsService.removeService(clientId, id);
  }

  @Get(':clientId/staff')
  findStaff(@Param('clientId') clientId: string) {
    return this.bookingsService.findStaff(clientId);
  }

  @Post(':clientId/staff')
  createStaff(@Param('clientId') clientId: string, @Body() body: StaffInput) {
    return this.bookingsService.createStaff(clientId, body);
  }

  @Put(':clientId/staff/:id')
  updateStaff(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @Body() body: StaffInput,
  ) {
    return this.bookingsService.updateStaff(clientId, id, body);
  }

  @Delete(':clientId/staff/:id')
  removeStaff(@Param('clientId') clientId: string, @Param('id') id: string) {
    return this.bookingsService.removeStaff(clientId, id);
  }

  @Get(':clientId/availability')
  getAvailability(
    @Param('clientId') clientId: string,
    @Query('serviceId') serviceId: string,
    @Query('date') date: string,
    @Query('staffId') staffId?: string,
  ) {
    return this.availabilityService.getAvailableSlots(
      clientId,
      serviceId,
      date,
      staffId,
    );
  }

  @Get(':clientId/bookings')
  findBookings(
    @Param('clientId') clientId: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.bookingsService.findBookings(clientId, { status, from, to });
  }

  @Put(':clientId/bookings/:id')
  updateBookingStatus(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.bookingsService.updateBookingStatus(clientId, id, body.status);
  }
}
