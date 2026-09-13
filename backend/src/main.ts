import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType, ConsoleLogger, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from 'core/exception.filter';
import { TransformInterceptor } from 'core/transform.interceptor';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { validateCorsOrigin } from './common/config/cors.config';
import helmet from 'helmet';


async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
      logger: new ConsoleLogger({
        json: true,
        colors: true,
        logLevels: [
          'log',
          'fatal',
          'error',
          'warn',
          'debug',
          'verbose',
        ],
      })
  });

  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);

  // Connect RabbitMQ microservice to receive events from RabbitMQ consumer
  // This enables bidirectional communication: Backend -> RabbitMQ Consumer -> Backend
  const rabbitmqUrl = configService.get<string>('RABBITMQ_URL');
  if (rabbitmqUrl) {
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [rabbitmqUrl],
        queue: configService.get<string>('RABBITMQ_BACKEND_QUEUE') || 'backend_queue',
        queueOptions: {
          durable: true,
        },
        noAck: false, // Enable manual acknowledgment
        prefetchCount: 1,
      },
    });

    // Start microservice listeners
    await app.startAllMicroservices();
    Logger.log('✅ RabbitMQ microservice listener started on backend_queue', 'Bootstrap');
  }

  // Config CORS
  app.enableCors({
    origin: validateCorsOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    credentials: true,
  });

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transformOptions: { enableImplicitConversion: false },
    })
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor(reflector));

  app.use(cookieParser());

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: ['1', '2'],
  });

  await app.listen(Number(configService.get<string>('PORT') || 8080));
}
void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  Logger.error(message, 'Bootstrap');
  process.exitCode = 1;
});
