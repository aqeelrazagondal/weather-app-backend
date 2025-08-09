import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Raw, Repository } from 'typeorm';
import { CreateLocationDto } from './dto/create-location.dto';
import {
  WeatherService,
  WeatherSummary,
} from '../weather/services/weather.service';
import { PaginationDto } from './dto/pagination.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { Units } from '../weather/dto/wind-forecast.dto';
import { Locations } from './entites/location.entity';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Locations)
    private readonly locationRepository: Repository<Locations>,
    private readonly weatherService: WeatherService, // used to enrich favorites with minimal "current" wind
  ) {}

  async create(createLocationDto: CreateLocationDto, clientId: string) {
    const normalizedName = createLocationDto.name.trim().replace(/\s+/g, ' ');
    const lat = Number(createLocationDto.latitude);
    const lon = Number(createLocationDto.longitude);
    const EPS = 0.0005; // ~55m tolerance for coordinate dupe detection

    // Prevent duplicates per client by name (case-insensitive) or near-identical coordinates
    const existingActive = await this.locationRepository.findOne({
      where: [
        { clientId, isActive: true, name: ILike(normalizedName) },
        {
          clientId,
          isActive: true,
          latitude: Raw((alias) => `${alias} BETWEEN :minLat AND :maxLat`, {
            minLat: lat - EPS,
            maxLat: lat + EPS,
          }),
          longitude: Raw((alias) => `${alias} BETWEEN :minLon AND :maxLon`, {
            minLon: lon - EPS,
            maxLon: lon + EPS,
          }),
        },
      ],
    });

    if (existingActive) {
      throw new HttpException('Location already exists', HttpStatus.CONFLICT);
    }

    // Reactivate soft-deleted duplicates instead of creating a new row
    const existingInactive = await this.locationRepository.findOne({
      where: [
        { clientId, isActive: false, name: ILike(normalizedName) },
        {
          clientId,
          isActive: false,
          latitude: Raw((alias) => `${alias} BETWEEN :minLat AND :maxLat`, {
            minLat: lat - EPS,
            maxLat: lat + EPS,
          }),
          longitude: Raw((alias) => `${alias} BETWEEN :minLon AND :maxLon`, {
            minLon: lon - EPS,
            maxLon: lon + EPS,
          }),
        },
      ],
    });

    if (existingInactive) {
      existingInactive.isActive = true;
      existingInactive.name = normalizedName;
      existingInactive.latitude = lat;
      existingInactive.longitude = lon;
      return this.locationRepository.save(existingInactive);
    }

    const location = this.locationRepository.create({
      name: normalizedName,
      latitude: lat,
      longitude: lon,
      clientId,
      isActive: true,
    });

    return this.locationRepository.save(location);
  }

  async findAllMinimal(
    clientId: string,
    pagination: PaginationDto,
    units: Units = Units.Metric,
  ): Promise<{
    total: number;
    page: number;
    pageSize: number;
    items: Array<Locations & { weather: WeatherSummary }>;
  }> {
    const [items, total] = await this.locationRepository.findAndCount({
      where: { isActive: true, clientId },
      order: { updatedAt: 'DESC' }, // show most recently updated first
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    });

    // Enrich with minimal, cached "current" wind summary per location
    const results = await Promise.all(
      items.map(async (location) => {
        const weather = await this.weatherService.getCurrentSummary(
          Number(location.latitude),
          Number(location.longitude),
          units,
          clientId, // optional per-client bucket for rate limiter
        );
        return { ...location, weather };
      }),
    );

    return {
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      items: results,
    };
  }

  async update(
    id: number,
    clientId: string,
    dto: UpdateLocationDto,
  ): Promise<Locations> {
    const row = await this.locationRepository.findOne({
      where: { id, clientId },
    });
    if (!row)
      throw new HttpException('Location not found', HttpStatus.NOT_FOUND);

    if (dto.name !== undefined) row.name = dto.name.trim().replace(/\s+/g, ' ');
    if (dto.latitude !== undefined) row.latitude = Number(dto.latitude);
    if (dto.longitude !== undefined) row.longitude = Number(dto.longitude);
    if (dto.isActive !== undefined) row.isActive = dto.isActive;

    return this.locationRepository.save(row);
  }

  async removeOne(id: number, clientId: string): Promise<void> {
    const row = await this.locationRepository.findOne({
      where: { id, clientId, isActive: true },
    });
    if (!row)
      throw new HttpException('Location not found', HttpStatus.NOT_FOUND);
    row.isActive = false; // soft-delete
    await this.locationRepository.save(row);
  }

  async removeAll(clientId: string): Promise<void> {
    const rows = await this.locationRepository.find({
      where: { clientId, isActive: true },
    });
    if (!rows.length) {
      throw new HttpException('Location not found', HttpStatus.NOT_FOUND);
    }
    for (const row of rows) row.isActive = false;
    await this.locationRepository.save(rows);
  }
}
