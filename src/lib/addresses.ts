import { context } from '../context';

export const upsertAddress = async (
  address: string,
  ensName?: string | null,
  ensAvatarImageUrl?: string | null,
) => {
  const addressResult = await context.prisma.address.upsert({
    where: { ethAddress: address.toLowerCase() },
    update: {
      ensName,
      ensAvatarImageUrl,
    },
    create: {
      ethAddress: address.toLowerCase(),
      ensName,
      ensAvatarImageUrl,
    },
  });

  return addressResult;
};

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
