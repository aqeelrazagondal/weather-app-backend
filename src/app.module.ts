import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from './config/database.config';
import { validate } from './config/env.validation';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LocationsModule } from './locations/locations.module';
import { WeatherModule } from './weather/weather.module';
import { LocationSearchModule } from './location-search/location-search.module';
import { HealthModule } from './health/health.module';
import { CacheRedisModule } from './config/cache.redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: '.env',
    }),
    CacheRedisModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        getDatabaseConfig(configService),
    }),
    HealthModule,
    WeatherModule,
    LocationsModule,
    LocationSearchModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
