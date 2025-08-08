import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Raw, Repository } from 'typeorm';
import { CreateLocationDto } from './dto/create-location.dto';
import { OpenWeatherService } from '../services/openweather.service';
import { Locations } from './entites/location.entity';
import { WeatherData } from '../shared/types/weather.types';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Locations)
    private readonly locationRepository: Repository<Locations>,
    private readonly openWeatherService: OpenWeatherService,
  ) {}

  /**
   * Create a favorite location for a client.
   * - Avoid duplicates per client (name case-insensitive OR coordinates within epsilon).
   * - If a matching inactive record exists, reactivate it (soft-undeletion).
   */
  async create(createLocationDto: CreateLocationDto, clientId: string) {
    const normalizedName = createLocationDto.name.trim().replace(/\s+/g, ' ');
    const lat = Number(createLocationDto.latitude);
    const lon = Number(createLocationDto.longitude);
    const EPS = 0.0005; // ~55m; tweak as needed to account for geocoding variance

    const existingActive = await this.locationRepository.findOne({
      where: [
        {
          clientId,
          isActive: true,
          name: ILike(normalizedName),
        },
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

    const existingInactive = await this.locationRepository.findOne({
      where: [
        {
          clientId,
          isActive: false,
          name: ILike(normalizedName),
        },
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

  async findAll(clientId: string): Promise<Array<Locations & { weather: WeatherData }>> {
    const locations = await this.locationRepository.find({
      where: { isActive: true, clientId },
      order: { updatedAt: 'DESC' },
    });

    const results = await Promise.all(
      locations.map(async (location) => {
        const weather = await this.openWeatherService.getWeatherByCoordinates(
          Number(location.latitude),
          Number(location.longitude),
        );
        return {
          ...location,
          weather,
        };
      }),
    );

    return results as Array<Locations & { weather: WeatherData }>;
  }

  /**
   * Soft-delete all favorites for a client (current controller calls this without an id).
   * If you want to delete a specific favorite, adjust signature to (id: number, clientId: string)
   * and use where: { id, clientId }.
   */
  async remove(clientId: string): Promise<void> {
    const rows = await this.locationRepository.find({
      where: { clientId, isActive: true },
    });

    if (!rows.length) {
      throw new HttpException('Location not found', HttpStatus.NOT_FOUND);
    }

    for (const row of rows) {
      row.isActive = false;
    }
    await this.locationRepository.save(rows);
  }
}