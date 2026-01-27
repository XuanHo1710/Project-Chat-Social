import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { Partitioners } from 'kafkajs';

async function bootstrap() {
  const logger = new Logger('KafkaServer');

  // Create Hybrid Application (HTTP + Microservice)
  const app = await NestFactory.create(AppModule);

  // Connect Kafka Microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'kafka-consumer',
        brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
        // Explicitly set legacy partitioner to fix warnings in v2.0.0
        // createPartitioner: Partitioners.LegacyPartitioner, // Cannot pass directly here in NestJS object
      },
      // Producer config for replies/events
      producer: {
        createPartitioner: Partitioners.LegacyPartitioner,
      },
      consumer: {
        groupId: 'newsfeed-consumer-group',
        allowAutoTopicCreation: true,
      },
    },
  });

  await app.startAllMicroservices();

  const port = process.env.PORT || 3002;
  await app.listen(port);

  logger.log(`✅ Kafka Consumer Service & HTTP Server running on port ${port}`);
  logger.log(`📡 Connected to broker: ${process.env.KAFKA_BROKER || 'localhost:9092'}`);
}
bootstrap();
