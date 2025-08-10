import { Injectable, ExecutionContext } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/common/cache';

@Injectable()
export class WeatherCacheInterceptor extends CacheInterceptor {
  /**
   * Tracks cache keys based on request parameters
   */
  trackBy(context: ExecutionContext): string | undefined {
    type Req = { query?: Record<string, unknown>; route?: { path?: string } };
    const req = context.switchToHttp().getRequest<Req>();

    const lat = typeof req.query?.lat === 'string' ? req.query.lat : undefined;
    const lon = typeof req.query?.lon === 'string' ? req.query.lon : undefined;
    const path = typeof req.route?.path === 'string' ? req.route.path : undefined;

    if (!lat || !lon || !path) {
      return undefined;
    }

    // Create unique cache key based on endpoint and coordinates
    return `weather:${path}:${lat}:${lon}`;
  }
}
