/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HttpException } from '@nestjs/common';
import axios from 'axios';
import { firstValueFrom } from 'rxjs';
import { LocationSearchService } from '../services/location-search.service';
import type { OpenWeatherGeoResponse } from '../types/location-search.types';
import { RateLimiterService } from '../../shared/services/rate-limiter.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('LocationSearchService (Unit)', () => {
  let service: LocationSearchService;
  let cacheManager: { get: jest.Mock; set: jest.Mock };
  let rateLimiter: { consume: jest.Mock };

  const mockApiKey = 'test-api-key';
  const mockQuery = 'London';
  const mockCacheKey = `location_search_${mockQuery.toLowerCase()}`;

  const mockLocationResponse: OpenWeatherGeoResponse[] = [
    {
      name: 'London',
      country: 'GB',
      state: 'England',
      lat: 51.5074,
      lon: -0.1278,
    },
    {
      name: 'Lonetown',
      country: 'US',
      state: 'NY',
      lat: 10,
      lon: 20,
    },
  ];

  beforeEach(async () => {
    jest.useFakeTimers();

    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    } as any;

    rateLimiter = { consume: jest.fn().mockResolvedValue(undefined) } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationSearchService,
        { provide: RateLimiterService, useValue: rateLimiter },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue(mockApiKey),
          },
        },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<LocationSearchService>(LocationSearchService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should return empty list for too-short queries', async () => {
    const res = await firstValueFrom(
      service.searchLocationsWithAutocomplete('L'),
    );
    expect(res).toEqual([]);
  });

  it('should return cached results when available', async () => {
    const cached = [
      {
        name: 'London',
        country: 'GB',
        state: 'England',
        lat: 51.5074,
        lon: -0.1278,
        displayName: 'London, England, GB',
        id: expect.any(String),
        countryName: expect.any(String),
      },
    ];
    cacheManager.get.mockResolvedValueOnce(cached);

    const promise = firstValueFrom(
      service.searchLocationsWithAutocomplete(mockQuery, 5),
    );

    jest.advanceTimersByTime(300);
    const res = await promise;
    expect(res).toEqual(cached);
    expect(cacheManager.get).toHaveBeenCalledWith(mockCacheKey);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('should fetch, transform and cache results when cache miss', async () => {
    cacheManager.get.mockResolvedValueOnce(null);
    mockedAxios.get.mockResolvedValueOnce({ data: mockLocationResponse });

    const promise = firstValueFrom(
      service.searchLocationsWithAutocomplete(mockQuery, 5),
    );

    jest.advanceTimersByTime(300);
    const res = await promise;

    expect(Array.isArray(res)).toBe(true);
    expect(res[0].displayName).toBeDefined();
    expect(cacheManager.set).toHaveBeenCalledWith(
      mockCacheKey,
      expect.any(Array),
      3600,
    );
    expect(rateLimiter.consume).toHaveBeenCalled();
  });

  it('should map axios errors to HttpException', async () => {
    cacheManager.get.mockResolvedValueOnce(null);
    mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));

    const promise = firstValueFrom(
      service.searchLocationsWithAutocomplete(mockQuery, 5),
    );
    jest.advanceTimersByTime(300);

    await expect(promise).rejects.toBeInstanceOf(HttpException);
  });
});
