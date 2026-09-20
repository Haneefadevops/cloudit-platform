import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  await app.init();
  // Headless watchdog: no HTTP listener exists to keep the event loop alive,
  // and no scheduled job is bound yet in this phase, so without a live handle
  // the process would exit cleanly right after init. Hold it open; scheduled
  // scans replace this handle once they are bound under their own gates.
  setInterval(() => undefined, 2 ** 30);
}

void bootstrap();
