import { Provider } from '@ethersproject/providers';
import { createScopedLogger } from './logging';

export async function resolveENS(provider: Provider, address: string): Promise<string | null> {
  const logger = createScopedLogger('resolveENS');

  const resolvedAddress = await provider.resolveName(address);
  if (address !== resolvedAddress) {
    logger.debug(`Resolved ${address} to ${resolvedAddress}`);
    if (resolvedAddress === null) {
      logger.debug(`${address} is not a valid address`);
    }
  }
  return resolvedAddress;
}
