/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import axios from 'axios';
import { HttpException, HttpStatus } from '@nestjs/common';
import { WeatherService } from '../services/weather.service';
import { RateLimiterService } from '../../shared/services/rate-limiter.service';
import { CacheSwrService } from '../../shared/cache/cache-swr.service';
import {
  Granularity,
  Units,
  WindForecastQueryDto,
} from '../dto/wind-forecast.dto';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WeatherService (Unit)', () => {
  let service: WeatherService;
  let rateLimiter: { consumeMulti: jest.Mock };
  let cacheManager: Partial<Cache>;
  let swr: { getOrRevalidate: jest.Mock };

  const apiKey = 'test-weather-key';

  beforeEach(async () => {
    rateLimiter = {
      consumeMulti: jest.fn().mockResolvedValue(undefined),
    } as any;
    cacheManager = { get: jest.fn(), set: jest.fn() } as any;
    swr = {
      getOrRevalidate: jest
        .fn()
        .mockImplementation(
          async (_key, _fresh, _stale, factory: () => Promise<any>) => {
            return factory();
          },
        ),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeatherService,
        { provide: RateLimiterService, useValue: rateLimiter },
        { provide: CacheSwrService, useValue: swr },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((k: string) => {
              if (k === 'OPENWEATHER_API_URL')
                return 'https://api.openweathermap.org/data/2.5';
              return undefined;
            }),
            getOrThrow: jest.fn().mockReturnValue(apiKey),
          },
        },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get(WeatherService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('getCurrentSummary should call axios and return normalized summary', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: { dt: 123, wind: { speed: 5.4, deg: 270, gust: 7.1 } },
    } as any);

    const res = await service.getCurrentSummary(
      10,
      20,
      Units.Metric,
      'client-1',
    );

    expect(rateLimiter.consumeMulti).toHaveBeenCalled();
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://api.openweathermap.org/data/2.5/weather',
      expect.objectContaining({
        params: expect.objectContaining({
          lat: 10,
          lon: 20,
          units: Units.Metric,
          appid: apiKey,
        }),
      }),
    );
    expect(res).toEqual({
      windSpeed: 5.4,
      windDeg: 270,
      windGust: 7.1,
      timestamp: 123,
      units: Units.Metric,
    });
    expect(swr.getOrRevalidate).toHaveBeenCalled();
  });

  it('getCurrentSummary should map upstream 429 to TOO_MANY_REQUESTS', async () => {
    mockedAxios.get.mockResolvedValueOnce({ status: 429, data: {} } as any);
    await expect(service.getCurrentSummary(1, 2, Units.Metric)).rejects.toEqual(
      new HttpException(
        'Upstream current weather error',
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );
  });

  it('getCurrentSummary should map transport errors to BAD_REQUEST', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('network'));
    await expect(
      service.getCurrentSummary(1, 2, Units.Metric),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('getWindForecast hourly should return limited number of points based on range', async () => {
    const list = Array.from({ length: 40 }, (_, i) => ({
      dt: i,
      main: { temp: 10 + i },
      wind: { speed: 3 + i, deg: (i * 10) % 360 },
    }));
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: { cod: '200', list },
    } as any);

    const query: WindForecastQueryDto = {
      granularity: Granularity.Hourly,
      units: Units.Metric,
      range: 12,
    };
    const res = await service.getWindForecast(1, 2, query);

    expect(rateLimiter.consumeMulti).toHaveBeenCalled();
    expect(swr.getOrRevalidate).toHaveBeenCalled();
    expect(res.granularity).toBe(Granularity.Hourly);
    // 3h steps: for 12 hours expect 4 points
    expect(res.hourly?.length).toBe(4);
    expect(res.units).toBe(Units.Metric);
  });

  it('getWindForecast daily should aggregate and limit by days', async () => {
    const list = Array.from({ length: 24 }, (_, i) => ({
      dt: 1000 + i,
      main: { temp: 10 + i },
      wind: { speed: 5 + (i % 5), deg: (i * 15) % 360 },
    }));
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: { cod: '200', list },
    } as any);

    const query: WindForecastQueryDto = {
      granularity: Granularity.Daily,
      units: Units.Metric,
      days: 3,
    };
    const res = await service.getWindForecast(51.5, -0.1, query);

    expect(res.granularity).toBe(Granularity.Daily);
    expect(res.daily?.length).toBeLessThanOrEqual(3);
  });

  it('getWindForecast should throw on upstream error status', async () => {
    mockedAxios.get.mockResolvedValueOnce({ status: 400, data: {} } as any);
    await expect(
      service.getWindForecast(1, 2, {
        granularity: Granularity.Hourly,
        units: Units.Metric,
        range: 6,
      }),
    ).rejects.toEqual(
      new HttpException('Upstream forecast error', HttpStatus.BAD_REQUEST),
    );
  });

  it('getWindForecast should throw on empty data list', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: { cod: '200', list: [] },
    } as any);
    await expect(
      service.getWindForecast(1, 2, {
        granularity: Granularity.Hourly,
        units: Units.Metric,
        range: 6,
      }),
    ).rejects.toEqual(
      new HttpException('Invalid forecast data', HttpStatus.BAD_REQUEST),
    );
  });
});
