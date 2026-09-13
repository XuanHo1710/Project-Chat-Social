import {
  InvalidFeedEventError,
  validateInteractionEvent,
  validatePostEvent,
} from './feed-event.validation';

describe('feed event validation', () => {
  const userId = '65b2f7a2e4b0a1c2d3e4f5a1';
  const postId = '65b2f7a2e4b0a1c2d3e4f5b2';

  it('normalizes a valid interaction event', () => {
    const event = validateInteractionEvent({
      userId,
      interactionType: 'POST_VIEW',
      targetId: postId,
      targetType: 'POST',
      metadata: { timeSpentSeconds: 12, ignored: 'value' },
      timestamp: new Date().toISOString(),
    });

    expect(event.userId).toBe(userId);
    expect(event.metadata).toEqual({ timeSpentSeconds: 12 });
    expect(typeof event.timestamp).toBe('number');
  });

  it('rejects malformed object identifiers', () => {
    expect(() =>
      validateInteractionEvent({
        userId: 'not-an-object-id',
        interactionType: 'POST_VIEW',
        timestamp: Date.now(),
      }),
    ).toThrow(InvalidFeedEventError);
  });

  it('rejects oversized post content', () => {
    expect(() =>
      validatePostEvent({
        eventType: 'POST_CREATED',
        postId,
        authorId: userId,
        postData: { content: 'x'.repeat(10_001) },
        timestamp: Date.now(),
      }),
    ).toThrow('postData.content is invalid');
  });
});
