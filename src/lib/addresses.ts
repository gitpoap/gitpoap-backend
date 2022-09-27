import { context } from '../context';

export const upsertAddress = async (
  address: string,
  ensName: string | null,
  ensAvatarImageUrl: string | null,
) => {
  const addressResult = await context.prisma.address.upsert({
    where: { ethAddress: address },
    update: {
      ensName: ensName,
      ensAvatarImageUrl: ensAvatarImageUrl,
    },
    create: {
      ethAddress: address,
      ensName: ensName,
      ensAvatarImageUrl: ensAvatarImageUrl,
    },
  });

  return addressResult;
};
