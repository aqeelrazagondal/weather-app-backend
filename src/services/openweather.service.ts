import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import axios from 'axios';
import { RateLimiterService } from '../shared/services/rate-limiter.service';

interface OpenWeatherResponse {
  main: { temp: number };
  wind: { speed: number; deg: number };
}

interface WeatherData {
  temperature: number;
  windSpeed: number;
  windDirection: string;
}

@Injectable()
export class OpenWeatherService {
  private readonly OWM_LIMIT_PER_HOUR = 2000;
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor(
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly rateLimiter: RateLimiterService,
  ) {
    const apiKey = this.configService.get<string>('OPENWEATHER_API_KEY');
    const apiUrl = this.configService.get<string>('OPENWEATHER_API_URL');

    if (!apiKey || !apiUrl) {
      throw new Error('OpenWeather API configuration is missing');
    }

    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
  }

  async getWeatherByCoordinates(
    lat: number,
    lon: number,
  ): Promise<WeatherData> {
    const cacheKey = `weather_${lat}_${lon}`;
    const cachedData = await this.cacheManager.get<WeatherData>(cacheKey);
    if (cachedData) return cachedData;

    // Throttle before outbound request
    await this.rateLimiter.consume(
      'owm:requests',
      this.OWM_LIMIT_PER_HOUR,
      3600,
    );

    try {
      const response = await axios.get<OpenWeatherResponse>(
        `${this.apiUrl}/weather`,
        {
          params: { lat, lon, appid: this.apiKey, units: 'metric' },
        },
      );
      const weatherData: WeatherData = {
        temperature: response.data.main.temp,
        windSpeed: response.data.wind.speed,
        windDirection: this.getWindDirection(response.data.wind.deg),
      };
      await this.cacheManager.set(cacheKey, weatherData, 1800);
      return weatherData;
    } catch {
      throw new HttpException(
        'Failed to fetch weather data',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private getWindDirection(degrees: number): string {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index =
      Math.round(((degrees %= 360) < 0 ? degrees + 360 : degrees) / 45) % 8;
    return directions[index];
  }
}
