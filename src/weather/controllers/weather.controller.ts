import { Controller, Get, Query, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { WeatherService } from '../services/weather.service';
import { WeatherQueryDto } from '../dto/weather-query.dto';
import { ForecastData, WeatherData } from '../../shared/types/weather.types';

@ApiTags('weather')
@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get('current')
  @ApiOperation({
    summary: 'Get current weather',
    description:
      'Retrieve current weather data (temperature, wind) for the given coordinates.',
  })
  @ApiQuery({
    name: 'lat',
    description: 'Latitude',
    example: 51.5074,
    type: Number,
  })
  @ApiQuery({
    name: 'lon',
    description: 'Longitude',
    example: -0.1278,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Current weather data retrieved successfully',
    schema: {
      example: {
        temperature: 22.5,
        windSpeed: 5.2,
        windDirection: 'NE',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid coordinates or upstream API error',
  })
  getCurrentWeather(
    @Query(ValidationPipe) query: WeatherQueryDto,
  ): Promise<WeatherData> {
    return this.weatherService.getCurrentWeather(query.lat, query.lon);
  }

  @Get('forecast')
  @ApiOperation({
    summary: 'Get weather forecast',
    description:
      'Retrieve 5-day/3-hour forecast for the given coordinates. Returns hourly data with daily wind summaries.',
  })
  @ApiQuery({
    name: 'lat',
    description: 'Latitude',
    example: 51.5074,
    type: Number,
  })
  @ApiQuery({
    name: 'lon',
    description: 'Longitude',
    example: -0.1278,
    type: Number,
  })
  @ApiQuery({
    name: 'days',
    description: 'Number of days to include in the forecast (default 5)',
    example: 5,
    required: false,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Forecast data retrieved successfully',
    schema: {
      example: {
        hourly: [
          {
            temperature: 22.5,
            windSpeed: 5.2,
            windDirection: 'NE',
            timestamp: 1628156400,
          },
        ],
        daily: [
          {
            date: '2025-08-07',
            avgWindSpeed: 4.8,
            predominantDirection: 'NE',
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid coordinates or upstream API error',
  })
  getForecast(
    @Query(ValidationPipe) query: WeatherQueryDto,
  ): Promise<ForecastData> {
    return this.weatherService.getForecast(query.lat, query.lon, query.days);
  }
}
