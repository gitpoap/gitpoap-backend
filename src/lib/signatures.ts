import { utils } from 'ethers';
import { DateTime } from 'luxon';
import { SIGNATURE_TTL_MINUTES } from '../constants';
import { createScopedLogger } from '../logging';

type Signature = {
  data: string;
  createdAt: number;
};

export function isSignatureValid<T = Record<string, any>>(
  address: string,
  method: string,
  signature: Signature,
  data: T,
) {
  const logger = createScopedLogger('isSignatureValid');

  const createdAt = DateTime.fromSeconds(signature.createdAt / 1000.0);

  if (createdAt.plus({ minutes: SIGNATURE_TTL_MINUTES }) < DateTime.now()) {
    logger.debug('Rejected expired signature');
    return false;
  }

  const recoveredAddress = utils.verifyMessage(
    JSON.stringify({
      site: 'gitpoap.io',
      method,
      createdAt: signature.createdAt,
      ...data,
    }),
    signature.data,
  );

  return recoveredAddress === address;
}
