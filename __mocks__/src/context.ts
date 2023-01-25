import { PrismaClient } from '@prisma/client';
import { Provider } from '@ethersproject/providers';
import { RedisClient } from '../../src/redis/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { context } from '../../src/context';
import { PrivyClient } from '@privy-io/server-auth';

type MockContext = {
  prisma: DeepMockProxy<PrismaClient>;
  privy: DeepMockProxy<PrivyClient>;
  provider: DeepMockProxy<Provider>;
  redis: DeepMockProxy<RedisClient>;
};

export const contextMock = context as unknown as MockContext;

jest.mock('../../src/context', () => ({
  __esModule: true,
  context: {
    prisma: mockDeep<PrismaClient>(),
    privy: mockDeep<PrivyClient>(),
    provider: mockDeep<Provider>(),
    redis: mockDeep<RedisClient>(),
  },
}));
