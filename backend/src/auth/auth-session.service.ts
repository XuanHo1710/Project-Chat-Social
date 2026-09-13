import { HttpException, HttpStatus, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import Redis from 'ioredis';

interface StoredSession {
  refreshToken: string;
  userId?: string;
}

export interface RotatedSession {
  userId: string;
  rotatedAt: number;
  av?: number;
}

const ROTATE_SESSION_CAS_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if not current then
  return 0
end
local matches = false
local ok, decoded = pcall(cjson.decode, current)
if ok and type(decoded) == 'table' and decoded['refreshToken'] ~= nil then
  matches = decoded['refreshToken'] == ARGV[3]
else
  matches = current == ARGV[3]
end
if not matches then
  return -1
end
redis.call('SET', KEYS[2], ARGV[1], 'EX', tonumber(ARGV[2]))
redis.call('SADD', KEYS[3], ARGV[5])
redis.call('EXPIRE', KEYS[3], tonumber(ARGV[2]))
redis.call('DEL', KEYS[1])
redis.call('SREM', KEYS[3], ARGV[6])
redis.call('SET', KEYS[4], ARGV[4], 'EX', tonumber(ARGV[2]))
return 1
`;

@Injectable()
export class AuthSessionService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST') || '127.0.0.1',
      port: Number(this.configService.get<string>('REDIS_PORT') || 6379),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      db: Number(this.configService.get<string>('REDIS_DB') || 0),
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
    });
  }

  private buildKey(sessionId: string): string {
    return `auth:refresh:${sessionId}`;
  }

  private buildUserSessionsKey(userId: string): string {
    return `auth:user-sessions:${userId}`;
  }

  private buildRotatedKey(sessionId: string): string {
    return `auth:rotated:${sessionId}`;
  }

  private opaqueKey(scope: string, identity: string): string {
    const digest = createHash('sha256').update(identity.trim().toLowerCase()).digest('hex');
    return `auth:rate:${scope}:${digest}`;
  }

  async setRefreshToken(
    sessionId: string,
    refreshToken: string,
    ttlMs: number,
    userId: string,
  ): Promise<void> {
    const ttlSeconds = Math.max(1, Math.floor(ttlMs / 1000));
    const userSessionsKey = this.buildUserSessionsKey(userId);
    const value: StoredSession = { refreshToken, userId };

    await this.redis
      .multi()
      .set(this.buildKey(sessionId), JSON.stringify(value), 'EX', ttlSeconds)
      .sadd(userSessionsKey, sessionId)
      .expire(userSessionsKey, ttlSeconds)
      .exec();
  }

  async getSession(sessionId: string): Promise<StoredSession | null> {
    const stored = await this.redis.get(this.buildKey(sessionId));
    if (!stored) return null;

    try {
      const parsed = JSON.parse(stored) as StoredSession;
      if (parsed?.refreshToken) return parsed;
    } catch {
      // Backward compatibility for sessions created before structured storage.
    }

    return { refreshToken: stored };
  }

  /**
   * Atomically rotates a refresh session via compare-and-swap. The rotation
   * (new session write, user-set membership update, old key delete, and
   * reuse-detection tombstone) only executes when the stored old session
   * still carries the expected refresh token; otherwise the script is a
   * no-op so concurrent refreshers cannot both fork a live session.
   *
   * Returns:
   *   1  — rotation performed atomically
   *   0  — old session key missing (already rotated/consumed/deleted)
   *   -1 — old key exists but holds a different refresh token (lost race)
   */
  async rotateSessionCas(
    oldSessionId: string,
    newSessionId: string,
    refreshToken: string,
    ttlMs: number,
    userId: string,
    av?: number,
  ): Promise<number> {
    const ttlSeconds = Math.max(1, Math.floor(ttlMs / 1000));
    const userSessionsKey = this.buildUserSessionsKey(userId);

    const result = await this.redis.eval(
      ROTATE_SESSION_CAS_SCRIPT,
      4,
      this.buildKey(oldSessionId),
      this.buildKey(newSessionId),
      userSessionsKey,
      this.buildRotatedKey(oldSessionId),
      JSON.stringify({ refreshToken, userId } satisfies StoredSession),
      String(ttlSeconds),
      refreshToken,
      JSON.stringify({ userId, rotatedAt: Date.now(), av } satisfies RotatedSession),
      newSessionId,
      oldSessionId,
    );

    return Number(result);
  }

  /**
   * Returns reuse information for a sessionId that has already been rotated,
   * otherwise null.
   */
  async getRotatedSession(sessionId: string): Promise<RotatedSession | null> {
    const raw = await this.redis.get(this.buildRotatedKey(sessionId));
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as RotatedSession;
      if (parsed?.userId && typeof parsed.rotatedAt === 'number') return parsed;
    } catch {
      // Legacy plain-userId tombstones carry no timestamp.
      return { userId: raw, rotatedAt: 0 };
    }

    return { userId: raw, rotatedAt: 0 };
  }

  async getRefreshToken(sessionId: string): Promise<string | null> {
    return (await this.getSession(sessionId))?.refreshToken || null;
  }

  async removeRefreshToken(sessionId: string, expectedUserId?: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) return false;
    if (expectedUserId && session.userId && session.userId !== expectedUserId) return false;

    const transaction = this.redis.multi().del(this.buildKey(sessionId));
    if (session.userId) {
      transaction.srem(this.buildUserSessionsKey(session.userId), sessionId);
    }
    await transaction.exec();
    return true;
  }

  async removeAllUserSessions(userId: string): Promise<void> {
    const userSessionsKey = this.buildUserSessionsKey(userId);
    const sessionIds = await this.redis.smembers(userSessionsKey);
    const keys = sessionIds.map((sessionId) => this.buildKey(sessionId));
    if (keys.length > 0) await this.redis.del(...keys);
    await this.redis.del(userSessionsKey);
  }

  async storeOneTimeExchange(code: string, payload: unknown, ttlSeconds = 60): Promise<void> {
    await this.redis.set(
      `auth:oauth-exchange:${code}`,
      JSON.stringify(payload),
      'EX',
      Math.max(1, ttlSeconds),
      'NX',
    );
  }

  async consumeOneTimeExchange<T>(code: string): Promise<T | null> {
    const script = `
      local value = redis.call('GET', KEYS[1])
      if value then redis.call('DEL', KEYS[1]) end
      return value
    `;
    const raw = (await this.redis.eval(script, 1, `auth:oauth-exchange:${code}`)) as
      | string
      | null;
    if (!raw) return null;

    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async assertRateLimit(
    scope: string,
    identity: string,
    limit: number,
    windowSeconds: number,
  ): Promise<void> {
    const script = `
      local count = redis.call('INCR', KEYS[1])
      if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
      return count
    `;
    const count = Number(
      await this.redis.eval(
        script,
        1,
        this.opaqueKey(scope, identity),
        Math.max(1, windowSeconds),
      ),
    );

    if (count > Math.max(1, limit)) {
      throw new HttpException('Quá nhiều yêu cầu. Vui lòng thử lại sau.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async clearRateLimit(scope: string, identity: string): Promise<void> {
    await this.redis.del(this.opaqueKey(scope, identity));
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
