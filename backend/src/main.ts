import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from 'core/exception.filter';
import { TransformInterceptor } from 'core/transform.interceptor';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
        queue: 'backend_queue', // Queue for receiving events from RabbitMQ consumer
        queueOptions: {
          durable: true,
        },
        noAck: false, // Enable manual acknowledgment
      },
    });

    // Start microservice listeners
    await app.startAllMicroservices();
    console.log('✅ RabbitMQ microservice listener started on backend_queue');
  }

  // Config CORS
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe());

  // app.useGlobalGuards(new JwtAuthGuard(reflector));

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor(reflector));

  //Cookies
  app.use(cookieParser());

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: ['1', '2'],
  });

  await app.listen(configService.get('PORT') as string);
}
bootstrap();
