import { createClient } from 'redis';
import { REDIS_URL } from '../environment';
import { readFileSync } from 'fs';
import { join } from 'path';
import { redisRequestDurationSeconds } from '../metrics';

export type RedisClient = {
  connect: () => Promise<any>;
  disconnect: () => Promise<any>;
  setValue: (prefix: string, key: string, value: string, ttl?: number) => Promise<any>;
  getValue: (prefix: string, key: string) => Promise<string | null>;
  deleteKey: (prefix: string, key: string) => Promise<any>;
  deletePrefix: (prefix: string) => Promise<any>;
};

function genKey(prefix: string, key: string) {
  return `${prefix}:${key}`;
}

const deleteScript = readFileSync(join(__dirname, 'deletePrefix.lua')).toString();

export function createRedisClient(): RedisClient {
  const client = createClient({
    url: REDIS_URL,
  });

  return {
    connect: async () => {
      return await client.connect();
    },
    disconnect: async () => {
      return await client.quit();
    },
    setValue: async (prefix: string, key: string, value: string, ttl?: number) => {
      const endTimer = redisRequestDurationSeconds.startTimer('SET');
      let result;
      if (ttl) {
        result = await client.set(genKey(prefix, key), value, { EX: ttl });
      } else {
        result = await client.set(genKey(prefix, key), value);
      }
      endTimer();
      return result;
    },
    getValue: async (prefix: string, key: string) => {
      const endTimer = redisRequestDurationSeconds.startTimer('GET');
      const result = await client.get(genKey(prefix, key));
      endTimer();
      return result;
    },
    deleteKey: async (prefix: string, key: string) => {
      const endTimer = redisRequestDurationSeconds.startTimer('DEL');
      const result = await client.del(genKey(prefix, key));
      endTimer();
      return result;
    },
    deletePrefix: async (prefix: string) => {
      const endTimer = redisRequestDurationSeconds.startTimer('DEL PREFIX');
      const result = await client.eval(deleteScript, { arguments: [`${prefix}:*`] });
      endTimer();
      return result;
    },
  };
}
