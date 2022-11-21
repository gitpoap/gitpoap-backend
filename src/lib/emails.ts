import { context } from '../context';
import crypto from 'crypto';
import { Email } from '@prisma/client';
import { createScopedLogger } from '../logging';

const DEFAULT_BYTE_LENGTH = 20;
const DEFAULT_STRING_BASE = 'hex';

const generateEmailToken = async (
  byteLength: number = DEFAULT_BYTE_LENGTH,
  stringBase: BufferEncoding = DEFAULT_STRING_BASE,
): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    crypto.randomBytes(byteLength, (err, buffer) => {
      if (err) {
        reject(err);
      } else {
        resolve(buffer.toString(stringBase));
      }
    });
  });

export const generateUniqueEmailToken = async (
  byteLength: number = DEFAULT_BYTE_LENGTH,
  stringBase: BufferEncoding = DEFAULT_STRING_BASE,
): Promise<string> => {
  let activeToken;
  let isTokenUnique = false;
  do {
    activeToken = await generateEmailToken(byteLength, stringBase);

    const email = await context.prisma.email.findUnique({
      where: {
        activeToken,
      },
    });
    // Token is unique if no email is found
    isTokenUnique = email === null;
  } while (!isTokenUnique);

  return activeToken;
};

export async function upsertEmail(emailAddress: string): Promise<Email | null> {
  const logger = createScopedLogger('upsertEmail');
  const emailAddressLower = emailAddress.toLowerCase();

  try {
    return await context.prisma.email.upsert({
      where: { emailAddress: emailAddressLower },
      update: {},
      create: { emailAddress: emailAddressLower },
    });
  } catch (err) {
    logger.warn(`Caught exception while trying to upsert Email: ${err}`);

    return await context.prisma.email.findFirst({
      where: { emailAddress: { equals: emailAddressLower, mode: 'insensitive' } },
    });
  }
}

export async function upsertUnverifiedEmail(
  emailAddress: string,
  activeToken: string,
  tokenExpiresAt: Date,
  addressId: number,
): Promise<Email | null> {
  const logger = createScopedLogger('upsertUnverifiedEmail');
  const emailAddressLower = emailAddress.toLowerCase();

  try {
    return await context.prisma.email.upsert({
      where: { emailAddress: emailAddressLower },
      update: {
        address: {
          connect: { id: addressId },
        },
        activeToken,
        tokenExpiresAt,
      },
      create: {
        address: {
          connect: { id: addressId },
        },
        emailAddress: emailAddressLower,
        activeToken,
        tokenExpiresAt,
      },
    });
  } catch (err) {
    logger.warn(
      `Failed to upsert Address ID ${addressId} with verification info for "${emailAddress}": ${err}`,
    );
  }

  try {
    // Attempt to update the record (which we now assume to exist)
    return await context.prisma.email.update({
      where: { emailAddress: emailAddressLower },
      data: {
        address: {
          connect: { id: addressId },
        },
        activeToken,
        tokenExpiresAt,
      },
    });
  } catch (err) {
    logger.error(
      `Failed to update Address ID ${addressId} with verification info for "${emailAddress}" after failed upsert: ${err}`,
    );

    return null;
  }
}
