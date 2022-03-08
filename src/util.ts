import { Provider } from '@ethersproject/providers';

export async function resolveENS(provider: Provider, address: string): Promise<string | null> {
  const resolvedAddress = await provider.resolveName(address);
  if (address !== resolvedAddress) {
    console.log(`Resolved ${address} to ${resolvedAddress}`);
    if (resolvedAddress === null) {
      console.log(`${address} is not a valid address`);
    }
  }
  return resolvedAddress;
}
