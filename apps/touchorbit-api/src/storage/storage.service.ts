import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const ALLOWED_BUCKETS = [
  "employee-photos",
  "attendance-selfies",
  "medical-certificates",
  "receipts",
];

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucketPrefix: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>("S3_ENDPOINT");
    const region = this.configService.get<string>("S3_REGION") || "us-east-1";
    const forcePathStyle =
      this.configService.get<string>("S3_FORCE_PATH_STYLE") !== "false";

    this.client = new S3Client({
      endpoint,
      region,
      forcePathStyle,
      credentials: {
        accessKeyId: this.configService.get<string>("S3_ACCESS_KEY") || "",
        secretAccessKey: this.configService.get<string>("S3_SECRET_KEY") || "",
      },
    });

    this.bucketPrefix =
      this.configService.get<string>("S3_BUCKET_PREFIX") || "touchorbit";
  }

  private bucketName(bucket: string): string {
    if (!ALLOWED_BUCKETS.includes(bucket)) {
      throw new BadRequestException(
        `Storage bucket "${bucket}" is not allowed`,
      );
    }
    return `${this.bucketPrefix}-${bucket}`;
  }

  async presignedUpload(
    bucket: string,
    key: string,
    contentType: string,
    expiresInSeconds = 300,
  ): Promise<{ url: string; publicUrl: string }> {
    const bucketName = this.bucketName(bucket);
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    });

    const publicUrl = this.buildPublicUrl(bucketName, key);
    return { url, publicUrl };
  }

  async presignedDownload(
    bucket: string,
    key: string,
    expiresInSeconds = 300,
  ): Promise<{ url: string }> {
    const bucketName = this.bucketName(bucket);
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    });

    return { url };
  }

  private buildPublicUrl(bucketName: string, key: string): string {
    const endpoint = this.configService.get<string>("S3_ENDPOINT") || "";
    return `${endpoint.replace(/\/$/, "")}/${bucketName}/${key}`;
  }
}
