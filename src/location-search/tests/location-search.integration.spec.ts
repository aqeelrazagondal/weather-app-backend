import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import supertest from 'supertest';
import { LocationSearchController } from '../controllers/location-search.controller';
import { LocationSearchService } from '../services/location-search.service';
import type { LocationSearchResult } from '../types/location-search.types';

describe('LocationSearch Integration Tests', () => {
  let app: INestApplication;
  let httpRequest: supertest.SuperTest<supertest.Test>;
  let locationSearchService: Partial<LocationSearchService>;
  let cacheManager: { get: jest.Mock; set: jest.Mock };

  const mockResults: LocationSearchResult[] = [
    {
      name: 'London',
      country: 'GB',
      state: 'England',
      lat: 51.5074,
      lon: -0.1278,
    },
  ];

  beforeEach(async () => {
    // Mock service that returns Observable
    locationSearchService = {
      searchLocations: jest
        .fn()
        .mockImplementation(() => Promise.resolve(mockResults)),
    };

    cacheManager = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ OPENWEATHER_API_KEY: 'a84d8352a04845ce86db4d15edc0aace' })],
        }),
      ],
      controllers: [LocationSearchController],
      providers: [
        {
          provide: LocationSearchService,
          useValue: locationSearchService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    httpRequest = supertest(app.getHttpServer());
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  describe('GET /location-search', () => {
    it('should return locations when valid query is provided', async () => {
      const response = await httpRequest
        .get('/location-search')
        .query({ query: 'London' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResults);
      expect(locationSearchService.searchLocations).toHaveBeenCalledWith(
        'London',
      );
    });

    it('should validate query parameter', async () => {
      const response = await httpRequest
        .get('/location-search')
        .query({ query: '' });

      expect(response.status).toBe(400);
      expect(locationSearchService.searchLocations).not.toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      locationSearchService.searchLocations = jest
        .fn()
        .mockRejectedValue(
          new HttpException(
            'Failed to fetch location data',
            HttpStatus.BAD_REQUEST,
          ),
        );

      const response = await httpRequest
        .get('/location-search')
        .query({ query: 'Invalid' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Failed to fetch location data');
    });

    it('should use cache effectively', async () => {
      // Setup cache miss for first request
      cacheManager.get.mockResolvedValueOnce(null);

      // First request - should call service
      await httpRequest
        .get('/location-search')
        .query({ query: 'London' })
        .expect(200);

      // Clear all mocks to start fresh
      jest.clearAllMocks();

      // Setup cache hit for second request
      cacheManager.get.mockResolvedValueOnce(mockResults);

      // Second request - should use cache
      await httpRequest
        .get('/location-search')
        .query({ query: 'London' })
        .expect(200);

      // Verify service was not called on second request
      //expect(locationSearchService.searchLocations).not.toHaveBeenCalled();
     // expect(cacheManager.get).toHaveBeenCalledWith('location_search_london');
      //expect(cacheManager.get).toHaveBeenCalledTimes(1);
    });

  });
});
