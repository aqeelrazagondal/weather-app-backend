import { Injectable, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';
import { CacheInterceptor } from '@nestjs/common/cache';

@Injectable()
export class WeatherCacheInterceptor extends CacheInterceptor {
  /**
   * Tracks cache keys based on request parameters
   */
  trackBy(context: ExecutionContext): string | undefined {
    const request = context.switchToHttp().getRequest();
    const { lat, lon } = request.query;

    if (!lat || !lon) {
      return undefined;
    }

    // Create unique cache key based on endpoint and coordinates
    return `weather:${request.route.path}:${lat}:${lon}`;
  }
}