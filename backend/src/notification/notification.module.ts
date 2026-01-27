import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationEmitterService } from './notification-emitter.service';
import { NotificationGateway } from './notification.gateway';
import { Notification, NotificationSchema } from './entities/notification.entity';
import { GroupModule } from 'src/group/group.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Notification.name, schema: NotificationSchema }]),
    forwardRef(() => GroupModule),
    // RabbitMQ client for emitting notification events
    ClientsModule.registerAsync([
      {
        name: 'RABBITMQ_SERVICE',
        imports: [ConfigModule],
        useFactory: async (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')!],
            queue: configService.get<string>('RABBITMQ_QUEUE_NAME')!,
            queueOptions: {
              durable: true,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationEmitterService, NotificationGateway],
  exports: [NotificationService, NotificationEmitterService, NotificationGateway],
})
export class NotificationModule { }

