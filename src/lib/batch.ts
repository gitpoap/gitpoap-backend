import { context } from '../context';
import { DateTime } from 'luxon';

export async function lookupLastRun(name: string): Promise<DateTime | null> {
  const batchTiming = await context.prisma.batchTiming.findUnique({
    where: { name },
  });

  if (batchTiming === null) {
    return null;
  }

  return DateTime.fromJSDate(batchTiming.lastRun);
}

export async function updateLastRun(name: string) {
  const now = DateTime.now().toJSDate();

  await context.prisma.batchTiming.upsert({
    where: { name },
    update: {
      lastRun: now,
    },
    create: {
      name,
      lastRun: now,
    },
  });
}
