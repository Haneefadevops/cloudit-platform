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
import { ScopedClientId } from '../common/decorators/scoped-client-id.decorator';

// Controller-level: any authenticated user. Staff-only endpoints carry
// AdminGuard at method level; portal-accessible endpoints use ScopedClientId
// so portal users can only ever touch their own client's data.
@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  // ---- Services (read: portal-allowed; manage: staff-only) ----

  @Get(':clientId/services')
  findServices(@ScopedClientId() clientId: string) {
    return this.bookingsService.findServices(clientId);
  }

  @Post(':clientId/services')
  @UseGuards(AdminGuard)
  createService(
    @Param('clientId') clientId: string,
    @Body() body: ServiceInput,
  ) {
    return this.bookingsService.createService(clientId, body);
  }

  @Put(':clientId/services/:id')
  @UseGuards(AdminGuard)
  updateService(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @Body() body: ServiceInput,
  ) {
    return this.bookingsService.updateService(clientId, id, body);
  }

  @Delete(':clientId/services/:id')
  @UseGuards(AdminGuard)
  removeService(@Param('clientId') clientId: string, @Param('id') id: string) {
    return this.bookingsService.removeService(clientId, id);
  }

  // ---- Staff (staff-only) ----

  @Get(':clientId/staff')
  @UseGuards(AdminGuard)
  findStaff(@Param('clientId') clientId: string) {
    return this.bookingsService.findStaff(clientId);
  }

  @Post(':clientId/staff')
  @UseGuards(AdminGuard)
  createStaff(@Param('clientId') clientId: string, @Body() body: StaffInput) {
    return this.bookingsService.createStaff(clientId, body);
  }

  @Put(':clientId/staff/:id')
  @UseGuards(AdminGuard)
  updateStaff(
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @Body() body: StaffInput,
  ) {
    return this.bookingsService.updateStaff(clientId, id, body);
  }

  @Delete(':clientId/staff/:id')
  @UseGuards(AdminGuard)
  removeStaff(@Param('clientId') clientId: string, @Param('id') id: string) {
    return this.bookingsService.removeStaff(clientId, id);
  }

  // ---- Availability (staff-only setup tool) ----

  @Get(':clientId/availability')
  @UseGuards(AdminGuard)
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

  // ---- Bookings (portal-allowed: list + status) ----

  @Get(':clientId/bookings')
  findBookings(
    @ScopedClientId() clientId: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.bookingsService.findBookings(clientId, { status, from, to });
  }

  @Put(':clientId/bookings/:id')
  updateBookingStatus(
    @ScopedClientId() clientId: string,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.bookingsService.updateBookingStatus(clientId, id, body.status);
  }
}
