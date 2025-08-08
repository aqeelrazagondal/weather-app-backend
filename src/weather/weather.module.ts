import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { WeatherController } from './controllers/weather.controller';
import { WeatherService } from './services/weather.service';
import { WeatherCacheInterceptor } from './interceptors/weather-cache.interceptor';
import { RedisCacheModule } from '../shared/cache/redis-cache.module';
import { RateLimiterService } from '../shared/services/rate-limiter.service';
import { WeatherTransformerService } from './services/weather-transformer.service';

@Module({
  imports: [
    RedisCacheModule,
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000, // 1 minute in milliseconds
        limit: 30, // 30 requests per minute per IP
      },
    ]),
  ],
  controllers: [WeatherController],
  providers: [
    WeatherService,
    WeatherTransformerService,
    RateLimiterService,
    {
      provide: APP_INTERCEPTOR,
      useClass: WeatherCacheInterceptor,
    },
  ],
})
export class WeatherModule {}
