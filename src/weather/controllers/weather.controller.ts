import {
  Controller,
  Get,
  Param,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { WeatherService } from '../services/weather.service';
import {
  Granularity,
  Units,
  WindForecastParamsDto,
  WindForecastQueryDto,
} from '../dto/wind-forecast.dto';
import { WindForecastResult } from '../types/forecast.types';

@ApiTags('weather')
@Controller({ path: 'weather', version: '1' })
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get(':lat,:lon/forecast')
  @ApiOperation({
    summary: 'Wind forecast',
    description:
      'Retrieve wind forecast (speed, gust, direction) by coordinates with configurable units, granularity, and range.',
  })
  @ApiParam({
    name: 'lat',
    description: 'Latitude (-90..90)',
    example: 51.5074,
  })
  @ApiParam({
    name: 'lon',
    description: 'Longitude (-180..180)',
    example: -0.1278,
  })
  @ApiQuery({
    name: 'units',
    enum: Units,
    required: false,
    example: Units.Metric,
  })
  @ApiQuery({
    name: 'granularity',
    enum: Granularity,
    required: false,
    example: Granularity.Hourly,
  })
  @ApiQuery({
    name: 'range',
    required: false,
    description:
      'When granularity=hourly, number of hours (3h steps, max 120). Example: 24',
    example: 24,
  })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'When granularity=daily, number of days (max 7). Example: 5',
    example: 5,
  })
  @ApiResponse({
    status: 200,
    description: 'Forecast data retrieved successfully',
    schema: {
      example: {
        units: 'metric',
        granularity: 'hourly',
        hourly: [
          {
            temperature: 22.5,
            windSpeed: 5.2,
            windGust: 7.1,
            windDirectionDeg: 45,
            windDirection: 'NE',
            timestamp: 1723206000,
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid coordinates or upstream API error',
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getWindForecast(
    @Param() params: WindForecastParamsDto,
    @Query() query: WindForecastQueryDto,
  ): Promise<WindForecastResult> {
    return this.weatherService.getWindForecast(params.lat, params.lon, query);
  }
}
