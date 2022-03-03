import { PrismaClient } from '@prisma/client';
import { getDefaultProvider } from 'ethers';
import { Provider } from '@ethersproject/providers';

export interface Context {
  prisma: PrismaClient;
  provider: Provider;
}

const prisma = new PrismaClient();

const provider = getDefaultProvider('homestead', { infura: process.env.INFURA_API_KEY });

export const context: Context = {
  prisma: prisma,
  provider: provider,
};
