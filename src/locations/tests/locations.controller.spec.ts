/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { LocationsController } from '../locations.controller';
import { LocationsService } from '../locations.service';
import { Units } from '../../weather/dto/wind-forecast.dto';


describe('LocationsController (Unit-ish)', () => {
  let app: INestApplication;
  const mockService = {
    create: jest.fn(),
    findAllMinimal: jest.fn(),
    update: jest.fn(),
    removeOne: jest.fn(),
    removeAll: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocationsController],
      providers: [{ provide: LocationsService, useValue: mockService }],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterEach(() => jest.clearAllMocks());

  afterAll(async () => {
    await app.close();
  });

  const base = '/locations';

  it('POST /locations should reject missing X-Client-Id', async () => {
    await request(app.getHttpServer())
      .post(base)
      .send({ name: 'A', latitude: 1, longitude: 2 })
      .expect(400);
  });

  it('POST /locations should reject invalid UUID', async () => {
    await request(app.getHttpServer())
      .post(base)
      .set('X-Client-Id', 'not-a-uuid')
      .send({ name: 'A', latitude: 1, longitude: 2 })
      .expect(400);
  });

  it('GET /locations should pass pagination and units to service with valid header', async () => {
    mockService.findAllMinimal.mockResolvedValueOnce({ total: 0, page: 1, pageSize: 10, items: [] });
    const uuid = '00000000-0000-4000-8000-000000000000';

    const res = await request(app.getHttpServer())
      .get(`${base}?page=1&pageSize=10&units=${Units.Metric}`)
      .set('X-Client-Id', uuid)
      .expect(200);

    expect(res.body).toEqual({ total: 0, page: 1, pageSize: 10, items: [] });
    expect(mockService.findAllMinimal).toHaveBeenCalledWith(uuid, { page: 1, pageSize: 10 }, Units.Metric);
  });

  it('PATCH /locations/:id should call update', async () => {
    mockService.update.mockResolvedValueOnce({ id: 1 });
    const uuid = '00000000-0000-4000-8000-000000000000';
    await request(app.getHttpServer())
      .patch(`${base}/1`)
      .set('X-Client-Id', uuid)
      .send({ name: 'B' })
      .expect(200);
    expect(mockService.update).toHaveBeenCalledWith(1, uuid, { name: 'B' });
  });

  it('DELETE /locations/:id should call removeOne', async () => {
    mockService.removeOne.mockResolvedValueOnce(undefined);
    const uuid = '00000000-0000-4000-8000-000000000000';
    await request(app.getHttpServer())
      .delete(`${base}/1`)
      .set('X-Client-Id', uuid)
      .expect(204);
    expect(mockService.removeOne).toHaveBeenCalledWith(1, uuid);
  });

  it('DELETE /locations should call removeAll', async () => {
    mockService.removeAll.mockResolvedValueOnce(undefined);
    const uuid = '00000000-0000-4000-8000-000000000000';
    await request(app.getHttpServer())
      .delete(base)
      .set('X-Client-Id', uuid)
      .expect(204);
    expect(mockService.removeAll).toHaveBeenCalledWith(uuid);
  });
});
