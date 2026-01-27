import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('NestMicroservice');

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL!],
        queue: process.env.RABBITMQ_QUEUE_NAME!,
        queueOptions: {
          durable: true,
        },
        prefetchCount: 1, // Process one message at a time to avoid delivery tag issues
        noAck: false, // Enable manual acknowledgment
      },
    },
  );

  await app.listen();
  logger.log('Nest microservice successfully started');
}
bootstrap();
