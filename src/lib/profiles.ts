import { context } from '../context';
import { Profile } from '@prisma/client';

export async function upsertProfile(address: string, oldEnsName?: string | null): Promise<Profile> {
  const addressLower = address.toLowerCase();

  return await context.prisma.profile.upsert({
    where: {
      oldAddress: addressLower,
    },
    update: {
      oldEnsName,
    },
    create: {
      oldAddress: addressLower,
      oldEnsName,
    },
  });
}
