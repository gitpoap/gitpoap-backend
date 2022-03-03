import { PrismaClient } from '@prisma/client';
import { getDefaultProvider, Provider } from 'ethers';

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
