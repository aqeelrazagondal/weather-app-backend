import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class RateLimiterService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  /**
   * Consume 1 token from a fixed window counter.
   * - key: a logical bucket (e.g., "owm:requests")
   * - limit: max requests per window
   * - windowSec: window size in seconds (e.g., 3600 for 1 hour)
   */
  async consume(key: string, limit: number, windowSec: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = Math.floor(now / windowSec) * windowSec;
    const ttl = windowStart + windowSec - now;
    const counterKey = `${key}:${windowStart}`;

    // Read current count
    const current = (await this.cache.get<number>(counterKey)) ?? 0;

    if (current >= limit) {
      throw new HttpException(
        'API rate limit exceeded. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Write incremented count with TTL (idempotent enough for our needs).
    // Note: cache-manager does not guarantee atomicity across stores;
    // for Redis in production, consider using a Lua script/INCR for strict atomicity.
    await this.cache.set(counterKey, current + 1, ttl);
  }
}
