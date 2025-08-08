import { ApiProperty } from '@nestjs/swagger';

export class WeatherResponseDto {
  @ApiProperty({
    description: 'Temperature in Celsius',
    example: 22.5,
  })
  temperature: number;

  @ApiProperty({
    description: 'Wind speed in meters per second',
    example: 5.2,
  })
  windSpeed: number;

  @ApiProperty({
    description: 'Cardinal wind direction',
    example: 'NE',
    enum: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
  })
  windDirection: string;

  @ApiProperty({
    description: 'Unix timestamp',
    example: 1628156400,
    required: false,
  })
  timestamp?: number;
}

export class DailyForecastDto {
  @ApiProperty({
    description: 'Date in YYYY-MM-DD format',
    example: '2025-08-06',
  })
  date: string;

  @ApiProperty({
    description: 'Average wind speed for the day',
    example: 4.8,
  })
  avgWindSpeed: number;

  @ApiProperty({
    description: 'Predominant wind direction for the day',
    example: 'SW',
    enum: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N/A'],
  })
  predominantDirection: string;
}

export class ForecastResponseDto {
  @ApiProperty({
    description: 'Hourly weather forecasts',
    type: [WeatherResponseDto],
  })
  hourly: WeatherResponseDto[];

  @ApiProperty({
    description: 'Daily weather summaries',
    type: [DailyForecastDto],
  })
  daily: DailyForecastDto[];
}