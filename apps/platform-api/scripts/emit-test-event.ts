import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { EventPublisherService } from '../src/events/event-publisher.service';
import { EventTypes } from '../src/events/event-types';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const publisher = app.get(EventPublisherService);

  await publisher.publish(EventTypes.USER_LOGIN, {
    userId: 'test-user-id',
    email: 'test@example.com',
    timestamp: new Date().toISOString(),
  });

  console.log('Event published and logged successfully');
  await app.close();
}

bootstrap().catch((error) => {
  console.error('Failed to publish test event:', error);
  process.exit(1);
});
