import { LocationSearchResult } from '../types/location-search.types';
import { HttpException, HttpStatus } from '@nestjs/common';

export class LocationSearchTestHelper {
  static mockResults: LocationSearchResult[] = [
    {
      name: 'London',
      country: 'GB',
      state: 'England',
      lat: 51.5074,
      lon: -0.1278,
    },
  ];

  static createHttpException(): HttpException {
    return new HttpException(
      'Failed to fetch location data',
      HttpStatus.BAD_REQUEST,
    );
  }
}