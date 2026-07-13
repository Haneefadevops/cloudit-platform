import { NestFactory } from "@nestjs/core";
import { ValidationPipe, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SwaggerModule, DocumentBuilder, OpenAPIObject } from "@nestjs/swagger";
import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { JsonLogger } from "./common/logger/json.logger";
import { XssSanitizationPipe } from "./common/pipes/xss-sanitization.pipe";

const DEFAULT_CORS_ORIGINS = [
  "https://touchorbit.cloudit.lk",
  "https://to-admin.cloudit.lk",
  "https://to-employee.cloudit.lk",
  "https://to-kiosk.cloudit.lk",
  "https://api-touchorbit.cloudit.lk",
  "http://localhost:3007",
  "http://localhost:3008",
  "http://localhost:3009",
  "http://localhost:3010",
];

function buildCorsOrigin(raw?: string): CorsOptions["origin"] {
  let whitelist: string[];
  const rawValue = raw?.trim();

  if (!rawValue || rawValue === "*" || rawValue.includes("${")) {
    if (rawValue === "*") {
      console.warn(
        "CORS_ORIGIN is '*'. When credentials are enabled this is not allowed. Falling back to default whitelist.",
      );
    } else if (rawValue?.includes("${")) {
      console.warn(
        `CORS_ORIGIN contains unexpanded variable: ${rawValue}. Falling back to default whitelist.`,
      );
    }
    whitelist = DEFAULT_CORS_ORIGINS;
  } else {
    whitelist = rawValue
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
  }

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

function shouldEnableSwagger(configService: ConfigService): boolean {
  const explicit = configService.get<string>("ENABLE_SWAGGER")?.toLowerCase();
  if (explicit) {
    return explicit === "true";
  }
  return configService.get<string>("NODE_ENV") !== "production";
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

  if (shouldEnableSwagger(configService)) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("TouchOrbit HR API")
      .setDescription("CloudIT TouchOrbit HR API")
      .setVersion("1.0.0")
      .addBearerAuth()
      .build();
    const document: OpenAPIObject = SwaggerModule.createDocument(
      app,
      swaggerConfig,
    );
    SwaggerModule.setup("api/docs", app, document);
  }

  const port = Number(configService.get("PORT")) || 3006;
  await app.listen(port);
  console.log(`TouchOrbit HR API is running on: http://localhost:${port}/api`);
}
void bootstrap();
