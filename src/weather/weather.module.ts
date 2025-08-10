import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { WeatherController } from './controllers/weather.controller';
import { WeatherService } from './services/weather.service';
import { RateLimiterService } from '../shared/services/rate-limiter.service';
import { CacheSwrService } from '../shared/cache/cache-swr.service';
import { InflightRequestsService } from '../shared/utils/inflight-requests.service';

@Module({
  // ConfigModule: provides env access; CacheModule: local cache for dev (global Redis may override)
  imports: [ConfigModule, CacheModule.register()],
  controllers: [WeatherController],
  providers: [
    WeatherService, // core weather business logic (SWR, rate limiting)
    RateLimiterService, // Redis-first rate limiter with fallback
    CacheSwrService, // Stale-While-Revalidate helper
    InflightRequestsService, // collapses concurrent identical requests
  ],
  exports: [WeatherService], // exported for other modules (e.g., Locations)
})
export class WeatherModule {}
