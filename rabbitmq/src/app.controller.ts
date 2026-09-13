import { createHash } from 'crypto';
import { Controller, Inject, Logger } from '@nestjs/common';
import { Ctx, ClientProxy, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { AppService } from './app.service';
import {
  PermanentEventError,
  validateMessageEvent,
  validateNotificationEvent,
} from './common/event-validation';
import { EventInboxService, EventLeaseBusyError } from './services/event-inbox.service';
import { NotificationAggregationService } from './services/notification-aggregation.service';
import { RmqChannel, RmqMessage, RmqRetryService } from './services/rmq-retry.service';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly appService: AppService,
    private readonly notificationAggregationService: NotificationAggregationService,
    private readonly eventInbox: EventInboxService,
    private readonly retryService: RmqRetryService,
    @Inject('BACKEND_SERVICE') private readonly backendService: ClientProxy
  ) {}

  @EventPattern('chat.message.created')
  async handleMessageCreated(@Payload() rawPayload: unknown, @Ctx() context: RmqContext) {
    const eventId = this.getEventId(context, 'chat.message.created', rawPayload);
    await this.processEvent(
      context,
      eventId,
      'chat.message.created',
      async () => {
        const payload = validateMessageEvent(rawPayload);
        await this.appService.handleMessageCreated(payload, eventId);
      },
      async (error) => {
        if (error instanceof PermanentEventError) return;
        try {
          await this.appService.handleMessageExhausted(
            validateMessageEvent(rawPayload),
            eventId,
            error
          );
        } catch (finalizationError) {
          this.logger.error(
            `Could not finalize failed chat event ${eventId}: ${this.errorMessage(finalizationError)}`
          );
        }
      },
      rawPayload
    );
  }

  @EventPattern('notification.created')
  async handleNotificationCreated(@Payload() rawPayload: unknown, @Ctx() context: RmqContext) {
    const eventId = this.getEventId(context, 'notification.created', rawPayload);
    await this.processEvent(context, eventId, 'notification.created', async () => {
      const payload = validateNotificationEvent(rawPayload);
      await this.notificationAggregationService.processNotificationEvent(payload, eventId);
    });
  }

  private async processEvent(
    context: RmqContext,
    eventId: string,
    eventType: string,
    handler: () => Promise<void>,
    beforeDeadLetter?: (error: unknown) => Promise<void>,
    rawPayload?: unknown
  ): Promise<void> {
    const channel = context.getChannelRef() as RmqChannel;
    const message = context.getMessage() as unknown as RmqMessage;

    try {
      await handler();
      this.retryService.ack(channel, message);
    } catch (error) {
      if (error instanceof EventLeaseBusyError) {
        try {
          if (this.retryService.canDeferForLease(message)) {
            await this.retryService.deferForLease(channel, message, eventId);
          } else {
            if (eventType === 'chat.message.created' && rawPayload !== undefined) {
              await this.stopTypingForLeaseExhaustedChatEvent(eventId, rawPayload);
            }
            await this.retryService.deadLetter(channel, message, eventId, error);
          }
          this.retryService.ack(channel, message);
        } catch (routingError) {
          this.logger.error(
            `Could not defer duplicate ${eventType} ${eventId}: ${this.errorMessage(routingError)}`
          );
          this.retryService.nack(channel, message);
        }
        return;
      }
      this.logger.warn(`Failed ${eventType} ${eventId}: ${this.errorMessage(error)}`);
      try {
        await this.ensureInboxFailure(eventId, eventType, error);

        if (!(error instanceof PermanentEventError) && this.retryService.canRetry(message)) {
          await this.retryService.retry(channel, message, eventId, error);
          this.retryService.ack(channel, message);
          return;
        }

        if (beforeDeadLetter) await beforeDeadLetter(error);
        await this.retryService.deadLetter(channel, message, eventId, error);
        await this.eventInbox.markDeadLettered(eventId, error);
        this.retryService.ack(channel, message);
      } catch (routingError) {
        this.logger.error(
          `Could not settle ${eventType} ${eventId}; source delivery will be requeued: ${this.errorMessage(routingError)}`
        );
        this.retryService.nack(channel, message);
      }
    }
  }

  private async stopTypingForLeaseExhaustedChatEvent(
    eventId: string,
    rawPayload: unknown
  ): Promise<void> {
    try {
      const payload = validateMessageEvent(rawPayload);
      const isChatbotMessage =
        payload.conversationType === 'CHATBOT' || Boolean(payload.isChatbotMentioned);
      if (!isChatbotMessage) return;
      const aiCompleted = await this.eventInbox.isStepCompleted(eventId, 'aiCompleted');
      if (aiCompleted) return;
      await lastValueFrom(
        this.backendService.emit('chat.typing', {
          conversationId: payload.conversationId,
          isTyping: false,
        }),
        { defaultValue: undefined }
      );
    } catch (typingError) {
      this.logger.warn(
        `Could not clear stuck typing indicator for ${eventId}: ${this.errorMessage(typingError)}`
      );
    }
  }

  private async ensureInboxFailure(
    eventId: string,
    eventType: string,
    error: unknown
  ): Promise<void> {
    try {
      await this.eventInbox.recordFailure(eventId, error, eventType);
    } catch (inboxError) {
      this.logger.error(
        `Could not record inbox failure for ${eventId}: ${this.errorMessage(inboxError)}`
      );
      throw inboxError;
    }
  }

  private getEventId(context: RmqContext, pattern: string, rawPayload: unknown): string {
    const message = context.getMessage() as unknown as RmqMessage;
    const headerValue = message.properties?.headers?.['x-event-id'];
    const headerId = Buffer.isBuffer(headerValue)
      ? headerValue.toString('utf8')
      : typeof headerValue === 'string'
        ? headerValue
        : '';
    const payloadId =
      rawPayload &&
      typeof rawPayload === 'object' &&
      !Array.isArray(rawPayload) &&
      typeof (rawPayload as Record<string, unknown>).eventId === 'string'
        ? ((rawPayload as Record<string, unknown>).eventId as string)
        : '';
    const candidate = headerId || payloadId;
    if (/^[a-zA-Z0-9._:-]{1,200}$/.test(candidate)) return candidate;
    const digest = createHash('sha256').update(message.content).digest('hex');
    return `${pattern}:${digest}`;
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (typeof error === 'number' || typeof error === 'boolean') return String(error);
    return 'Unknown processing error';
  }
}
