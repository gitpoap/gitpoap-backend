import { PrismaClient } from '@prisma/client';
import { getDefaultProvider } from 'ethers';
import { Provider } from '@ethersproject/providers';
import { INFURA_API_KEY } from './environment';

export interface Context {
  prisma: PrismaClient;
  provider: Provider;
}

const prisma = new PrismaClient();

let apiObj = undefined;
if (INFURA_API_KEY) {
  apiObj = { infura: INFURA_API_KEY };
}
const provider = getDefaultProvider('homestead', apiObj);

export const context: Context = {
  prisma: prisma,
  provider: provider,
};
