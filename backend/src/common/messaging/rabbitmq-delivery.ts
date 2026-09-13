import { createHash } from 'crypto';
import { Logger } from '@nestjs/common';

export interface BackendRmqMessage {
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

export interface BackendRmqChannel {
  assertQueue(
    queue: string,
    options: {
      durable: boolean;
      deadLetterExchange?: string;
      deadLetterRoutingKey?: string;
      messageTtl?: number;
    },
  ): Promise<unknown>;
  sendToQueue(
    queue: string,
    content: Buffer,
    options: Record<string, unknown>,
    callback: (error: Error | null) => void,
  ): boolean;
  ack(message: BackendRmqMessage): void;
  nack(message: BackendRmqMessage, allUpTo: boolean, requeue: boolean): void;
}

interface FailureSettlement {
  channel: BackendRmqChannel;
  message: BackendRmqMessage;
  pattern: string;
  error: unknown;
  permanent: boolean;
  logger: Logger;
}

export async function settleBackendRmqFailure({
  channel,
  message,
  pattern,
  error,
  permanent,
  logger,
}: FailureSettlement): Promise<void> {
  const queueName = process.env.RABBITMQ_BACKEND_QUEUE || 'backend_queue';
  if (!/^[a-zA-Z0-9._-]{1,180}$/.test(queueName)) {
    logger.error('RABBITMQ_BACKEND_QUEUE is invalid; requeueing source delivery');
    channel.nack(message, false, true);
    return;
  }

  const maxRetries = readBoundedInteger(
    process.env.RABBITMQ_BACKEND_MAX_RETRIES,
    3,
    0,
    10,
  );
  const baseDelayMs = readBoundedInteger(
    process.env.RABBITMQ_BACKEND_RETRY_DELAY_MS,
    1_000,
    100,
    60_000,
  );
  const retryCount = readHeaderCount(message, 'x-retry-count');
  const eventId = readEventId(message, pattern);

  try {
    if (!permanent && retryCount < maxRetries) {
      const nextRetry = retryCount + 1;
      const delayMs = Math.min(baseDelayMs * 2 ** (nextRetry - 1), 5 * 60_000);
      const retryQueue = `${queueName}.retry.${nextRetry}.${delayMs}`;
      await channel.assertQueue(retryQueue, {
        durable: true,
        deadLetterExchange: '',
        deadLetterRoutingKey: queueName,
        messageTtl: delayMs,
      });
      await publishConfirmed(channel, retryQueue, message, {
        'x-retry-count': nextRetry,
        'x-event-id': eventId,
        'x-last-error': errorMessage(error).slice(0, 500),
      });
      channel.ack(message);
      logger.warn(
        `Scheduled backend RabbitMQ retry ${nextRetry}/${maxRetries} for ${eventId}`,
      );
      return;
    }

    const deadLetterQueue = `${queueName}.dlq`;
    await channel.assertQueue(deadLetterQueue, { durable: true });
    await publishConfirmed(channel, deadLetterQueue, message, {
      'x-event-id': eventId,
      'x-original-queue': queueName,
      'x-failed-at': new Date().toISOString(),
      'x-last-error': errorMessage(error).slice(0, 500),
    });
    channel.ack(message);
    logger.error(`Dead-lettered backend RabbitMQ event ${eventId}`);
  } catch (settlementError) {
    logger.error(
      `Could not publish retry/DLQ for ${eventId}; requeueing source: ${errorMessage(settlementError)}`,
    );
    channel.nack(message, false, true);
  }
}

function publishConfirmed(
  channel: BackendRmqChannel,
  queue: string,
  message: BackendRmqMessage,
  extraHeaders: Record<string, unknown>,
): Promise<void> {
  const properties = message.properties || {};
  return new Promise((resolve, reject) => {
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
      (publishError) => (publishError ? reject(publishError) : resolve()),
    );
  });
}

function readHeaderCount(message: BackendRmqMessage, name: string): number {
  const count = Number(message.properties.headers?.[name] || 0);
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0;
}

function readEventId(message: BackendRmqMessage, pattern: string): string {
  const raw = message.properties.headers?.['x-event-id'];
  const candidate = Buffer.isBuffer(raw)
    ? raw.toString('utf8')
    : typeof raw === 'string'
      ? raw
      : '';
  if (/^[a-zA-Z0-9._:-]{1,200}$/.test(candidate)) return candidate;
  return `${pattern}:${createHash('sha256').update(message.content).digest('hex')}`;
}

function readBoundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = value === undefined || value === '' ? fallback : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'number' || typeof error === 'boolean') return String(error);
  return 'Unknown RabbitMQ handler error';
}
