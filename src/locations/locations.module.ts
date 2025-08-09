import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { LocationsService } from './locations.service';
import { LocationsController } from './locations.controller';
import { WeatherModule } from '../weather/weather.module';
import { Locations } from './entites/location.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Locations]),
    CacheModule.register({
      ttl: 1800, // 30 minutes (module-local cache, optional if global Redis cache is used)
      max: 100,
    }),
    WeatherModule, // <-- Import module that exports WeatherService
  ],
  controllers: [LocationsController],
  providers: [LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {}
