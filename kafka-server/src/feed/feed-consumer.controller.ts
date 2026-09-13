import { Controller, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Ctx,
  EventPattern,
  KafkaContext,
  Payload,
} from '@nestjs/microservices';
import { readBoundedInteger } from '../common/configuration';
import { FeedService } from './feed.service';
import {
  InvalidFeedEventError,
  validateInteractionEvent,
  validatePostEvent,
} from './feed-event.validation';

@Controller()
export class FeedConsumerController {
  private readonly logger = new Logger(FeedConsumerController.name);
  private readonly maxAttempts: number;

  constructor(
    private readonly feedService: FeedService,
    configService: ConfigService,
  ) {
    this.maxAttempts = readBoundedInteger(
      configService.get('KAFKA_PROCESSING_ATTEMPTS'),
      3,
      1,
      10,
      'KAFKA_PROCESSING_ATTEMPTS',
    );
  }

  @EventPattern('post-events')
  async handlePostEvent(
    @Payload() rawEvent: unknown,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    await this.processWithRetry(rawEvent, context, async () =>
      this.feedService.handlePostEvent(validatePostEvent(rawEvent)),
    );
  }

  @EventPattern('user-interactions')
  async handleUserInteraction(
    @Payload() rawEvent: unknown,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    const eventId = this.getEventId(context, rawEvent);
    await this.processWithRetry(rawEvent, context, async () => {
      await this.feedService.handleInteractionEvent(
        validateInteractionEvent(rawEvent),
        eventId,
      );
    });
  }

  @EventPattern('health-check')
  async handleHealthCheck(@Ctx() context: KafkaContext): Promise<void> {
    await this.commitOffset(context);
  }

  private async processWithRetry(
    rawEvent: unknown,
    context: KafkaContext,
    handler: () => Promise<void>,
  ): Promise<void> {
    const topic = context.getTopic();
    const partition = context.getPartition();
    const offset = context.getMessage().offset;
    const eventId = this.getEventId(context, rawEvent);
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        await handler();
        await this.commitOffset(context);
        this.logger.debug(
          `Processed ${eventId} [${topic}:${partition}:${offset}]`,
        );
        return;
      } catch (error) {
        lastError = error;
        if (error instanceof InvalidFeedEventError) break;
        if (attempt < this.maxAttempts) {
          const delayMs = Math.min(250 * 2 ** (attempt - 1), 2_000);
          this.logger.warn(
            `Attempt ${attempt}/${this.maxAttempts} failed for ${eventId}: ${this.errorMessage(error)}`,
          );
          await this.delay(delayMs);
          await context.getHeartbeat()();
        }
      }
    }

    await this.publishDeadLetter(context, rawEvent, eventId, lastError);
    await this.commitOffset(context);
    this.logger.error(
      `Dead-lettered ${eventId}: ${this.errorMessage(lastError)}`,
    );
  }

  private getEventId(context: KafkaContext, rawEvent?: unknown): string {
    const message = context.getMessage();
    const headerValue = message.headers?.['x-event-id'];
    const explicitId = Buffer.isBuffer(headerValue)
      ? headerValue.toString('utf8')
      : typeof headerValue === 'string'
        ? headerValue
        : '';
    const payloadId =
      rawEvent &&
      typeof rawEvent === 'object' &&
      !Array.isArray(rawEvent) &&
      typeof (rawEvent as Record<string, unknown>).eventId === 'string'
        ? ((rawEvent as Record<string, unknown>).eventId as string)
        : '';
    const safeIdPattern = /^[a-zA-Z0-9._:-]{1,200}$/;
    const candidate = explicitId || payloadId;
    return safeIdPattern.test(candidate)
      ? candidate
      : `${context.getTopic()}:${context.getPartition()}:${message.offset}`;
  }

  private async publishDeadLetter(
    context: KafkaContext,
    rawEvent: unknown,
    eventId: string,
    error: unknown,
  ): Promise<void> {
    const sourceMessage = context.getMessage();
    await context.getProducer().send({
      topic: `${context.getTopic()}.dlq`,
      acks: -1,
      messages: [
        {
          key: sourceMessage.key || Buffer.from(eventId),
          value: JSON.stringify({
            eventId,
            sourceTopic: context.getTopic(),
            sourcePartition: context.getPartition(),
            sourceOffset: sourceMessage.offset,
            failedAt: new Date().toISOString(),
            error: this.errorMessage(error).slice(0, 1_000),
            payload: rawEvent,
          }),
          headers: { 'x-event-id': eventId },
        },
      ],
    });
  }

  private async commitOffset(context: KafkaContext): Promise<void> {
    const message = context.getMessage();
    await context.getConsumer().commitOffsets([
      {
        topic: context.getTopic(),
        partition: context.getPartition(),
        offset: (BigInt(message.offset) + 1n).toString(),
      },
    ]);
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (typeof error === 'number' || typeof error === 'boolean')
      return String(error);
    return 'Unknown processing error';
  }
}
