import { createClient } from 'redis';
import { REDIS_URL } from '../environment';
import { readFileSync } from 'fs';
import { join } from 'path';
import { redisRequestDurationSeconds } from '../metrics';

export type RedisClient = {
  connect: () => Promise<any>;
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
    setValue: async (prefix: string, key: string, value: string, ttl?: number) => {
      const endRequest = redisRequestDurationSeconds.startTimer();
      if (ttl) {
        const result = await client.set(genKey(prefix, key), value, { EX: ttl });
        endRequest({ method: 'SET' });
        return result;
      } else {
        const result = await client.set(genKey(prefix, key), value);
        endRequest({ method: 'SET' });
        return result;
      }
    },
    getValue: async (prefix: string, key: string) => {
      const endRequest = redisRequestDurationSeconds.startTimer();
      const result = await client.get(genKey(prefix, key));
      endRequest({ method: 'GET' });
      return result;
    },
    deleteKey: async (prefix: string, key: string) => {
      const endRequest = redisRequestDurationSeconds.startTimer();
      const result = await client.del(genKey(prefix, key));
      endRequest({ method: 'DEL' });
      return result;
    },
    deletePrefix: async (prefix: string) => {
      const endRequest = redisRequestDurationSeconds.startTimer();
      const result = await client.eval(deleteScript, { arguments: [`${prefix}:*`] });
      endRequest({ method: 'DEL PREFIX' });
      return result;
    },
  };
}
