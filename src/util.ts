import { Provider } from '@ethersproject/providers';
import { logger } from './logging';

export async function resolveENS(provider: Provider, address: string): Promise<string | null> {
  const resolvedAddress = await provider.resolveName(address);
  if (address !== resolvedAddress) {
    logger.debug(`Resolved ${address} to ${resolvedAddress}`);
    if (resolvedAddress === null) {
      logger.debug(`${address} is not a valid address`);
    }
  }
  return resolvedAddress;
}
