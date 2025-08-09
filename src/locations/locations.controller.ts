import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  HttpCode,
  Headers,
  BadRequestException,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { PaginationDto } from './dto/pagination.dto';
import { Units } from '../weather/dto/wind-forecast.dto';
import { WeatherSummary } from '../weather/services/weather.service';
import { Locations } from './entites/location.entity';

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
@Controller({ path: 'locations', version: '1' })
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post()
  @ApiOperation({ summary: 'Add favorite location' })
  @ApiHeader({
    name: 'X-Client-Id',
    description: 'Anonymous client UUID used to scope favorites',
    required: true,
    example: '00000000-0000-4000-8000-000000000000',
  })
  @ApiResponse({ status: 201, description: 'Location added successfully' })
  create(
    @Body() createLocationDto: CreateLocationDto,
    @Headers('x-client-id') clientId: string | undefined,
  ): Promise<Locations> {
    assertUuidV4(clientId);
    return this.locationsService.create(createLocationDto, clientId);
  }

  @Get()
  @ApiOperation({
    summary: 'Get favorite locations (paginated, minimal weather)',
  })
  @ApiHeader({
    name: 'X-Client-Id',
    description: 'Anonymous client UUID used to scope favorites',
    required: true,
    example: '00000000-0000-4000-8000-000000000000',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 10 })
  @ApiQuery({
    name: 'units',
    required: false,
    enum: Units,
    example: Units.Metric,
  })
  @ApiResponse({
    status: 200,
    description: 'List of favorite locations with minimal weather summary',
  })
  findAll(
    @Headers('x-client-id') clientId: string | undefined,
    @Query() pagination: PaginationDto,
    @Query('units') units?: Units,
  ): Promise<{
    total: number;
    page: number;
    pageSize: number;
    items: Array<Locations & { weather: WeatherSummary }>;
  }> {
    assertUuidV4(clientId);
    return this.locationsService.findAllMinimal(
      clientId,
      pagination,
      (units as Units) ?? Units.Metric,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a favorite location' })
  @ApiHeader({
    name: 'X-Client-Id',
    description: 'Anonymous client UUID used to scope favorites',
    required: true,
    example: '00000000-0000-4000-8000-000000000000',
  })
  @ApiParam({ name: 'id', example: 1 })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
    @Headers('x-client-id') clientId: string | undefined,
  ): Promise<Locations> {
    assertUuidV4(clientId);
    return this.locationsService.update(Number(id), clientId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete a specific favorite location (soft-delete)',
  })
  @ApiHeader({
    name: 'X-Client-Id',
    description: 'Anonymous client UUID used to scope favorites',
    required: true,
    example: '00000000-0000-4000-8000-000000000000',
  })
  @ApiParam({ name: 'id', example: 1 })
  removeOne(
    @Param('id') id: string,
    @Headers('x-client-id') clientId: string | undefined,
  ): Promise<void> {
    assertUuidV4(clientId);
    return this.locationsService.removeOne(Number(id), clientId);
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete all favorite locations (soft-delete)' })
  @ApiHeader({
    name: 'X-Client-Id',
    description: 'Anonymous client UUID used to scope favorites',
    required: true,
    example: '00000000-0000-4000-8000-000000000000',
  })
  removeAll(
    @Headers('x-client-id') clientId: string | undefined,
  ): Promise<void> {
    assertUuidV4(clientId);
    return this.locationsService.removeAll(clientId);
  }
}
