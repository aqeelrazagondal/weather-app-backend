import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { WeatherController } from './controllers/weather.controller';
import { WeatherService } from './services/weather.service';
import { RateLimiterService } from '../shared/services/rate-limiter.service';
import { CacheSwrService } from '../shared/cache/cache-swr.service';
import { InflightRequestsService } from '../shared/utils/inflight-requests.service';

@Module({
  imports: [ConfigModule, CacheModule.register()],
  controllers: [WeatherController],
  providers: [
    WeatherService,
    RateLimiterService,
    CacheSwrService,
    InflightRequestsService,
  ],
  exports: [WeatherService],
})
export class WeatherModule {}
