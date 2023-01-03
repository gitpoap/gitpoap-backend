import { createScopedLogger } from '../logging';
import { DateTime } from 'luxon';
import { context } from '../context';
import { GitPOAPType } from '@prisma/client';
import { CronJob } from 'cron';

async function yearEndProcessing() {
  const logger = createScopedLogger('yearEndProcessing');

  logger.info('Running year end processing');

  const currentYear = DateTime.utc().year;
  const lastYear = currentYear - 1;

  logger.info(`The current year (UTC) is ${currentYear} and last year is ${lastYear}`);

  const updatedCount = await context.prisma.gitPOAP.updateMany({
    where: {
      type: GitPOAPType.ANNUAL,
      year: lastYear,
    },
    data: { isOngoing: false },
  });

  logger.info(`Updated ${updatedCount} GitPOAPs from ${lastYear} to have isOngoing=false`);

  logger.debug('Finished running year end processing');
}

export const yearEndCronJob = new CronJob(
  '0 0 1 1 *', // Run at 00:00:00 on January 1st (regardless of the day of the week)
  yearEndProcessing,
  null,
  false, // Don't start immediately (wait for server to come up)
  'Europe/London', // Use UTC
);
