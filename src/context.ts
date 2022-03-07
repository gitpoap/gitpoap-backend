import { PrismaClient } from '@prisma/client';
import { getDefaultProvider } from 'ethers';
import { Provider } from '@ethersproject/providers';

export interface Context {
  prisma: PrismaClient;
  provider: Provider;
}

const prisma = new PrismaClient();

let apiObj = undefined;
if (process.env.INFURA_API_KEY) {
  apiObj = { infura: process.env.INFURA_API_KEY };
}
const provider = getDefaultProvider('homestead', apiObj);

export const context: Context = {
  prisma: prisma,
  provider: provider,
};
