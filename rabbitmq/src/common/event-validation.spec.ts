import {
  PermanentEventError,
  validateMessageEvent,
  validateNotificationEvent,
} from './event-validation';

describe('RabbitMQ event validation', () => {
  const messageId = '65b2f7a2e4b0a1c2d3e4f5a1';
  const conversationId = '65b2f7a2e4b0a1c2d3e4f5b2';
  const senderId = '65b2f7a2e4b0a1c2d3e4f5b3';

  it('deduplicates message recipient IDs', () => {
    const event = validateMessageEvent({
      messageId,
      conversationId,
      senderId,
      content: 'hello',
      conversationType: 'DIRECT',
      participantIds: [senderId, senderId],
    });
    expect(event.participantIds).toEqual([senderId]);
  });

  it('rejects unsupported notification types', () => {
    expect(() =>
      validateNotificationEvent({
        recipientId: senderId,
        type: 'UNSAFE_TYPE',
        title: 'test',
      })
    ).toThrow(PermanentEventError);
  });

  it('removes unsafe metadata keys', () => {
    const event = validateNotificationEvent({
      recipientId: senderId,
      type: 'SYSTEM',
      title: 'test',
      metadata: {
        safe: true,
        $where: 'unsafe',
        'nested.path': 'unsafe',
        nested: { keep: 'yes', $where: 'unsafe' },
      },
    });
    expect(event.metadata).toEqual({ safe: true, nested: { keep: 'yes' } });
  });
});
