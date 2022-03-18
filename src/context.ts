import { PrismaClient } from '@prisma/client';
import { getDefaultProvider } from 'ethers';
import { Provider } from '@ethersproject/providers';
import { INFURA_API_KEY } from './environment';
import { createRedisClient, RedisClient } from './redis';

export interface Context {
  prisma: PrismaClient;
  provider: Provider;
  redis: RedisClient;
}

const prisma = new PrismaClient();

let apiObj = undefined;
if (INFURA_API_KEY) {
  apiObj = { infura: INFURA_API_KEY };
}
const provider = getDefaultProvider('homestead', apiObj);

const redis = createRedisClient();

export const context: Context = {
  prisma,
  provider,
  redis,
};
