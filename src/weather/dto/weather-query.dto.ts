import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsLatitude, IsLongitude, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class WeatherQueryDto {
  @ApiProperty({
    description: 'Latitude of the location',
    example: 51.5074,
  })
  @IsNumber()
  @IsLatitude()
  @Type(() => Number)
  lat: number;

  @ApiProperty({
    description: 'Longitude of the location',
    example: -0.1278,
  })
  @IsNumber()
  @IsLongitude()
  @Type(() => Number)
  lon: number;

  @ApiProperty({
    description: 'Number of days for forecast',
    default: 5,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  days?: number = 5;
}
