import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, Max, Min, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

export enum Units {
  Standard = 'standard',
  Metric = 'metric',
  Imperial = 'imperial',
}

export enum Granularity {
  Hourly = 'hourly',
  Daily = 'daily',
}

// Helpers: normalize query param shapes and avoid accidental stringification of objects
function firstParam(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

// Converts enum-like inputs to lowercase strings; uses fallback if input invalid
function toLowerEnumValue(value: unknown, fallback: string): string {
  const v = firstParam(value);
  if (typeof v === 'string') return v.toLowerCase();
  if (typeof v === 'number' || typeof v === 'boolean')
    return String(v).toLowerCase();
  return fallback.toLowerCase();
}

// Parses integer or returns undefined (lets service apply defaults)
function toIntOrUndefined(value: unknown): number | undefined {
  const v = firstParam(value);
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed === '') return undefined;
    const n = Number.parseInt(trimmed, 10);
    return Number.isInteger(n) ? n : undefined;
  }
  return undefined;
}

// Parses float; NaN will be rejected by @IsNumber/@Min/@Max later
function toFloat(value: unknown): number {
  const v = firstParam(value);
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v);
  return NaN as unknown as number;
}

export class WindForecastParamsDto {
  @ApiProperty({ example: 51.5074, minimum: -90, maximum: 90 })
  @Transform(({ value }) => toFloat(value))
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ example: -0.1278, minimum: -180, maximum: 180 })
  @Transform(({ value }) => toFloat(value))
  @IsNumber()
  @Min(-180)
  @Max(180)
  lon!: number;
}

export class WindForecastQueryDto {
  @ApiPropertyOptional({
    enum: Units,
    default: Units.Metric,
    description: 'Units system for temperature/wind',
  })
  @Transform(({ value }) => toLowerEnumValue(value, Units.Metric) as Units)
  @IsEnum(Units)
  units: Units = Units.Metric;

  @ApiPropertyOptional({
    enum: Granularity,
    default: Granularity.Hourly,
    description:
      'Granularity of forecast: hourly (3h steps from OWM) or daily (aggregated server-side)',
  })
  @Transform(
    ({ value }) => toLowerEnumValue(value, Granularity.Hourly) as Granularity,
  )
  @IsEnum(Granularity)
  granularity: Granularity = Granularity.Hourly;

  @ApiPropertyOptional({
    description:
      'Range of data to return. For hourly: hours (3h steps, max 120 hours).',
    example: 24,
  })
  @Transform(({ value }) => toIntOrUndefined(value))
  // Validate only when present; if omitted, service defaults are applied
  @ValidateIf(
    (o: WindForecastQueryDto) =>
      o.granularity === Granularity.Hourly && o.range !== undefined,
  )
  @IsInt()
  @Min(3)
  @Max(120)
  range?: number; // hours

  @ApiPropertyOptional({
    description: 'Days to return (only when granularity=daily)',
    example: 5,
  })
  @Transform(({ value }) => toIntOrUndefined(value))
  // Validate only when present; if omitted, service defaults are applied
  @ValidateIf(
    (o: WindForecastQueryDto) =>
      o.granularity === Granularity.Daily && o.days !== undefined,
  )
  @IsInt()
  @Min(1)
  @Max(7)
  days?: number;
}
