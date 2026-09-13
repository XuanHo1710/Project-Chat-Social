import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Kafka, KafkaConfig } from 'kafkajs';
import { AppModule } from './app.module';
import { readBoolean, readBoundedInteger } from './common/configuration';

async function ensureTopics(
  clientConfig: KafkaConfig,
  partitions: number,
  replicationFactor: number,
): Promise<void> {
  const admin = new Kafka(clientConfig).admin();
  await admin.connect();
  try {
    await admin.createTopics({
      waitForLeaders: true,
      topics: [
        'post-events',
        'user-interactions',
        'health-check',
        'post-events.dlq',
        'user-interactions.dlq',
      ].map((topic) => ({
        topic,
        numPartitions: partitions,
        replicationFactor,
      })),
    });
  } finally {
    await admin.disconnect();
  }
}

async function bootstrap() {
  const logger = new Logger('KafkaServer');
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const brokers = (
    config.get<string>('KAFKA_BROKERS') ||
    config.get<string>('KAFKA_BROKER') ||
    'localhost:9092'
  )
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);
  if (brokers.length === 0)
    throw new Error('At least one Kafka broker is required');

  const saslUsername = config.get<string>('KAFKA_SASL_USERNAME');
  const saslPassword = config.get<string>('KAFKA_SASL_PASSWORD');
  if ((saslUsername && !saslPassword) || (!saslUsername && saslPassword)) {
    throw new Error(
      'KAFKA_SASL_USERNAME and KAFKA_SASL_PASSWORD must be configured together',
    );
  }
  const sslEnabled = readBoolean(config.get('KAFKA_SSL'), false, 'KAFKA_SSL');
  if (saslUsername && !sslEnabled) {
    throw new Error(
      'KAFKA_SSL=true is required when SASL credentials are configured',
    );
  }

  const concurrentPartitions = readBoundedInteger(
    config.get('KAFKA_PARTITIONS_CONCURRENT'),
    3,
    1,
    20,
    'KAFKA_PARTITIONS_CONCURRENT',
  );
  const kafkaClientConfig: KafkaConfig = {
    clientId: config.get<string>('KAFKA_CLIENT_ID') || 'social-feed-worker',
    brokers,
    ssl: sslEnabled,
    sasl:
      saslUsername && saslPassword
        ? {
            mechanism: 'plain',
            username: saslUsername,
            password: saslPassword,
          }
        : undefined,
    connectionTimeout: 10_000,
    requestTimeout: 30_000,
    retry: { retries: 8, initialRetryTime: 300, maxRetryTime: 30_000 },
  };

  if (config.get<string>('KAFKA_MANAGE_TOPICS') !== 'false') {
    const topicPartitions = readBoundedInteger(
      config.get('KAFKA_TOPIC_PARTITIONS'),
      3,
      1,
      100,
      'KAFKA_TOPIC_PARTITIONS',
    );
    const replicationFactor = readBoundedInteger(
      config.get('KAFKA_TOPIC_REPLICATION_FACTOR'),
      1,
      1,
      10,
      'KAFKA_TOPIC_REPLICATION_FACTOR',
    );
    await ensureTopics(kafkaClientConfig, topicPartitions, replicationFactor);
  }

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        ...kafkaClientConfig,
      },
      producer: {
        allowAutoTopicCreation: false,
        idempotent: true,
        maxInFlightRequests: 1,
      },
      consumer: {
        groupId:
          config.get<string>('KAFKA_CONSUMER_GROUP') ||
          'newsfeed-consumer-group',
        allowAutoTopicCreation: false,
        sessionTimeout: 30_000,
        heartbeatInterval: 3_000,
      },
      subscribe: { fromBeginning: false },
      run: {
        autoCommit: false,
        partitionsConsumedConcurrently: concurrentPartitions,
      },
    },
  });

  app.enableShutdownHooks();
  await app.startAllMicroservices();

  const port = readBoundedInteger(config.get('PORT'), 3002, 1, 65_535, 'PORT');
  await app.listen(port);
  logger.log(`Kafka worker and health server listening on port ${port}`);
  logger.log(`Connected to ${brokers.length} Kafka broker(s)`);
}

void bootstrap().catch((error: unknown) => {
  const logger = new Logger('KafkaServer');
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
