import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HttpException } from '@nestjs/common';
import axios from 'axios';
import { LocationSearchService } from '../services/location-search.service';
import type {
  LocationSearchResult,
  OpenWeatherGeoResponse,
} from '../types/location-search.types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('LocationSearchService', () => {
  let service: LocationSearchService;
  let configService: ConfigService;
  let cacheManager: jest.Mocked<any>;

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
  ];

  const expectedResults: LocationSearchResult[] = [
    {
      name: 'London',
      country: 'GB',
      state: 'England',
      lat: 51.5074,
      lon: -0.1278,
    },
  ];

  beforeEach(async () => {
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationSearchService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(mockApiKey),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
      ],
    }).compile();

    service = module.get<LocationSearchService>(LocationSearchService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchLocations', () => {
    it('should return cached results if available', async () => {
      cacheManager.get.mockResolvedValueOnce(expectedResults);

      const results = await service.searchLocations(mockQuery);

      expect(cacheManager.get).toHaveBeenCalledWith(mockCacheKey);
      expect(results).toEqual(expectedResults);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should fetch and cache new results if cache is empty', async () => {
      cacheManager.get.mockResolvedValueOnce(null);
      mockedAxios.get.mockResolvedValueOnce({ data: mockLocationResponse });

      const results = await service.searchLocations(mockQuery);

      expect(results).toEqual(expectedResults);
      expect(cacheManager.set).toHaveBeenCalledWith(
        mockCacheKey,
        expectedResults,
        3600,
      );
    });

    it('should handle API errors gracefully', async () => {
      cacheManager.get.mockResolvedValueOnce(null);
      mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));

      await expect(service.searchLocations(mockQuery)).rejects.toThrow(
        HttpException,
      );
    });

    it('should throw error if API key is missing', async () => {
      jest.spyOn(configService, 'get').mockReturnValueOnce(undefined);

      expect(
        () => new LocationSearchService(configService, cacheManager),
      ).toThrow('OpenWeather API key is missing');
    });
  });
});
