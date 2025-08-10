import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  MinLength,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
} from 'class-validator';
import { Transform } from 'class-transformer';

// Query DTO
export class LocationSearchQueryDto {
  @ApiProperty({
    description: 'Search query for location',
    example: 'Lond',
    minLength: 2,
  })
  @IsString()
  @MinLength(2)
  query: string;

  @ApiProperty({
    description: 'Enable autocomplete suggestions',
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  autocomplete?: boolean;

  @ApiProperty({
    description: 'Maximum number of suggestions',
    default: 5,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(String(value), 10))
  limit?: number = 5;
}

// Response DTO
export class LocationSearchResponseDto {
  @ApiProperty({
    description: 'City name',
    example: 'London',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Country code (ISO 3166-1 alpha-2)',
    example: 'GB',
  })
  @IsString()
  country: string;

  @ApiProperty({
    description: 'State or region name',
    example: 'England',
    required: false,
  })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({
    description: 'Latitude',
    example: 51.5074,
  })
  @IsNumber()
  lat: number;

  @ApiProperty({
    description: 'Longitude',
    example: -0.1278,
  })
  @IsNumber()
  lon: number;

  @ApiProperty({
    description: 'Preformatted display name "City, State, Country"',
    example: 'London, England, GB',
    required: false,
  })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiProperty({
    description:
      'Stable identifier derived from name+country+lat+lon (SHA-1 hash, hex)',
    example: 'b8f0b2a6e3b44f9a9e0b9413a9b7b2f1a0d3e5c7',
    required: false,
  })
  @IsString()
  @IsOptional()
  id?: string;

  @ApiProperty({
    description: 'Full country name',
    example: 'United Kingdom',
    required: false,
  })
  @IsString()
  @IsOptional()
  countryName?: string;

  @ApiProperty({
    description: 'IANA timezone (if available from upstream)',
    example: 'Europe/London',
    required: false,
  })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiProperty({
    description: 'Population (if available from upstream)',
    example: 8825000,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  population?: number;

  @ApiProperty({
    description:
      'Bounding box [west, south, east, north] if available from upstream',
    example: [-0.5103751, 51.28676, 0.3340155, 51.6918741],
    required: false,
    type: [Number],
  })
  @IsArray()
  @IsOptional()
  bbox?: number[];

  @ApiProperty({
    description: 'Importance/rank score if available from upstream',
    example: 0.85,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  importance?: number;
}
