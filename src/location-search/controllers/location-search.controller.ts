import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { LocationSearchService } from '../services/location-search.service';
import { LocationSearchQueryDto, LocationSearchResponseDto } from '../dto/location-search.dto';

@ApiTags('location-search')
@Controller('location-search')
export class LocationSearchController {
  constructor(private readonly locationSearchService: LocationSearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Search locations with autocomplete',
    description: 'Search for locations with optional autocomplete support',
  })
  @ApiResponse({
    status: 200,
    description: 'Location suggestions retrieved successfully',
    type: [LocationSearchResponseDto],
  })
  search(
    @Query() query: LocationSearchQueryDto,
  ): Observable<LocationSearchResponseDto[]> {
    return this.locationSearchService.searchLocationsWithAutocomplete(
      query.query,
      query.limit || 5,
    );
  }
}
