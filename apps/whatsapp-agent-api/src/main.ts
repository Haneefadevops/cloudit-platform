import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import helmet from 'helmet';
import { AppModule } from './app.module';

function buildCorsOrigin(raw?: string): CorsOptions['origin'] {
  if (!raw || raw === '*') {
    return true;
  }
  const whitelist = raw
    .split(',')
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
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.setGlobalPrefix('api');

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.enableCors({
    origin: buildCorsOrigin(configService.get<string>('CORS_ORIGIN')),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      exceptionFactory: (errors) =>
        new BadRequestException({
          message: 'Validation failed',
          errors: errors.map((e) => ({
            field: e.property,
            constraints: e.constraints,
          })),
        }),
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('WhatsApp Agent API')
    .setDescription('CloudIT WhatsApp AI Agent API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document: OpenAPIObject = SwaggerModule.createDocument(
    app,
    swaggerConfig,
  );
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(configService.get('PORT')) || 3010;
  await app.listen(port);
  console.log(`WhatsApp Agent API running on: http://localhost:${port}/api`);
}
void bootstrap();
