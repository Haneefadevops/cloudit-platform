import { NestFactory } from "@nestjs/core";
import { ValidationPipe, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SwaggerModule, DocumentBuilder, OpenAPIObject } from "@nestjs/swagger";
import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { JsonLogger } from "./common/logger/json.logger";
import { XssSanitizationPipe } from "./common/pipes/xss-sanitization.pipe";

function buildCorsOrigin(raw?: string): CorsOptions["origin"] {
  if (!raw || raw === "*") {
    return true;
  }
  const whitelist = raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return (
    requestOrigin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => {
    if (!requestOrigin || whitelist.includes(requestOrigin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS policy does not allow origin: ${requestOrigin}`));
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new JsonLogger(),
  });
  const configService = app.get(ConfigService);

  app.setGlobalPrefix("api");

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            "https:",
            "http:",
          ],
          styleSrc: ["'self'", "'unsafe-inline'", "https:", "http:"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", "https:", "data:"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.enableCors({
    origin: buildCorsOrigin(configService.get<string>("CORS_ORIGIN")),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          message: "Validation failed",
          errors: errors.map((e) => ({
            field: e.property,
            constraints: e.constraints,
          })),
        }),
    }),
    new XssSanitizationPipe(),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Hospitality API")
    .setDescription("CloudIT Hospitality OS API")
    .setVersion("1.0.0")
    .addBearerAuth()
    .build();
  const document: OpenAPIObject = SwaggerModule.createDocument(
    app,
    swaggerConfig,
  );
  SwaggerModule.setup("api/docs", app, document);

  const port = Number(configService.get("PORT")) || 3002;
  await app.listen(port);
  console.log(`Hospitality API is running on: http://localhost:${port}/api`);
}
void bootstrap();
