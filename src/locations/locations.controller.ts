import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  HttpCode,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { LocationSearchResponseDto } from '../location-search/dto/location-search.dto';
import { Locations } from './entites/location.entity';
import { WeatherData } from '../shared/types/weather.types';

function assertUuidV4(value: string | undefined): asserts value is string {
  if (!value) {
    throw new BadRequestException('X-Client-Id header is required');
  }
  const uuidV4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidV4.test(value)) {
    throw new BadRequestException('X-Client-Id must be a valid UUID v4');
  }
}

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post()
  @ApiOperation({
    summary: 'Add favorite location',
    description: 'Add a new location to favorites for the provided client',
  })
  @ApiHeader({
    name: 'X-Client-Id',
    description: 'Anonymous client UUID used to scope favorites',
    required: true,
    example: 'b3a0f4f1-6b0b-4a0a-9f8b-11d0a1b2c3d4',
  })
  @ApiResponse({
    status: 201,
    description: 'Location added successfully',
    type: LocationSearchResponseDto,
  })
  create(
    @Body() createLocationDto: CreateLocationDto,
    @Headers('x-client-id') clientId: string | undefined,
  ): Promise<Locations> {
    assertUuidV4(clientId);
    return this.locationsService.create(createLocationDto, clientId);
  }

  @Get()
  @ApiOperation({
    summary: 'Get favorite locations',
    description:
      'Retrieve all favorite locations for the provided client with current weather',
  })
  @ApiHeader({
    name: 'X-Client-Id',
    description: 'Anonymous client UUID used to scope favorites',
    required: true,
    example: 'b3a0f4f1-6b0b-4a0a-9f8b-11d0a1b2c3d4',
  })
  @ApiResponse({
    status: 200,
    description: 'List of favorite locations',
    type: [LocationSearchResponseDto],
  })
  findAll(
    @Headers('x-client-id') clientId: string | undefined,
  ): Promise<Array<Locations & { weather: WeatherData }>> {
    assertUuidV4(clientId);
    return this.locationsService.findAll(clientId);
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete locations',
    description: 'Soft-delete all favorite locations for the provided client',
  })
  @ApiHeader({
    name: 'X-Client-Id',
    description: 'Anonymous client UUID used to scope favorites',
    required: true,
    example: 'b3a0f4f1-6b0b-4a0a-9f8b-11d0a1b2c3d4',
  })
  @ApiResponse({ status: 204, description: 'Locations deleted successfully' })
  @ApiResponse({ status: 404, description: 'Location not found' })
  remove(
    @Headers('x-client-id') clientId: string | undefined,
  ): Promise<void> {
    assertUuidV4(clientId);
    return this.locationsService.remove(clientId);
  }
}
