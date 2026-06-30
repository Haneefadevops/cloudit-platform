import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../common/decorators/public.decorator";
import { PublicAvailabilityDto } from "./dto/availability.dto";
import { CreatePublicBookingDto } from "./dto/create-public-booking.dto";
import { PublicService } from "./public.service";

@ApiTags("public")
@Public()
@Controller("public")
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Post("availability")
  @ApiOperation({ summary: "Get public property and room availability" })
  async availability(@Body() dto: PublicAvailabilityDto) {
    return this.publicService.availability(dto);
  }

  @Post("bookings")
  @ApiOperation({ summary: "Create public booking" })
  async createBooking(@Body() dto: CreatePublicBookingDto) {
    return this.publicService.createBooking(dto);
  }

  @Get("bookings/:token")
  @ApiOperation({ summary: "Get public booking by guest token" })
  async getBooking(@Param("token") token: string) {
    return this.publicService.getBooking(token);
  }
}
