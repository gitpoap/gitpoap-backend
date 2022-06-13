import { jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { Provider } from '@ethersproject/providers';
import { RedisClient } from '../../src/redis/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { context } from '../../src/context';

export type MockContext = {
  prisma: DeepMockProxy<PrismaClient>;
  provider: DeepMockProxy<Provider>;
  redis: DeepMockProxy<RedisClient>;
};

export const contextMock = context as unknown as MockContext;

jest.mock('../../src/context', () => ({
  __esModule: true,
  context: {
    prisma: mockDeep<PrismaClient>(),
    provider: mockDeep<Provider>(),
    redis: mockDeep<RedisClient>(),
  },
}));
