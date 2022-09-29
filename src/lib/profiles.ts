import { context } from '../context';

export async function upsertProfile(address: string, ensName?: string | null) {
  const addressLower = address.toLowerCase();

  // Get the address record OR create one if it doesn't exist
  const addressResult = await context.prisma.address.upsert({
    where: { ethAddress: addressLower },
    update: { ensName },
    create: { ethAddress: addressLower, ensName },
  });

  // Get the profile OR create one if it doesn't exist
  const profile = await context.prisma.profile.upsert({
    where: {
      addressId: addressResult.id,
    },
    update: {},
    create: {
      address: {
        connect: {
          id: addressResult.id,
        },
      },
    },
    include: {
      address: true,
    },
  });

  return profile;
}

export const getProfileByAddress = async (addressToFind: string) =>
  await context.prisma.profile.findFirst({
    where: {
      address: {
        ethAddress: addressToFind.toLowerCase(),
      },
    },
  });
