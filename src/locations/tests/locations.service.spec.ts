/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocationsService } from '../locations.service';
import { Locations } from '../entites/location.entity';
import { WeatherService, WeatherSummary } from '../../weather/services/weather.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Units } from '../../weather/dto/wind-forecast.dto';


describe('LocationsService (Unit)', () => {
  let service: LocationsService;
  let repo: jest.Mocked<Repository<Locations>>;
  let weather: { getCurrentSummary: jest.Mock };

  const clientId = '00000000-0000-4000-8000-000000000000';

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    } as any;

    weather = { getCurrentSummary: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationsService,
        { provide: getRepositoryToken(Locations), useValue: repo },
        { provide: WeatherService, useValue: weather },
      ],
    }).compile();

    service = module.get(LocationsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('create should save a new active location when no duplicates', async () => {
    repo.findOne.mockResolvedValueOnce(null as any); // active check
    repo.findOne.mockResolvedValueOnce(null as any); // inactive check
    const created: Locations = {
      id: 1,
      name: 'London',
      latitude: 51.5074,
      longitude: -0.1278,
      clientId,
      isActive: true,
      updatedAt: new Date(),
    };
    repo.create.mockReturnValue(created);
    repo.save.mockResolvedValueOnce(created);

    const result = await service.create({ name: ' London ', latitude: 51.5074, longitude: -0.1278 }, clientId);

    expect(repo.create).toHaveBeenCalledWith({
      name: 'London',
      latitude: 51.5074,
      longitude: -0.1278,
      clientId,
      isActive: true,
    });
    expect(result).toBe(created);
  });

  it('create should reactivate inactive duplicate', async () => {
    repo.findOne.mockResolvedValueOnce(null as any); // active check
    const inactive: Locations = {
      id: 2,
      name: 'london',
      latitude: 51.5073,
      longitude: -0.128,
      clientId,
      isActive: false,
      updatedAt: new Date(),
    };
    repo.findOne.mockResolvedValueOnce(inactive as any); // inactive found
    repo.save.mockImplementation(async (row: any) => row);

    const res = await service.create({ name: 'London', latitude: 51.5074, longitude: -0.1278 }, clientId);

    expect(res.isActive).toBe(true);
    expect(res.name).toBe('London');
  });

  it('create should throw when active duplicate exists', async () => {
    const existing: Locations = {
      id: 3,
      name: 'London',
      latitude: 51.5074,
      longitude: -0.1278,
      clientId,
      isActive: true,
      updatedAt: new Date(),
    };
    repo.findOne.mockResolvedValueOnce(existing as any);

    await expect(
      service.create({ name: 'London', latitude: 51.5074, longitude: -0.1278 }, clientId),
    ).rejects.toEqual(new HttpException('Location already exists', HttpStatus.CONFLICT));
  });

  it('findAllMinimal should enrich with weather summaries', async () => {
    const rows: Locations[] = [
      { id: 1, name: 'A', latitude: 1, longitude: 2, isActive: true, clientId, updatedAt: new Date() },
      { id: 2, name: 'B', latitude: 3, longitude: 4, isActive: true, clientId, updatedAt: new Date() },
    ];
    repo.findAndCount.mockResolvedValueOnce([rows, rows.length] as any);

    const summary: WeatherSummary = { windSpeed: 1, windDeg: 90, timestamp: 10, units: Units.Metric };
    weather.getCurrentSummary.mockResolvedValue(summary);

    const res = await service.findAllMinimal(clientId, { page: 1, pageSize: 10 } as any, Units.Metric);

    expect(res.total).toBe(2);
    expect(res.items.length).toBe(2);
    expect(res.items[0].weather).toEqual(summary);
    expect(weather.getCurrentSummary).toHaveBeenCalledTimes(2);
  });

  it('update should change provided fields and save', async () => {
    const row: Locations = {
      id: 1,
      name: 'Old',
      latitude: 1,
      longitude: 2,
      isActive: true,
      clientId,
      updatedAt: new Date(),
    };
    repo.findOne.mockResolvedValueOnce(row as any);
    repo.save.mockImplementation(async (r: any) => r);

    const updated = await service.update(1, clientId, { name: ' New  Name ', latitude: 5, longitude: 6 });

    expect(updated.name).toBe('New Name');
    expect(updated.latitude).toBe(5);
    expect(updated.longitude).toBe(6);
  });

  it('update should throw when not found', async () => {
    repo.findOne.mockResolvedValueOnce(null as any);
    await expect(service.update(1, clientId, { name: 'X' })).rejects.toEqual(
      new HttpException('Location not found', HttpStatus.NOT_FOUND),
    );
  });

  it('removeOne should soft delete', async () => {
    const row: Locations = {
      id: 1,
      name: 'X',
      latitude: 0,
      longitude: 0,
      clientId,
      isActive: true,
      updatedAt: new Date(),
    };
    repo.findOne.mockResolvedValueOnce(row as any);
    repo.save.mockResolvedValueOnce({ ...row, isActive: false } as any);

    await service.removeOne(1, clientId);
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
  });

  it('removeOne should throw when not found', async () => {
    repo.findOne.mockResolvedValueOnce(null as any);
    await expect(service.removeOne(1, clientId)).rejects.toEqual(
      new HttpException('Location not found', HttpStatus.NOT_FOUND),
    );
  });

  it('removeAll should soft delete all active or throw when none', async () => {
    repo.find.mockResolvedValueOnce([] as any);
    await expect(service.removeAll(clientId)).rejects.toEqual(
      new HttpException('Location not found', HttpStatus.NOT_FOUND),
    );

    const rows: Locations[] = [
      { id: 1, name: 'A', latitude: 1, longitude: 2, isActive: true, clientId, updatedAt: new Date() },
      { id: 2, name: 'B', latitude: 3, longitude: 4, isActive: true, clientId, updatedAt: new Date() },
    ];
    repo.find.mockResolvedValueOnce(rows as any);
    repo.save.mockResolvedValueOnce(rows.map((r) => ({ ...r, isActive: false })) as any);

    await expect(service.removeAll(clientId)).resolves.toBeUndefined();
    expect(repo.save).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ isActive: false })]));
  });
});
