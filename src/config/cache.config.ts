import { CacheModuleOptions } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

export const getCacheConfig = (): CacheModuleOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  const redisPort = process.env.REDIS_PORT
    ? parseInt(process.env.REDIS_PORT, 10)
    : 6379;
  const redisTtl = process.env.REDIS_TTL
    ? parseInt(process.env.REDIS_TTL, 10)
    : 3600;

  if (isProduction) {
    return {
      store: redisStore,
      host: process.env.REDIS_HOST ?? 'localhost',
      port: redisPort,
      ttl: redisTtl,
      max: 100,
    };
  }

  return {
    ttl: redisTtl,
    max: 100,
  };
};
