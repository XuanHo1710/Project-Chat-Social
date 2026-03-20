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

  private buildKey(userId: string): string {
    return `auth:refresh:${userId}`;
  }

  async setRefreshToken(userId: string, refreshToken: string, ttlMs: number): Promise<void> {
    const key = this.buildKey(userId);
    const ttlSeconds = Math.max(1, Math.floor(ttlMs / 1000));
    await this.redis.set(key, refreshToken, 'EX', ttlSeconds);
  }

  async getRefreshToken(userId: string): Promise<string | null> {
    return this.redis.get(this.buildKey(userId));
  }

  async removeRefreshToken(userId: string): Promise<void> {
    await this.redis.del(this.buildKey(userId));
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
