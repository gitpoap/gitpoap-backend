import { context } from '../context';

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
  return await context.prisma.email.upsert({
    where: { emailAddress },
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
      emailAddress,
      activeToken,
      tokenExpiresAt,
    },
  });
}
