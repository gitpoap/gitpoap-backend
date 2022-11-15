import { context } from '../context';
import { createScopedLogger } from '../logging';

export async function upsertEmail(emailAddress: string) {
  return await context.prisma.email.upsert({
    where: { emailAddress },
    update: {},
    create: { emailAddress },
  });
}

export async function upsertUnverifiedEmail(
  emailAddress: string,
  activeToken: string,
  tokenExpiresAt: Date,
  addressId: number,
) {
  const logger = createScopedLogger('upsertUnverifiedEmail');
  try {
    return await context.prisma.email.upsert({
      where: { addressId },
      update: {},
      create: {
        address: {
          connect: { id: addressId },
        },
        emailAddress,
        activeToken,
        tokenExpiresAt,
      },
    });
  } catch (e) {
    logger.warn(`Caught error while trying to upsert unverified email ${emailAddress}: ${e}`);

    // Update the record (which we assume to exist) & return it if the upsert fails.
    const email = await context.prisma.email.update({
      where: { addressId },
      data: {
        address: {
          connect: { id: addressId },
        },
        emailAddress,
        activeToken,
        tokenExpiresAt,
      },
    });

    return email;
  }
}
