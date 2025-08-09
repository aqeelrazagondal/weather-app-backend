import { Inject, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import axios, { AxiosError } from 'axios';
import { ConfigService } from '@nestjs/config';
import { RateLimiterService } from '../../shared/services/rate-limiter.service';
import { WeatherTransformer } from '../utils/weather-transformer';
import {
  Granularity,
  Units,
  WindForecastQueryDto,
} from '../dto/wind-forecast.dto';
import {
  WeatherForecastPoint,
  WeatherDailySummary,
  WindForecastResult,
} from '../types/forecast.types';
import { CacheSwrService } from '../../shared/cache/cache-swr.service';

type OwmForecastListItem = {
  dt: number;
  main: { temp: number };
  wind: { speed: number; deg: number; gust?: number };
};

type OwmForecastResponse = {
  cod: string;
  list: OwmForecastListItem[];
};

type OwmCurrentResponse = {
  dt: number;
  wind: { speed: number; deg: number; gust?: number };
  main?: { temp?: number };
};

export type WeatherSummary = {
  windSpeed: number;
  windDeg: number;
  windGust?: number;
  timestamp: number;
  units: Units;
};

@Injectable()
export class WeatherService {
  private readonly apiBase: string;
  private readonly apiKey: string;
  private readonly transformer = new WeatherTransformer();
  private readonly OWM_LIMIT_PER_HOUR = 2000;

  // TTL policy: short for "current", longer for "forecast" (SWR)
  private readonly CURRENT_FRESH_SEC = 180; // serve fresh for 3 minutes
  private readonly CURRENT_STALE_SEC = 300; // allow stale up to 5 minutes
  private readonly FORECAST_FRESH_SEC = 10 * 60; // serve fresh for 10 minutes
  private readonly FORECAST_STALE_SEC = 15 * 60; // allow stale up to 15 minutes

  constructor(
    private readonly config: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly rateLimiter: RateLimiterService,
    private readonly swr: CacheSwrService,
  ) {
    this.apiBase =
      this.config.get<string>('OPENWEATHER_API_URL') ??
      'https://api.openweathermap.org/data/2.5';
    this.apiKey = this.config.getOrThrow<string>('OPENWEATHER_API_KEY');
  }

  // Returns minimal current wind summary; heavily cached with SWR.
  async getCurrentSummary(
    lat: number,
    lon: number,
    units: Units = Units.Metric,
    clientKey?: string,
  ): Promise<WeatherSummary> {
    const key = this.keyCurrent(lat, lon, units);
    return this.swr.getOrRevalidate<WeatherSummary>(
      key,
      this.CURRENT_FRESH_SEC,
      this.CURRENT_STALE_SEC,
      () => this.fetchCurrent(lat, lon, units, clientKey),
    );
  }

  // Performs outbound request for "current"; protected by multi-bucket rate limits.
  private async fetchCurrent(
    lat: number,
    lon: number,
    units: Units,
    clientKey?: string,
  ): Promise<WeatherSummary> {
    await this.rateLimiter.consumeMulti([
      { key: 'owm:requests:1m', limit: 120, windowSec: 60 }, // short burst control
      {
        key: 'owm:requests:1h',
        limit: this.OWM_LIMIT_PER_HOUR,
        windowSec: 3600,
      },
      ...(clientKey
        ? [{ key: `client:${clientKey}:1m`, limit: 120, windowSec: 60 }]
        : []),
    ]);

    try {
      const { data, status } = await axios.get<OwmCurrentResponse>(
        `${this.apiBase}/weather`,
        {
          params: { lat, lon, units, appid: this.apiKey },
          timeout: 5000, // keep upstream budget small
          validateStatus: (s) => s >= 200 && s < 500, // map 4xx for error shaping
        },
      );
      if (status >= 400) {
        throw new HttpException(
          'Upstream current weather error',
          status === 429
            ? HttpStatus.TOO_MANY_REQUESTS
            : HttpStatus.BAD_REQUEST,
        );
      }
      return {
        windSpeed: data.wind?.speed ?? 0,
        windDeg: data.wind?.deg ?? 0,
        windGust: data.wind?.gust,
        timestamp: data.dt,
        units,
      };
    } catch (err) {
      this.handleApiError(err);
    }
  }

  // Main forecast entry; returns hourly or daily view based on query.granularity.
  async getWindForecast(
    lat: number,
    lon: number,
    query: WindForecastQueryDto,
    clientKey?: string,
  ): Promise<WindForecastResult> {
    const { granularity, units } = query;
    const rangeHours =
      granularity === Granularity.Hourly ? (query.range ?? 24) : undefined;
    const rangeDays =
      granularity === Granularity.Daily ? (query.days ?? 5) : undefined;

    const cacheKey = this.keyForecast(
      lat,
      lon,
      units,
      granularity,
      rangeHours,
      rangeDays,
    );

    return this.swr.getOrRevalidate<WindForecastResult>(
      cacheKey,
      this.FORECAST_FRESH_SEC,
      this.FORECAST_STALE_SEC,
      () => this.fetchForecast(lat, lon, query, clientKey),
    );
  }

  // Performs outbound "forecast" call and transforms response to UI-ready shape.
  private async fetchForecast(
    lat: number,
    lon: number,
    query: WindForecastQueryDto,
    clientKey?: string,
  ): Promise<WindForecastResult> {
    const { granularity, units } = query;

    await this.rateLimiter.consumeMulti([
      { key: 'owm:requests:1m', limit: 120, windowSec: 60 },
      {
        key: 'owm:requests:1h',
        limit: this.OWM_LIMIT_PER_HOUR,
        windowSec: 3600,
      },
      ...(clientKey
        ? [{ key: `client:${clientKey}:1m`, limit: 120, windowSec: 60 }]
        : []),
    ]);

    // OWM 5-day/3-hour API caps at 40 entries; 8 entries ≈ 1 day
    const cnt =
      granularity === Granularity.Hourly
        ? Math.min(Math.ceil((query.range ?? 24) / 3), 40)
        : Math.min((query.days ?? 5) * 8, 40);

    try {
      const { data, status } = await axios.get<OwmForecastResponse>(
        `${this.apiBase}/forecast`,
        {
          params: { lat, lon, units, cnt, appid: this.apiKey },
          timeout: 5000,
          validateStatus: (s) => s >= 200 && s < 500,
        },
      );

      if (status >= 400) {
        throw new HttpException(
          'Upstream forecast error',
          status === 429
            ? HttpStatus.TOO_MANY_REQUESTS
            : HttpStatus.BAD_REQUEST,
        );
      }
      if (!data?.list?.length) {
        throw new HttpException(
          'Invalid forecast data',
          HttpStatus.BAD_REQUEST,
        );
      }

      const points: WeatherForecastPoint[] = data.list.map((item) => ({
        temperature: item.main?.temp,
        windSpeed: item.wind?.speed,
        windGust: item.wind?.gust,
        windDirectionDeg: item.wind?.deg,
        windDirection: this.transformer.getWindDirection(item.wind?.deg),
        timestamp: item.dt,
      }));

      if (granularity === Granularity.Hourly) {
        const steps = Math.min(
          points.length,
          Math.ceil((query.range ?? 24) / 3),
        );
        return { units, granularity, hourly: points.slice(0, steps) };
      }

      const daily: WeatherDailySummary[] =
        this.transformer.calculateDailyAverages(points);
      const maxDays = Math.min(daily.length, query.days ?? 5);
      return { units, granularity, daily: daily.slice(0, maxDays) };
    } catch (err) {
      this.handleApiError(err);
    }
  }

  // Cache key helpers round coords to 3 decimals to improve hit rate without losing accuracy
  private keyCurrent(lat: number, lon: number, units: Units): string {
    const r = (n: number) => Math.round(n * 1000) / 1000;
    return `weather:current:${r(lat)}:${r(lon)}:${units}`;
  }

  private keyForecast(
    lat: number,
    lon: number,
    units: Units,
    granularity: Granularity,
    rangeHours?: number,
    rangeDays?: number,
  ): string {
    const r = (n: number) => Math.round(n * 1000) / 1000;
    return `weather:forecast:${r(lat)}:${r(lon)}:${granularity}:${units}:${rangeHours ?? ''}:${rangeDays ?? ''}`;
  }

  // Normalizes provider/transport errors into stable HTTP responses
  private handleApiError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const e = error as AxiosError;
      if (e.response?.status === 429) {
        throw new HttpException(
          'Rate limit exceeded. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new HttpException(
        'Failed to fetch data from weather provider',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException(
      'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
