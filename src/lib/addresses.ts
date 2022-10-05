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
