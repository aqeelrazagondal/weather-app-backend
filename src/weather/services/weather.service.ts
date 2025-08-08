import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import axios, { AxiosError } from 'axios';
import { WeatherTransformerService } from './weather-transformer.service';
import { RateLimiterService } from '../../shared/services/rate-limiter.service';

interface OpenWeatherResponse {
  main: { temp: number };
  wind: { speed: number; deg: number };
}
interface OpenWeatherForecastResponse {
  list: Array<{
    dt: number;
    main: { temp: number };
    wind: { speed: number; deg: number };
  }>;
}
interface OpenWeatherErrorResponse {
  message?: string;
}
interface WeatherData {
  temperature: number;
  windSpeed: number;
  windDirection: string;
}
interface WeatherForecastData {
  temperature: number;
  windSpeed: number;
  windDirection: string;
  timestamp: number;
}
interface ForecastData {
  hourly: WeatherForecastData[];
  daily: { date: string; avgWindSpeed: number; predominantDirection: string }[];
}

@Injectable()
export class WeatherService {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly CACHE_TTL = 1800; // 30 minutes
  private readonly OWM_LIMIT_PER_HOUR = 2000;

  constructor(
    private readonly configService: ConfigService,
    private readonly weatherTransformer: WeatherTransformerService,
    private readonly rateLimiterService: RateLimiterService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    this.apiKey = this.configService.getOrThrow<string>('OPENWEATHER_API_KEY');
    this.apiUrl = this.configService.getOrThrow<string>('OPENWEATHER_API_URL');
  }

  async getCurrentWeather(lat: number, lon: number): Promise<WeatherData> {
    const cacheKey = `weather:${lat}:${lon}`;
    const cached = await this.cacheManager.get<WeatherData>(cacheKey);
    if (cached) return cached;

    // Throttle before outbound request (fixed 1-hour window)
    await this.rateLimiterService.consume(
      'owm:requests',
      this.OWM_LIMIT_PER_HOUR,
      3600,
    );

    try {
      const { data } = await this.makeApiRequest<OpenWeatherResponse>(
        '/weather',
        { lat, lon },
      );

      if (!this.isValidWeatherResponse(data)) {
        throw new Error('Invalid weather data format');
      }

      const weather = this.weatherTransformer.transformWeatherData({
        temp: data.main.temp,
        speed: data.wind.speed,
        deg: data.wind.deg,
      });

      await this.cacheManager.set(cacheKey, weather, this.CACHE_TTL);
      return weather;
    } catch (error) {
      this.handleApiError(error);
    }
  }

  async getForecast(lat: number, lon: number, days = 5): Promise<ForecastData> {
    const cacheKey = `forecast:${lat}:${lon}:${days}`;
    const cached = await this.cacheManager.get<ForecastData>(cacheKey);
    if (cached) return cached;

    // Throttle before outbound request
    await this.rateLimiterService.consume(
      'owm:requests',
      this.OWM_LIMIT_PER_HOUR,
      3600,
    );

    try {
      const { data } = await this.makeApiRequest<OpenWeatherForecastResponse>(
        '/forecast',
        {
          lat,
          lon,
          cnt: days * 8,
        },
      );

      if (!this.isValidForecastResponse(data)) {
        throw new Error('Invalid forecast data format');
      }

      const hourlyData: WeatherForecastData[] = data.list.map((item) => ({
        temperature: item.main.temp,
        windSpeed: item.wind.speed,
        windDirection: this.weatherTransformer.getWindDirection(item.wind.deg),
        timestamp: item.dt,
      }));

      const forecast: ForecastData = {
        hourly: hourlyData,
        daily: this.weatherTransformer.calculateDailyAverages(hourlyData),
      };

      await this.cacheManager.set(cacheKey, forecast, this.CACHE_TTL);
      return forecast;
    } catch (error) {
      this.handleApiError(error);
    }
  }

  private async makeApiRequest<T>(
    endpoint: string,
    params: Record<string, unknown>,
  ): Promise<{ data: T }> {
    return axios.get<T>(`${this.apiUrl}${endpoint}`, {
      params: {
        ...params,
        appid: this.apiKey,
        units: 'metric',
      },
    });
  }

  private isValidWeatherResponse(data: unknown): data is OpenWeatherResponse {
    return (
      data !== null &&
      typeof data === 'object' &&
      'main' in data &&
      'wind' in data &&
      typeof (data as OpenWeatherResponse).main?.temp === 'number' &&
      typeof (data as OpenWeatherResponse).wind?.speed === 'number' &&
      typeof (data as OpenWeatherResponse).wind?.deg === 'number'
    );
  }

  private isValidForecastResponse(
    data: unknown,
  ): data is OpenWeatherForecastResponse {
    return (
      data !== null &&
      typeof data === 'object' &&
      'list' in data &&
      Array.isArray((data as OpenWeatherForecastResponse).list)
    );
  }

  private handleApiError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<OpenWeatherErrorResponse>;
      throw new HttpException(
        axiosError.response?.data?.message ?? 'Failed to fetch weather data',
        axiosError.response?.status ?? HttpStatus.BAD_REQUEST,
      );
    }
    throw new HttpException(
      error instanceof Error ? error.message : 'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
