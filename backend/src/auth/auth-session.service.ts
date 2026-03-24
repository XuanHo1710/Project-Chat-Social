import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

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
    });
  }

  private buildKey(sessionId: string): string {
    return `auth:refresh:${sessionId}`;
  }

  async setRefreshToken(sessionId: string, refreshToken: string, ttlMs: number): Promise<void> {
    const key = this.buildKey(sessionId);
    const ttlSeconds = Math.max(1, Math.floor(ttlMs / 1000));
    await this.redis.set(key, refreshToken, 'EX', ttlSeconds);
  }

  async getRefreshToken(sessionId: string): Promise<string | null> {
    return this.redis.get(this.buildKey(sessionId));
  }

  async removeRefreshToken(sessionId: string): Promise<void> {
    await this.redis.del(this.buildKey(sessionId));
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
