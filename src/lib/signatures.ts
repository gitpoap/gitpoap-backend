import { utils } from 'ethers';
import { DateTime } from 'luxon';
import { SIGNATURE_TTL_MINUTES } from '../constants';
import { createScopedLogger } from '../logging';
import { SignatureDataSchema } from '../schemas/signatures';
import { z } from 'zod';

type SignatureData = {
  message: string;
  createdAt: number;
};

export function generateSignatureMessage(address: string, createdAt: number): string {
  return `This signature attests that I am ${address.toLowerCase()}, for the purpose of signing into GitPOAP.

Signing this message requires no ETH and will not create or send a transaction.

Created at: ${createdAt}.`;
}

export function generateSignatureData(address: string): SignatureData {
  const createdAt = Date.now();

  const message = generateSignatureMessage(address, createdAt);

  return { message, createdAt };
}

export function isSignatureValid(
  address: string,
  signatureData: SignatureData,
  signature: string,
): boolean {
  const logger = createScopedLogger('isSignatureValid');

  const createdAt = DateTime.fromSeconds(signatureData.createdAt / 1000.0);

  if (createdAt.plus({ minutes: SIGNATURE_TTL_MINUTES }) < DateTime.now()) {
    logger.debug('Rejected expired signature');
    return false;
  }

  const recoveredAddress = utils.verifyMessage(signatureData.message, signature);

  return recoveredAddress === address;
}

export function isAuthSignatureDataValid(
  address: string,
  authSignatureData: z.infer<typeof SignatureDataSchema>,
): boolean {
  const message = generateSignatureMessage(address, authSignatureData.createdAt);

  return isSignatureValid(
    address,
    { message, createdAt: authSignatureData.createdAt },
    authSignatureData.signature,
  );
}
