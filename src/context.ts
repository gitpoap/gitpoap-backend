import { PrismaClient } from '@prisma/client';
import { BaseProvider, InfuraProvider } from '@ethersproject/providers';
import { INFURA_API_KEY } from './environment';
import { createRedisClient, RedisClient } from './redis/client';
import { createPrivyClient } from './external/privy';
import { PrivyClient } from '@privy-io/server-auth';

export interface Context {
  prisma: PrismaClient;
  provider: BaseProvider;
  redis: RedisClient;
  privy: PrivyClient;
}

const prisma = new PrismaClient();

const provider = new InfuraProvider('mainnet', INFURA_API_KEY);

const redis = createRedisClient();

const privy = createPrivyClient();

export const context: Context = {
  prisma,
  provider,
  redis,
  privy,
};
