import { context } from '../context';

export async function upsertProfile(address: string) {
  const addressLower = address.toLowerCase();

  await context.prisma.profile.upsert({
    where: {
      oldAddress: addressLower,
    },
    update: {},
    create: {
      oldAddress: addressLower,
    },
  });
}
