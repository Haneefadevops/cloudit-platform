import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Res,
  UseGuards,
  Post,
  HttpCode,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { ProfilesService } from "./profiles.service";
import {
  profileInputSchema,
  publicContactCaptureSchema,
} from "./profiles.schemas";
import { AuthUser } from "../common/decorators/auth-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import type { AuthContext } from "../auth/types";

@Controller("v2/profiles")
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get("me")
  @UseGuards(SessionAuthGuard)
  async getMe(
    @AuthUser() user: AuthContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const profile = await this.profilesService.getMyProfile(user.id);
    if (!profile) {
      res.status(404);
      return { ok: false, error: "Profile not found." };
    }
    return { ok: true, data: profile };
  }

  @Put("me")
  @UseGuards(SessionAuthGuard)
  async updateMe(
    @AuthUser() user: AuthContext,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = profileInputSchema.safeParse(body);
    if (!input.success) {
      res.status(400);
      return { ok: false, error: "Invalid profile details." };
    }

    try {
      const profile = await this.profilesService.updateMyProfile(
        user.id,
        input.data,
      );
      return { ok: true, data: profile };
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        res.status(409);
        return { ok: false, error: "This profile slug is already taken." };
      }
      throw error;
    }
  }

  @Post(":slug/contact")
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(201)
  async capturePublicContact(
    @Param("slug") slug: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = publicContactCaptureSchema.safeParse(body);
    if (!input.success) {
      res.status(400);
      return { ok: false, error: "Please check your details and try again." };
    }
    // Honeypot submissions receive the same generic acknowledgement without storage.
    if (input.data.website) return { ok: true, data: { accepted: true } };
    const accepted = await this.profilesService.capturePublicContact(
      slug,
      input.data,
    );
    if (!accepted) {
      res.status(404);
      return { ok: false, error: "Profile not found." };
    }
    return { ok: true, data: { accepted: true } };
  }

  @Get(":slug")
  @Public()
  async getPublic(
    @Param("slug") slug: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const profile = await this.profilesService.getPublicProfile(slug);
    if (!profile) {
      res.status(404);
      return { ok: false, error: "Profile not found." };
    }
    return { ok: true, data: profile };
  }

  @Get(":slug/vcard")
  @Public()
  async getVCard(
    @Param("slug") slug: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const vcard = await this.profilesService.getVCard(slug);
    if (!vcard) {
      res.status(404);
      return { ok: false, error: "Profile not found." };
    }
    res
      .setHeader("Content-Type", "text/vcard; charset=utf-8")
      .setHeader("Content-Disposition", `attachment; filename="${slug}.vcf"`);
    return vcard;
  }
}
