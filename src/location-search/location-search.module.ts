import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { LocationSearchController } from './controllers/location-search.controller';
import { LocationSearchService } from './services/location-search.service';
import { RateLimiterService } from '../shared/services/rate-limiter.service';

@Module({
  imports: [
    CacheModule.register({
      ttl: 3600, // 1 hour
      max: 100,
      isGlobal: false,
    }),
  ],
  controllers: [LocationSearchController],
  providers: [LocationSearchService, RateLimiterService],
  exports: [LocationSearchService],
})
export class LocationSearchModule {}
