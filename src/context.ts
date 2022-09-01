import { PrismaClient } from '@prisma/client';
import { BaseProvider, InfuraProvider } from '@ethersproject/providers';
import { INFURA_API_KEY } from './environment';
import { createRedisClient, RedisClient } from './redis/client';

export interface Context {
  prisma: PrismaClient;
  provider: BaseProvider;
  redis: RedisClient;
}

const prisma = new PrismaClient();

const provider = new InfuraProvider('mainnet', INFURA_API_KEY);

const redis = createRedisClient();

export const context: Context = {
  prisma,
  provider,
  redis,
};
