// src/shared/utils/inflight-requests.service.ts
import { Injectable } from '@nestjs/common';

/**
 * Collapses concurrent identical async requests into a single in-flight promise.
 * Keys should uniquely represent the request (e.g., url+params).
 */
@Injectable()
export class InflightRequestsService {
  private readonly inflight = new Map<string, Promise<unknown>>();

  async run<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const p = factory()
      .catch((e) => {
        throw e;
      })
      .finally(() => {
        // Ensure we remove the reference once settled
        this.inflight.delete(key);
      });

    this.inflight.set(key, p);
    return p;
  }
}
