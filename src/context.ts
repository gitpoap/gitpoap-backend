import { PrismaClient } from '@prisma/client';
import * as ethers from 'ethers';

export interface Context {
  prisma: PrismaClient;
  provider: ethers.Provider;
}

const prisma = new PrismaClient();

const provider = ethers.getDefaultProvider('homestead', { infura: process.env.INFURA_API_KEY });

export const context: Context = {
  prisma: prisma,
  provider: provider,
};
