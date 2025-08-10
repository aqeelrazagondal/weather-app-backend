/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { LocationSearchController } from '../controllers/location-search.controller';
import { LocationSearchService } from '../services/location-search.service';
import { LocationSearchResponseDto } from '../dto/location-search.dto';

// Updated unit tests for the controller (replacing outdated integration test)
describe('LocationSearchController (Unit)', () => {
  let controller: LocationSearchController;
  let service: { searchLocationsWithAutocomplete: jest.Mock };

  const mockResults: LocationSearchResponseDto[] = [
    {
      name: 'London',
      country: 'GB',
      state: 'England',
      lat: 51.5074,
      lon: -0.1278,
      displayName: 'London, England, GB',
      id: 'abc',
      countryName: 'United Kingdom',
    },
  ];

  beforeEach(async () => {
    service = {
      searchLocationsWithAutocomplete: jest
        .fn()
        .mockReturnValue(of(mockResults)),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocationSearchController],
      providers: [{ provide: LocationSearchService, useValue: service }],
    }).compile();

    controller = module.get<LocationSearchController>(LocationSearchController);
  });

  it('should delegate to service with defaults', (done) => {
    controller
      .search({
        query: 'Lond',
        limit: undefined,
        autocomplete: undefined,
      } as any)
      .subscribe((res) => {
        expect(res).toEqual(mockResults);
        expect(service.searchLocationsWithAutocomplete).toHaveBeenCalledWith(
          'Lond',
          5,
        );
        done();
      });
  });

  it('should pass custom limit', (done) => {
    controller
      .search({ query: 'Lon', limit: 10, autocomplete: true } as any)
      .subscribe(() => {
        expect(service.searchLocationsWithAutocomplete).toHaveBeenCalledWith(
          'Lon',
          10,
        );
        done();
      });
  });
});
