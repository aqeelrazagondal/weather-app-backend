// src/shared/cache/cache-swr.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InflightRequestsService } from '../utils/inflight-requests.service';

/**
 * Stale-While-Revalidate helper built on top of cache-manager:
 * - freshnessKey TTL defines "freshness window"
 * - valueKey TTL defines "stale window" (should be >= freshness TTL)
 */
@Injectable()
export class CacheSwrService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly inflight: InflightRequestsService,
  ) {}

  /**
   * Gets value with SWR:
   * - If fresh: return cached value
   * - If stale but present: return cached value and refresh in background
   * - If no value: compute, store, return
   */
  async getOrRevalidate<T>(
    key: string,
    freshnessSec: number,
    staleSec: number,
    compute: () => Promise<T>,
  ): Promise<T> {
    const valueKey = `val:${key}`;
    const freshKey = `fresh:${key}`;

    const [value, isFresh] = await Promise.all([
      this.cache.get<T>(valueKey),
      this.cache.get<boolean>(freshKey),
    ]);

    if (value && isFresh) {
      return value;
    }

    // If stale value exists, return it and refresh in background (deduped)
    if (value && !isFresh) {
      // Deduplicate concurrent refreshes
      void this.inflight.run(`refresh:${key}`, async () => {
        const newVal = await compute();
        await this.cache.set(valueKey, newVal, staleSec);
        await this.cache.set(freshKey, true, freshnessSec);
      });
      return value;
    }

    // Cache miss: compute and store (deduped to avoid thundering herd)
    return this.inflight.run<T>(`miss:${key}`, async () => {
      const computed = await compute();
      await this.cache.set(valueKey, computed, staleSec);
      await this.cache.set(freshKey, true, freshnessSec);
      return computed;
    });
  }
}
