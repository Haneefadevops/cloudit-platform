import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { z } from "zod";
import { StorageService } from "./storage.service";

const uploadSchema = z.object({
  bucket: z.string().min(1),
  key: z.string().min(1),
  contentType: z.string().min(1),
});

@ApiTags("storage")
@Controller("storage")
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post("upload")
  @ApiOperation({ summary: "Get a presigned URL for uploading an object" })
  async upload(@Body() body: unknown) {
    const parsed = uploadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid upload request");
    }
    const result = await this.storageService.presignedUpload(
      parsed.data.bucket,
      parsed.data.key,
      parsed.data.contentType,
    );
    return { ok: true, data: result };
  }

  @Get("download")
  @ApiOperation({ summary: "Get a presigned URL for downloading an object" })
  async download(@Query("bucket") bucket: string, @Query("key") key: string) {
    if (!bucket || !key) {
      throw new BadRequestException("bucket and key are required");
    }
    const result = await this.storageService.presignedDownload(bucket, key);
    return { ok: true, data: result };
  }
}
