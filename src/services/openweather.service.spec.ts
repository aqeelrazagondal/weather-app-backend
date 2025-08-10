import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HttpException } from '@nestjs/common';
import axios from 'axios';
import { OpenWeatherService } from './openweather.service';
import { RateLimiterService } from '../shared/services/rate-limiter.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OpenWeatherService (Unit)', () => {
  let service: OpenWeatherService;
  let cache: { get: jest.Mock; set: jest.Mock };
  let rateLimiter: { consume: jest.Mock };

  beforeEach(async () => {
    cache = { get: jest.fn(), set: jest.fn() } as any;
    rateLimiter = { consume: jest.fn().mockResolvedValue(undefined) } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenWeatherService,
        { provide: RateLimiterService, useValue: rateLimiter },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'OPENWEATHER_API_KEY'
                ? 'key'
                : key === 'OPENWEATHER_API_URL'
                ? 'https://api.openweathermap.org/data/2.5'
                : undefined,
          },
        },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get(OpenWeatherService);
  });

  it('should return cached weather when available', async () => {
    const cached = { temperature: 20, windSpeed: 5, windDirection: 'N' };
    cache.get.mockResolvedValueOnce(cached);

    const res = await service.getWeatherByCoordinates(1, 2);
    expect(res).toEqual(cached);
    expect(rateLimiter.consume).not.toHaveBeenCalled();
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('should fetch weather and cache on miss', async () => {
    cache.get.mockResolvedValueOnce(null);
    mockedAxios.get.mockResolvedValueOnce({
      data: { main: { temp: 22 }, wind: { speed: 4, deg: 10 } },
    } as any);

    const res = await service.getWeatherByCoordinates(51.5, -0.1);

    expect(res.temperature).toBe(22);
    expect(res.windSpeed).toBe(4);
    expect(res.windDirection).toBe('N');
    expect(cache.set).toHaveBeenCalled();
    expect(rateLimiter.consume).toHaveBeenCalled();
  });

  it('should map errors to HttpException', async () => {
    cache.get.mockResolvedValueOnce(null);
    mockedAxios.get.mockRejectedValueOnce(new Error('boom'));

    await expect(service.getWeatherByCoordinates(0, 0)).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('should convert wind direction correctly', async () => {
    cache.get.mockResolvedValueOnce(null);
    mockedAxios.get.mockResolvedValueOnce({
      data: { main: { temp: 0 }, wind: { speed: 0, deg: 200 } },
    } as any);

    const res = await service.getWeatherByCoordinates(0, 0);
    expect(res.windDirection).toBe('S');
  });
});
