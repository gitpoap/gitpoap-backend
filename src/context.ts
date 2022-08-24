import { PrismaClient } from '@prisma/client';
import { getDefaultProvider } from 'ethers';
import { BaseProvider } from '@ethersproject/providers';
import { INFURA_API_KEY } from './environment';
import { createRedisClient, RedisClient } from './redis/client';

export interface Context {
  prisma: PrismaClient;
  provider: BaseProvider;
  redis: RedisClient;
}

const prisma = new PrismaClient();

let apiObj = undefined;
if (INFURA_API_KEY) {
  apiObj = {
    infura: INFURA_API_KEY,
    etherscan: '-',
    alchemy: '-',
    pocket: '-',
    ankr: '-',
  };
}
const provider = getDefaultProvider('homestead', apiObj);

const redis = createRedisClient();

export const context: Context = {
  prisma,
  provider,
  redis,
};
