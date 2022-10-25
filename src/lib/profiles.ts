import { context } from '../context';
import { upsertAddress } from './addresses';
import { Address, User, Profile } from '@prisma/client';
import { createScopedLogger } from '../logging';

export type ExtendedProfile = Profile & {
  address: {
    ensName: string | null;
    ensAvatarImageUrl: string | null;
    githubUser: {
      githubHandle: string;
    } | null;
  };
};

export async function upsertProfile(
  address: string,
  ensName?: string | null,
): Promise<ExtendedProfile | null> {
  const logger = createScopedLogger('upsertProfile');

  // Get the address record OR create one if it doesn't exist
  const addressResult = await upsertAddress(address, ensName);

  if (addressResult === null) {
    logger.error(`Failed to upsert address: ${address}`);
    return null;
  }

  try {
    // Get the profile OR create one if it doesn't exist
    return await context.prisma.profile.upsert({
      where: { addressId: addressResult.id },
      update: {},
      create: {
        address: {
          connect: { id: addressResult.id },
        },
      },
      include: {
        address: {
          include: {
            githubUser: true,
          },
        },
      },
    });
  } catch (err) {
    logger.warn(`Failed to upsert profile for Address ID ${addressResult.id}: ${err}`);

    // Return the record (which we assume to exist) if the upsert fails
    return await context.prisma.profile.findUnique({
      where: { addressId: addressResult.id },
      include: {
        address: {
          include: {
            githubUser: true,
          },
        },
      },
    });
  }
}

export async function upsertProfileForAddressId(addressId: number): Promise<Profile | null> {
  const logger = createScopedLogger('upsertProfileForAddressId');

  try {
    return await context.prisma.profile.upsert({
      where: { addressId },
      update: {},
      create: {
        address: {
          connect: { id: addressId },
        },
      },
    });
  } catch (err) {
    logger.warn(`Failed to upsert profile for Address ID ${addressId}: ${err}`);

    // Return the record (which we assume to exist) if the upsert fails
    return await context.prisma.profile.findUnique({
      where: { addressId },
    });
  }
}

export const getProfileByAddress = async (addressToFind: string) =>
  await context.prisma.profile.findFirst({
    where: {
      address: {
        ethAddress: addressToFind.toLowerCase(),
      },
    },
  });
