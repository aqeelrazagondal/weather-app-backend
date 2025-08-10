import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { RateLimitException } from '../exceptions/api.exception';

/**
 * Redis-backed rate limiter using atomic INCR/EXPIRE where available.
 * Falls back to non-atomic cache counter if Redis client not available.
 */
@Injectable()
export class RateLimiterService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  private getRedisClient(): any | null {
    // cache-manager-redis-store exposes a Redis client at store.client for v3
    const store: any = (this.cache as any).store;
    if (store?.client) return store.client;
    if (store?.getClient) return store.getClient();
    return null;
  }

  /**
   * Fixed-window counter using Redis INCR/EXPIRE (atomic if possible).
   */
  async consume(key: string, limit: number, windowSec: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = Math.floor(now / windowSec) * windowSec;
    const counterKey = `${key}:${windowStart}`;

    const redis = this.getRedisClient();
    if (redis) {
      // Atomic increment and expire
      const count = await redis.incr(counterKey);
      if (count === 1) {
        await redis.expire(counterKey, windowSec);
      }
      if (count > limit) {
        throw new RateLimitException('Rate limit exceeded');
      }
      return;
    }

    // Fallback (non-atomic across processes)
    const current = (await this.cache.get<number>(counterKey)) ?? 0;
    if (current >= limit) {
      throw new RateLimitException('Rate limit exceeded');
    }
    const ttl = windowStart + windowSec - now;
    await this.cache.set(counterKey, current + 1, ttl);
  }

  /**
   * Multi-bucket check to implement burst control.
   * Example: enforce both per-minute and per-hour limits.
   */
  async consumeMulti(
    buckets: Array<{ key: string; limit: number; windowSec: number }>,
  ): Promise<void> {
    // Evaluate stricter windows first to fail fast
    const sorted = [...buckets].sort((a, b) => a.windowSec - b.windowSec);
    for (const b of sorted) {
      await this.consume(b.key, b.limit, b.windowSec);
    }
  }
}
