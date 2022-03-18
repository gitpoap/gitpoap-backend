import { createClient, RedisClientType, RedisModules, RedisScripts } from 'redis';
import { REDIS_URL } from './environment';

export type RedisClient = RedisClientType<RedisModules, RedisScripts>;

export function createRedisClient(): RedisClient {
  return createClient({
    url: REDIS_URL,
  });
}
