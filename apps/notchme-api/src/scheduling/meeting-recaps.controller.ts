import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthUser } from "../common/decorators/auth-user.decorator";
import { RequireModule } from "../common/decorators/require-module.decorator";
import type { AuthContext } from "../auth/types";
import { MeetingRecapsService } from "./meeting-recaps.service";
import {
  recapDraftSchema,
  recapFinalizeSchema,
} from "./meeting-recaps.schemas";

@ApiTags("scheduling")
@Controller("v2/scheduling/bookings")
@RequireModule("notchme", "scheduling")
@ApiBearerAuth()
export class MeetingRecapsController {
  constructor(private readonly recaps: MeetingRecapsService) {}
  @Get(":bookingId/recap") async get(
    @AuthUser() user: AuthContext,
    @Param("bookingId") id: string,
  ) {
    return { ok: true, data: await this.recaps.get(user, id) };
  }
  @Put(":bookingId/recap") async save(
    @AuthUser() user: AuthContext,
    @Param("bookingId") id: string,
    @Body() body: unknown,
  ) {
    const input = recapDraftSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Invalid recap draft.");
    return { ok: true, data: await this.recaps.save(user, id, input.data) };
  }
  @Delete(":bookingId/recap") async remove(
    @AuthUser() user: AuthContext,
    @Param("bookingId") id: string,
  ) {
    await this.recaps.remove(user, id);
    return { ok: true, data: { deleted: true } };
  }

  @Post(":bookingId/recap/finalize") async finalize(
    @AuthUser() user: AuthContext,
    @Param("bookingId") id: string,
    @Body() body: unknown,
  ) {
    const input = recapFinalizeSchema.safeParse(body);
    if (!input.success) {
      throw new BadRequestException("Invalid recap finalization.");
    }
    return {
      ok: true,
      data: await this.recaps.finalize(user, id, input.data),
    };
  }
}
