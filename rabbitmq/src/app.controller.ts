import { Controller, Logger } from '@nestjs/common';
import { AppService } from './app.service';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { MessageCreatedEventDto } from './dto/message.dto';
import { NotificationEventDto } from './dto/notification.dto';
import { NotificationAggregationService } from './services/notification-aggregation.service';

@Controller()
export class AppController {
  private logger = new Logger('AppController');

  constructor(
    private readonly appService: AppService,
    private readonly notificationAggregationService: NotificationAggregationService,
  ) { }

  /**
   * Listen for chat.message.created events from Backend
   * Process AI chatbot and FCM notifications
   */
  @EventPattern('chat.message.created')
  async handleMessageCreated(
    @Payload() payload: MessageCreatedEventDto,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    this.logger.log(`Received message event: ${payload.messageId}`);

    try {
      await this.appService.handleMessageCreated(payload);

      // Acknowledge message after successful processing
      this.safeAck(channel, originalMsg);
    } catch (error) {
      this.logger.error('Error processing message:', error);

      // Negative acknowledge - will be retried or sent to DLQ
      this.safeNack(channel, originalMsg);
    }
  }

  /**
   * Listen for notification.created events from Backend
   * Process through Aggregation Worker -> Sender Worker -> Socket
   */
  @EventPattern('notification.created')
  async handleNotificationCreated(
    @Payload() payload: NotificationEventDto,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    this.logger.log(`Received notification event: ${payload.type} for ${payload.recipientId}`);

    try {
      await this.notificationAggregationService.processNotificationEvent(payload);

      // Acknowledge message after successful processing
      this.safeAck(channel, originalMsg);
    } catch (error) {
      this.logger.error('Error processing notification:', error);

      // Negative acknowledge - will be retried or sent to DLQ
      this.safeNack(channel, originalMsg);
    }
  }

  /**
   * Safely acknowledge a message, handling cases where the channel may be closed
   */
  private safeAck(channel: any, message: any): void {
    try {
      if (channel && message) {
        channel.ack(message);
      }
    } catch (error) {
      this.logger.warn('Failed to ack message (channel may be closed):', error.message);
    }
  }

  /**
   * Safely negative acknowledge a message, handling cases where the channel may be closed
   */
  private safeNack(channel: any, message: any): void {
    try {
      if (channel && message) {
        channel.nack(message, false, false);
      }
    } catch (error) {
      this.logger.warn('Failed to nack message (channel may be closed):', error.message);
    }
  }
}

