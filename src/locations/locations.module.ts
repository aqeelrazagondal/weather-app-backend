import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Locations } from './entites/location.entity';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { OpenWeatherService } from '../services/openweather.service';
import { RateLimiterService } from '../shared/services/rate-limiter.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Locations]),
    CacheModule.register({
      ttl: 1800, // 30 minutes
      max: 100,
    }),
  ],
  controllers: [LocationsController],
  providers: [
    LocationsService,
    OpenWeatherService,
    RateLimiterService, // <-- provide RateLimiterService so OpenWeatherService can be constructed
  ],
})
export class LocationsModule {}
