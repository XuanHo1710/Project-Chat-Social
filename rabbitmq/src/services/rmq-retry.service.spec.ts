import { ConfigService } from '@nestjs/config';
import { RmqChannel, RmqMessage, RmqRetryService } from './rmq-retry.service';

describe('RmqRetryService', () => {
  const createMessage = (): RmqMessage => ({
    content: Buffer.from('{"pattern":"test","data":{}}'),
    properties: { headers: {}, contentType: 'application/json' },
  });

  it('publishes a confirmed delayed retry without acknowledging the source', async () => {
    const config = new ConfigService({
      RABBITMQ_QUEUE_NAME: 'worker_queue',
      RABBITMQ_MAX_RETRIES: '3',
      RABBITMQ_RETRY_DELAY_MS: '100',
    });
    const service = new RmqRetryService(config);
    const sent: Array<{ queue: string; options: Record<string, unknown> }> = [];
    const ack = jest.fn();
    const channel: RmqChannel = {
      assertQueue: jest.fn().mockResolvedValue({}),
      sendToQueue: (queue, _content, options, callback) => {
        sent.push({ queue, options });
        callback(null);
        return true;
      },
      ack,
      nack: jest.fn(),
    };

    await service.retry(channel, createMessage(), 'event-1', new Error('temporary'));

    expect(sent[0].queue).toBe('worker_queue.retry.1.100');
    expect(sent[0].options.headers).toMatchObject({
      'x-retry-count': 1,
      'x-event-id': 'event-1',
    });
    expect(ack).not.toHaveBeenCalled();
  });
});
