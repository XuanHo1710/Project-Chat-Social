import { Logger } from '@nestjs/common';
import {
  BackendRmqChannel,
  BackendRmqMessage,
  settleBackendRmqFailure,
} from './rabbitmq-delivery';

describe('settleBackendRmqFailure', () => {
  const originalQueue = process.env.RABBITMQ_BACKEND_QUEUE;
  const originalRetries = process.env.RABBITMQ_BACKEND_MAX_RETRIES;
  const originalDelay = process.env.RABBITMQ_BACKEND_RETRY_DELAY_MS;

  beforeEach(() => {
    process.env.RABBITMQ_BACKEND_QUEUE = 'backend_queue';
    process.env.RABBITMQ_BACKEND_MAX_RETRIES = '3';
    process.env.RABBITMQ_BACKEND_RETRY_DELAY_MS = '100';
  });

  afterAll(() => {
    restoreEnvironment('RABBITMQ_BACKEND_QUEUE', originalQueue);
    restoreEnvironment('RABBITMQ_BACKEND_MAX_RETRIES', originalRetries);
    restoreEnvironment('RABBITMQ_BACKEND_RETRY_DELAY_MS', originalDelay);
  });

  it('confirms a delayed retry before acknowledging the source', async () => {
    const { channel, sent, ack, nack } = createChannel();
    await settleBackendRmqFailure({
      channel,
      message: createMessage(),
      pattern: 'chat.ai.token',
      error: new Error('temporary'),
      permanent: false,
      logger: createLogger(),
    });

    expect(sent[0].queue).toBe('backend_queue.retry.1.100');
    expect(sent[0].options.headers).toMatchObject({ 'x-retry-count': 1 });
    expect(ack).toHaveBeenCalledTimes(1);
    expect(nack).not.toHaveBeenCalled();
  });

  it('dead-letters permanent failures without retrying', async () => {
    const { channel, sent, ack } = createChannel();
    await settleBackendRmqFailure({
      channel,
      message: createMessage(),
      pattern: 'notification.send',
      error: new Error('invalid'),
      permanent: true,
      logger: createLogger(),
    });

    expect(sent[0].queue).toBe('backend_queue.dlq');
    expect(ack).toHaveBeenCalledTimes(1);
  });

  it('requeues the source when retry publication is not confirmed', async () => {
    const { channel, ack, nack } = createChannel(new Error('publish failed'));
    await settleBackendRmqFailure({
      channel,
      message: createMessage(),
      pattern: 'chat.ai.stream.done',
      error: new Error('temporary'),
      permanent: false,
      logger: createLogger(),
    });

    expect(ack).not.toHaveBeenCalled();
    expect(nack).toHaveBeenCalledWith(expect.anything(), false, true);
  });
});

function createMessage(): BackendRmqMessage {
  return {
    content: Buffer.from('{"pattern":"test","data":{}}'),
    properties: { headers: {}, contentType: 'application/json' },
  };
}

function createChannel(publishError: Error | null = null): {
  channel: BackendRmqChannel;
  sent: Array<{ queue: string; options: Record<string, unknown> }>;
  ack: jest.Mock;
  nack: jest.Mock;
} {
  const sent: Array<{ queue: string; options: Record<string, unknown> }> = [];
  const ack = jest.fn();
  const nack = jest.fn();
  return {
    channel: {
      assertQueue: jest.fn().mockResolvedValue({}),
      sendToQueue: (queue, _content, options, callback) => {
        sent.push({ queue, options });
        callback(publishError);
        return true;
      },
      ack,
      nack,
    },
    sent,
    ack,
    nack,
  };
}

function createLogger(): Logger {
  return {
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as Logger;
}

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
