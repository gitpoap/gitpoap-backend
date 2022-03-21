import { createClient, RedisClientType, RedisModules, RedisScripts } from 'redis';
import { REDIS_URL } from '../environment';
import { readFileSync } from 'fs';
import { join } from 'path';

export type RedisClient = RedisClientType<RedisModules, RedisScripts>;

export function createRedisClient(): RedisClient {
  return createClient({
    url: REDIS_URL,
  });
}

function genKey(prefix: string, key: string) {
  return `${prefix}:${key}`;
}

// Note: ttl is in seconds
export async function setValue(
  client: RedisClient,
  prefix: string,
  key: string,
  value: string,
  ttl?: number,
) {
  if (ttl) {
    return await client.set(genKey(prefix, key), value, { EX: ttl });
  } else {
    return await client.set(genKey(prefix, key), value);
  }
}

export async function getValue(client: RedisClient, prefix: string, key: string) {
  return await client.get(genKey(prefix, key));
}

export async function deleteKey(client: RedisClient, prefix: string, key: string) {
  return await client.del(genKey(prefix, key));
}

const deleteScript = readFileSync(join(__dirname, 'deletePrefix.lua')).toString();

export async function deletePrefix(client: RedisClient, prefix: string) {
  return await client.eval(deleteScript, {
    arguments: [`${prefix}:*`],
  });
}
