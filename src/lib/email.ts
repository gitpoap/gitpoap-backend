import crypto from 'crypto';

import { context } from '../context';

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
