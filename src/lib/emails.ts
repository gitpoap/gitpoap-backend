import { context } from '../context';
import { Email } from '@prisma/client';
import { createScopedLogger } from '../logging';

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

    return await context.prisma.email.findUnique({
      where: { emailAddress: emailAddressLower },
    });
  }
}
