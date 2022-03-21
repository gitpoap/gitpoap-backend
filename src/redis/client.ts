import { createClient } from 'redis';
import { REDIS_URL } from '../environment';
import { readFileSync } from 'fs';
import { join } from 'path';

export type RedisClient = {
  connect: () => Promise<any>;
  setValue: (prefix: string, key: string, value: string, ttl?: number) => Promise<any>;
  getValue: (prefix: string, key: string) => Promise<string | null>;
  deleteKey: (prefix: string, key: string) => Promise<any>;
  deletePrefix: (prefix: string) => Promise<any>;
};

//export type RedisClient = RedisClientType<RedisModules, RedisScripts>;

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
      if (ttl) {
        return await client.set(genKey(prefix, key), value, { EX: ttl });
      } else {
        return await client.set(genKey(prefix, key), value);
      }
    },
    getValue: async (prefix: string, key: string) => {
      return await client.get(genKey(prefix, key));
    },
    deleteKey: async (prefix: string, key: string) => {
      return await client.del(genKey(prefix, key));
    },
    deletePrefix: async (prefix: string) => {
      return await client.eval(deleteScript, { arguments: [`${prefix}:*`] });
    },
  };
}
