import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { NotificationGateway } from 'src/notification/notification.gateway';

/**
 * Controller để nhận events từ RabbitMQ microservice
 * Đây là các events được gửi ngược về từ RabbitMQ consumer (notification sender)
 */
@Controller()
export class RabbitMQEventsController {
    private readonly logger = new Logger('RabbitMQEvents');

    constructor(
        private readonly notificationGateway: NotificationGateway,
    ) { }

    /**
     * Nhận notification từ RabbitMQ Sender Worker và broadcast qua Socket
     */
    @EventPattern('notification.send')
    async handleNotificationSend(
        @Payload() payload: {
            recipientId: string;
            notification: any;
            unreadCount: number;
        },
        @Ctx() context: RmqContext,
    ) {
        const channel = context.getChannelRef();
        const originalMsg = context.getMessage();

        this.logger.log(`Received notification.send for user ${payload.recipientId}`);

        try {
            // Broadcast notification via Socket
            this.notificationGateway.sendNotification(payload.recipientId, payload.notification);
            this.notificationGateway.sendUnreadCountUpdate(payload.recipientId, payload.unreadCount);

            // Acknowledge message
            this.safeAck(channel, originalMsg);
        } catch (error) {
            this.logger.error('Error broadcasting notification:', error);
            this.safeNack(channel, originalMsg);
        }
    }

    /**
     * Safely acknowledge a message
     */
    private safeAck(channel: any, message: any): void {
        try {
            if (channel && message) {
                channel.ack(message);
            }
        } catch (error) {
            this.logger.warn('Failed to ack message:', error.message);
        }
    }

    /**
     * Safely negative acknowledge a message
     */
    private safeNack(channel: any, message: any): void {
        try {
            if (channel && message) {
                channel.nack(message, false, false);
            }
        } catch (error) {
            this.logger.warn('Failed to nack message:', error.message);
        }
    }
}
