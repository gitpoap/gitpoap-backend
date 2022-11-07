import { context } from '../context';

export async function upsertEmail(emailAddress: string) {
  return await context.prisma.email.upsert({
    where: { emailAddress },
    update: {},
    create: { emailAddress },
  });
}
