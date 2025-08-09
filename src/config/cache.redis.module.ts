// src/config/cache.redis.module.ts
import { CacheModule } from '@nestjs/cache-manager';
import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-store';

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      isGlobal: true,
      useFactory: async (config: ConfigService) => {
        const log = new Logger('CacheRedisModule');

        // Allow disabling Redis via env if desired (e.g., USE_REDIS=false)
        const useRedis =
          String(config.get('USE_REDIS') ?? 'true').toLowerCase() !== 'false';

        if (!useRedis) {
          log.warn('Redis disabled by configuration. Using in-memory cache.');
          return {
            ttl: 0, // per-entry TTLs
          };
        }

        const host = config.get<string>('REDIS_HOST') ?? '127.0.0.1';
        const port = Number(config.get<number>('REDIS_PORT') ?? 6379);
        const password = config.get<string>('REDIS_PASSWORD') ?? undefined;

        try {
          const store = await redisStore({
            socket: { host, port },
            password,
            ttl: 0, // per-entry TTLs
          });
          log.log(`Connected to Redis at ${host}:${port}`);
          return {
            store,
          };
        } catch (err) {
          // Fallback to in-memory cache if Redis is unavailable
          log.error(
            `Failed to connect to Redis at ${host}:${port}. Falling back to in-memory cache. Reason: ${
              (err as Error).message
            }`,
          );
          return {
            ttl: 0, // per-entry TTLs
          };
        }
      },
    }),
  ],
  exports: [CacheModule],
})
export class CacheRedisModule {}
