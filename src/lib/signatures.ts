import { utils } from 'ethers';
import { DateTime } from 'luxon';
import { SIGNATURE_TTL_MINUTES } from '../constants';
import { createScopedLogger } from '../logging';

type Signature = {
  data: string;
  message: string;
  createdAt: number;
};

type Methods = 'GET' | 'POST' | 'PUT' | 'DELETE';

type SignatureMethod = `${Methods} ${string}`;

export function isSignatureValid<Data = Record<string, any>>(
  address: string,
  method: SignatureMethod,
  signature: Signature,
  data: Data,
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
      message: signature.message,
      data,
    }),
    signature.data,
  );

  return recoveredAddress === address;
}
