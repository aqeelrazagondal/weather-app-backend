import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { Locations } from '../locations/entites/location.entity';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get('DB_HOST'),
  port: configService.get('DB_PORT'),
  username: configService.get('DB_USERNAME'),
  password: configService.get('DB_PASSWORD'),
  database: configService.get('DB_NAME'),
  entities: [User, Locations],
  synchronize: configService.get('NODE_ENV') !== 'production',
  ssl: {
    rejectUnauthorized: false,
  },
  logging: configService.get('NODE_ENV') !== 'production',
});
