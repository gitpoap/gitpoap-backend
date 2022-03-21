import { Provider } from '@ethersproject/providers';
import { createScopedLogger } from './logging';

export async function resolveENS(provider: Provider, address: string): Promise<string | null> {
  const logger = createScopedLogger('resolveENS');

  if (!address.endsWith('.eth')) {
    logger.debug("Skipping lookup since address doesn't end with '.eth'");
    return address;
  }

  try {
    const resolvedAddress = await provider.resolveName(address);
    if (address !== resolvedAddress) {
      logger.debug(`Resolved ${address} to ${resolvedAddress}`);
      if (resolvedAddress === null) {
        logger.debug(`${address} is not a valid address`);
      }
    }

    return resolvedAddress;
  } catch (err) {
    logger.warn(`Got error from ethers.resolveName: ${err}`);
    return null;
  }
}
