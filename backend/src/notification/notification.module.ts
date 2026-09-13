import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationEmitterService } from './notification-emitter.service';
import { NotificationGateway } from './notification.gateway';
import { Notification, NotificationSchema } from './entities/notification.entity';
import { GroupModule } from 'src/group/group.module';
import { AuthModule } from 'src/auth/auth.module';
import { RabbitMqClientModule } from 'src/common/messaging/rabbitmq-client.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Notification.name, schema: NotificationSchema }]),
    forwardRef(() => GroupModule),
    AuthModule,
    RabbitMqClientModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationEmitterService, NotificationGateway],
  exports: [NotificationService, NotificationEmitterService, NotificationGateway],
})
export class NotificationModule { }

