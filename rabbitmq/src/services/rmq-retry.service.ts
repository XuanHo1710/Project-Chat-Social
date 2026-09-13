import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readBoundedInteger } from '../common/configuration';

export interface RmqMessage {
  content: Buffer;
  properties: {
    headers?: Record<string, unknown>;
    contentType?: string;
    contentEncoding?: string;
    correlationId?: string;
    messageId?: string;
    timestamp?: number;
    type?: string;
    appId?: string;
  };
}

export interface RmqChannel {
  assertQueue(
    queue: string,
    options: {
      durable: boolean;
      deadLetterExchange?: string;
      deadLetterRoutingKey?: string;
      messageTtl?: number;
    }
  ): Promise<unknown>;
  sendToQueue(
    queue: string,
    content: Buffer,
    options: Record<string, unknown>,
    callback: (error: Error | null) => void
  ): boolean;
  ack(message: RmqMessage): void;
  nack(message: RmqMessage, allUpTo: boolean, requeue: boolean): void;
}

@Injectable()
export class RmqRetryService {
  private readonly logger = new Logger(RmqRetryService.name);
  private readonly queueName: string;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;

  constructor(config: ConfigService) {
    this.queueName = config.get<string>('RABBITMQ_QUEUE_NAME') || '';
    if (!this.queueName || !/^[a-zA-Z0-9._-]{1,180}$/.test(this.queueName)) {
      throw new Error(
        'RABBITMQ_QUEUE_NAME must contain only letters, numbers, dot, underscore or dash'
      );
    }
    this.maxRetries = readBoundedInteger(
      config.get('RABBITMQ_MAX_RETRIES'),
      3,
      0,
      10,
      'RABBITMQ_MAX_RETRIES'
    );
    this.baseDelayMs = readBoundedInteger(
      config.get('RABBITMQ_RETRY_DELAY_MS'),
      1_000,
      100,
      60_000,
      'RABBITMQ_RETRY_DELAY_MS'
    );
  }

  getRetryCount(message: RmqMessage): number {
    const value = Number(message.properties.headers?.['x-retry-count'] || 0);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  }

  canRetry(message: RmqMessage): boolean {
    return this.getRetryCount(message) < this.maxRetries;
  }

  canDeferForLease(message: RmqMessage): boolean {
    return this.getLeaseRetryCount(message) < 25;
  }

  async deferForLease(channel: RmqChannel, message: RmqMessage, eventId: string): Promise<void> {
    const retryCount = this.getLeaseRetryCount(message) + 1;
    const delayMs = Math.min(15_000 * 2 ** (retryCount - 1), 60_000);
    const retryQueue = `${this.queueName}.lease.${delayMs}`;
    await channel.assertQueue(retryQueue, {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: this.queueName,
      messageTtl: delayMs,
    });
    await this.publishConfirmed(channel, retryQueue, message, {
      'x-lease-retry-count': retryCount,
      'x-event-id': eventId,
    });
    this.logger.debug(`Deferred duplicate delivery ${eventId} for ${delayMs}ms`);
  }

  async retry(
    channel: RmqChannel,
    message: RmqMessage,
    eventId: string,
    error: unknown
  ): Promise<void> {
    const retryCount = this.getRetryCount(message) + 1;
    const delayMs = Math.min(this.baseDelayMs * 2 ** (retryCount - 1), 5 * 60_000);
    const retryQueue = `${this.queueName}.retry.${retryCount}.${delayMs}`;

    await channel.assertQueue(retryQueue, {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: this.queueName,
      messageTtl: delayMs,
    });
    await this.publishConfirmed(channel, retryQueue, message, {
      'x-retry-count': retryCount,
      'x-lease-retry-count': 0,
      'x-event-id': eventId,
      'x-last-error': this.errorMessage(error).slice(0, 500),
    });
    this.logger.warn(
      `Scheduled retry ${retryCount}/${this.maxRetries} for ${eventId} in ${delayMs}ms`
    );
  }

  async deadLetter(
    channel: RmqChannel,
    message: RmqMessage,
    eventId: string,
    error: unknown
  ): Promise<void> {
    const deadLetterQueue = `${this.queueName}.dlq`;
    await channel.assertQueue(deadLetterQueue, { durable: true });
    await this.publishConfirmed(channel, deadLetterQueue, message, {
      'x-event-id': eventId,
      'x-original-queue': this.queueName,
      'x-failed-at': new Date().toISOString(),
      'x-last-error': this.errorMessage(error).slice(0, 500),
    });
    this.logger.error(`Dead-lettered ${eventId}: ${this.errorMessage(error)}`);
  }

  ack(channel: RmqChannel, message: RmqMessage): void {
    channel.ack(message);
  }

  nack(channel: RmqChannel, message: RmqMessage): void {
    channel.nack(message, false, true);
  }

  private async publishConfirmed(
    channel: RmqChannel,
    queue: string,
    message: RmqMessage,
    extraHeaders: Record<string, unknown>
  ): Promise<void> {
    const properties = message.properties || {};
    await new Promise<void>((resolve, reject) => {
      channel.sendToQueue(
        queue,
        message.content,
        {
          persistent: true,
          contentType: properties.contentType || 'application/json',
          contentEncoding: properties.contentEncoding,
          correlationId: properties.correlationId,
          messageId: properties.messageId,
          timestamp: properties.timestamp,
          type: properties.type,
          appId: properties.appId,
          headers: { ...(properties.headers || {}), ...extraHeaders },
        },
        (error) => (error ? reject(error) : resolve())
      );
    });
  }

  private getLeaseRetryCount(message: RmqMessage): number {
    const value = Number(message.properties.headers?.['x-lease-retry-count'] || 0);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (typeof error === 'number' || typeof error === 'boolean') return String(error);
    return 'Unknown processing error';
  }
}
