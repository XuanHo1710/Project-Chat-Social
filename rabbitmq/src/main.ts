import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { readBoundedInteger } from './common/configuration';

async function bootstrap() {
  const logger = new Logger('RabbitWorker');
  const rabbitUrl = process.env.RABBITMQ_URL;
  const queue = process.env.RABBITMQ_QUEUE_NAME;
  if (!rabbitUrl) throw new Error('RABBITMQ_URL is required');
  if (!queue || !/^[a-zA-Z0-9._-]{1,180}$/.test(queue)) {
    throw new Error('RABBITMQ_QUEUE_NAME is required and contains invalid characters');
  }
  const prefetchCount = readBoundedInteger(
    process.env.RABBITMQ_PREFETCH_COUNT,
    1,
    1,
    100,
    'RABBITMQ_PREFETCH_COUNT'
  );

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.RMQ,
    options: {
      urls: [rabbitUrl],
      queue,
      queueOptions: { durable: true },
      prefetchCount,
      noAck: false,
      persistent: true,
      maxConnectionAttempts: -1,
      socketOptions: {
        heartbeatIntervalInSeconds: 10,
        reconnectTimeInSeconds: 5,
      },
    },
  });

  app.enableShutdownHooks();
  await app.listen();
  logger.log(`RabbitMQ worker started with prefetch ${prefetchCount}`);
}

void bootstrap().catch((error: unknown) => {
  const logger = new Logger('RabbitWorker');
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
