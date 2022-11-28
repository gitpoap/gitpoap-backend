import { context } from '../context';
import { createScopedLogger } from '../logging';

export async function upsertAddress(
  address: string,
  ensName?: string | null,
  ensAvatarImageUrl?: string | null,
) {
  const logger = createScopedLogger('upsertAddress');

  const addressLower = address.toLowerCase();

  try {
    return await context.prisma.address.upsert({
      where: { ethAddress: addressLower },
      update: {
        ensName,
        ensAvatarImageUrl,
      },
      create: {
        ethAddress: addressLower,
        ensName,
        ensAvatarImageUrl,
      },
    });
  } catch (err) {
    logger.warn(`Caught error while trying to upsert address ${address}: ${err}`);

    // Return the record (which we assume to exist) if the upsert fails
    return await context.prisma.address.findUnique({
      where: { ethAddress: addressLower },
    });
  }
}

export async function removeGithubLoginForAddress(addressId: number) {
  await context.prisma.address.update({
    where: {
      id: addressId,
    },
    data: {
      githubUserId: null,
    },
  });
}

export async function removeDiscordLoginForAddress(addressId: number) {
  await context.prisma.address.update({
    where: {
      id: addressId,
    },
    data: {
      discordUserId: null,
    },
  });
}

export const addGithubLoginForAddress = async (addressId: number, githubUserId: number) => {
  await context.prisma.address.update({
    where: {
      id: addressId,
    },
    data: {
      githubUser: {
        connect: {
          id: githubUserId,
        },
      },
    },
  });
};

export const addDiscordLoginForAddress = async (addressId: number, discordUserId: number) => {
  await context.prisma.address.update({
    where: {
      id: addressId,
    },
    data: {
      discordUser: {
        connect: {
          id: discordUserId,
        },
      },
    },
  });
};

/* Shorten version of the input address ~ 0x + 4 chars @ start + end */
export function shortenAddress(address: string, chars = 4): string {
  return `${address.substring(0, chars + 2)}...${address.substring(42 - chars)}`;
}
