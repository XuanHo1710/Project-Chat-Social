import { BadRequestException, Controller, Logger, NotFoundException } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { Types } from 'mongoose';
import {
  BackendRmqChannel,
  BackendRmqMessage,
  settleBackendRmqFailure,
} from '../common/messaging/rabbitmq-delivery';
import { NotificationGateway } from './notification.gateway';
import { NotificationService } from './notification.service';

class InvalidNotificationBrokerPayloadError extends Error {}

@Controller()
export class RabbitMQEventsController {
  private readonly logger = new Logger(RabbitMQEventsController.name);

  constructor(
    private readonly notificationGateway: NotificationGateway,
    private readonly notificationService: NotificationService,
  ) {}

  @EventPattern('notification.send')
  async handleNotificationSend(@Payload() rawPayload: unknown, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef() as BackendRmqChannel;
    const originalMessage = context.getMessage() as BackendRmqMessage;

    try {
      const { recipientId, notificationId } = this.validatePayload(rawPayload);
      const canonical = await this.notificationService.getBrokerNotification(
        notificationId,
        recipientId,
      );
      this.notificationGateway.sendNotification(recipientId, canonical.notification);
      this.notificationGateway.sendUnreadCountUpdate(recipientId, canonical.unreadCount);
      channel.ack(originalMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown broker handler error';
      this.logger.warn(`Rejected notification.send: ${message}`);
      await settleBackendRmqFailure({
        channel,
        message: originalMessage,
        pattern: 'notification.send',
        error,
        permanent:
          error instanceof InvalidNotificationBrokerPayloadError ||
          error instanceof BadRequestException ||
          error instanceof NotFoundException,
        logger: this.logger,
      });
    }
  }

  private validatePayload(value: unknown): { recipientId: string; notificationId: string } {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new InvalidNotificationBrokerPayloadError('Payload must be an object');
    }
    const payload = value as Record<string, unknown>;
    const recipientId = this.objectId(payload.recipientId, 'recipientId');
    const notification = payload.notification;
    if (!notification || typeof notification !== 'object' || Array.isArray(notification)) {
      throw new InvalidNotificationBrokerPayloadError('notification must be an object');
    }
    const notificationId = this.objectId(
      (notification as Record<string, unknown>)._id,
      'notification._id',
    );
    return { recipientId, notificationId };
  }

  private objectId(value: unknown, field: string): string {
    const normalized = typeof value === 'string' ? value : String(value || '');
    if (!/^[a-f\d]{24}$/i.test(normalized) || !Types.ObjectId.isValid(normalized)) {
      throw new InvalidNotificationBrokerPayloadError(`${field} is invalid`);
    }
    return normalized;
  }
}
