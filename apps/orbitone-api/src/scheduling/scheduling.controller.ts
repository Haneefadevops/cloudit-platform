import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { AuthUser } from "../common/decorators/auth-user.decorator";
import type { AuthContext } from "../auth/types";
import { SchedulingService } from "./scheduling.service";
import {
  meetingTypeInputSchema,
  availabilityInputSchema,
} from "./scheduling.schemas";

@ApiTags("scheduling")
@Controller("v2/scheduling")
@RequireModule("orbitone", "scheduling")
@ApiBearerAuth()
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Get("meeting-types")
  @ApiOperation({ summary: "List meeting types" })
  async getMeetingTypes(@AuthUser() user: AuthContext) {
    const meetingTypes = await this.schedulingService.getMeetingTypes(user.id);
    return { ok: true, data: meetingTypes };
  }

  @Post("meeting-types")
  @HttpCode(201)
  @ApiOperation({ summary: "Create meeting type" })
  async createMeetingType(
    @AuthUser() user: AuthContext,
    @Body() body: unknown,
  ) {
    const input = meetingTypeInputSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException("Invalid meeting type details.");
    }

    try {
      const meetingType = await this.schedulingService.createMeetingType(
        user.id,
        input.data,
      );
      return { ok: true, data: meetingType };
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new ConflictException(
          "A meeting type with this slug already exists.",
        );
      }
      throw error;
    }
  }

  @Put("meeting-types/:id")
  @ApiOperation({ summary: "Update meeting type" })
  async updateMeetingType(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = meetingTypeInputSchema.partial().safeParse(body);
    if (!input.success) {
      throw new BadRequestException("Invalid meeting type details.");
    }

    try {
      const meetingType = await this.schedulingService.updateMeetingType(
        user.id,
        id,
        input.data,
      );
      if (!meetingType) {
        throw new NotFoundException("Meeting type not found.");
      }
      return { ok: true, data: meetingType };
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new ConflictException(
          "A meeting type with this slug already exists.",
        );
      }
      throw error;
    }
  }

  @Delete("meeting-types/:id")
  @ApiOperation({ summary: "Delete meeting type" })
  async deleteMeetingType(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
  ) {
    const deleted = await this.schedulingService.deleteMeetingType(user.id, id);
    if (!deleted) {
      throw new NotFoundException("Meeting type not found.");
    }
    return { ok: true, data: { deleted: true } };
  }

  @Get("availability")
  @ApiOperation({ summary: "Get availability" })
  async getAvailability(@AuthUser() user: AuthContext) {
    const availability = await this.schedulingService.getAvailability(user.id);
    return { ok: true, data: availability };
  }

  @Put("availability")
  @ApiOperation({ summary: "Update availability" })
  async updateAvailability(
    @AuthUser() user: AuthContext,
    @Body() body: unknown,
  ) {
    const input = availabilityInputSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException("Invalid availability details.");
    }

    const availability = await this.schedulingService.updateAvailability(
      user.id,
      input.data.rules,
      input.data.exceptions,
    );
    return { ok: true, data: availability };
  }

  @Get("bookings")
  @ApiOperation({ summary: "List bookings" })
  async getBookings(@AuthUser() user: AuthContext) {
    const bookings = await this.schedulingService.getBookings(user.id);
    return { ok: true, data: bookings };
  }

  @Get("bookings/:id")
  @ApiOperation({ summary: "Get booking" })
  async getBooking(@AuthUser() user: AuthContext, @Param("id") id: string) {
    const booking = await this.schedulingService.getBooking(user.id, id);
    if (!booking) {
      throw new NotFoundException("Booking not found.");
    }
    return { ok: true, data: booking };
  }

  @Post("bookings/:id/cancel")
  @ApiOperation({ summary: "Cancel booking" })
  async cancelBooking(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Body() body: { reason?: string },
  ) {
    const booking = await this.schedulingService.cancelBooking(
      user.id,
      id,
      body?.reason,
    );
    if (!booking) {
      throw new NotFoundException("Booking not found.");
    }
    return { ok: true, data: booking };
  }

  @Post("bookings/:id/approve")
  @ApiOperation({ summary: "Approve booking" })
  async approveBooking(@AuthUser() user: AuthContext, @Param("id") id: string) {
    const booking = await this.schedulingService.approveBooking(user.id, id);
    if (!booking) {
      throw new NotFoundException("Booking not found or already approved.");
    }
    return { ok: true, data: booking };
  }

  @Post("bookings/:id/decline")
  @ApiOperation({ summary: "Decline booking" })
  async declineBooking(
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Body() body: { reason?: string },
  ) {
    const booking = await this.schedulingService.declineBooking(
      user.id,
      id,
      body?.reason,
    );
    if (!booking) {
      throw new NotFoundException("Booking not found or already approved.");
    }
    return { ok: true, data: booking };
  }
}
